import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Send, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AudienceSelector } from "@/components/marketing/AudienceSelector";
import { FilterConfig, useAudiencePreview } from "@/hooks/useAudienceSegments";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import {
  useCampaign,
  useCreateCampaign,
  useUpdateCampaign,
  useSendCampaign,
  useScheduleCampaign,
} from "@/hooks/useCampaigns";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

export default function CampaignEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new" || !id;

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    has_email: true,
    exclude_unsubscribed: true,
  });
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [activeTab, setActiveTab] = useState("template");

  const { data: campaign, isLoading: loadingCampaign } = useCampaign(id);
  const { data: templates } = useEmailTemplates();
  const { data: audiencePreview } = useAudiencePreview(filterConfig);

  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const sendCampaign = useSendCampaign();
  const scheduleCampaign = useScheduleCampaign();

  // Load campaign data
  useEffect(() => {
    if (campaign) {
      setName(campaign.name);
      setSubject(campaign.subject);
      setBodyHtml(campaign.body_html);
      setTemplateId(campaign.template_id);
      setSegmentId(campaign.segment_id);
      if (campaign.segment?.filter_config) {
        setFilterConfig(campaign.segment.filter_config as FilterConfig);
      }
    }
  }, [campaign]);

  // Load template content when selected
  const handleTemplateSelect = (id: string) => {
    setTemplateId(id);
    const template = templates?.find((t) => t.id === id);
    if (template) {
      setSubject(template.subject);
      setBodyHtml(template.body_html);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject line");
      return;
    }
    if (!bodyHtml.trim()) {
      toast.error("Please add email content");
      return;
    }

    try {
      const data = {
        name,
        subject,
        body_html: bodyHtml,
        template_id: templateId,
        segment_id: segmentId,
        total_recipients: audiencePreview?.count || 0,
      };

      if (isNew) {
        const newCampaign = await createCampaign.mutateAsync(data);
        toast.success("Campaign created");
        navigate(`/marketing/campaigns/${newCampaign.id}`);
      } else {
        await updateCampaign.mutateAsync({ id: id!, ...data });
        toast.success("Campaign saved");
      }
    } catch (error) {
      toast.error("Failed to save campaign");
    }
  };

  const handleSendNow = async () => {
    if (isNew) {
      toast.error("Please save the campaign first");
      return;
    }

    if (!audiencePreview?.count || audiencePreview.count === 0) {
      toast.error("No recipients match your audience filters");
      return;
    }

    try {
      await sendCampaign.mutateAsync(id!);
      toast.success("Campaign is being sent");
      navigate("/marketing/campaigns");
    } catch (error) {
      toast.error("Failed to send campaign");
    }
  };

  const handleSchedule = async () => {
    if (isNew) {
      toast.error("Please save the campaign first");
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      toast.error("Please select date and time");
      return;
    }

    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    try {
      await scheduleCampaign.mutateAsync({ id: id!, scheduledAt });
      toast.success("Campaign scheduled");
      setScheduleDialogOpen(false);
      navigate("/marketing/campaigns");
    } catch (error) {
      toast.error("Failed to schedule campaign");
    }
  };

  if (!isNew && loadingCampaign) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const isSaving = createCampaign.isPending || updateCampaign.isPending;
  const isSending = sendCampaign.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketing/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Campaign" : "Edit Campaign"}
            </h1>
            {campaign?.status && (
              <p className="text-sm text-muted-foreground capitalize">
                Status: {campaign.status}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>

          {!isNew && campaign?.status === "draft" && (
            <>
              <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule Campaign</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Time</Label>
                        <Input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Campaign will be sent to {audiencePreview?.count || 0} recipients
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSchedule}>Schedule</Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button onClick={handleSendNow} disabled={isSending}>
                <Send className="h-4 w-4 mr-2" />
                {isSending ? "Sending..." : "Send Now"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Campaign Name */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Campaign Name</Label>
            <Input
              id="name"
              placeholder="e.g., Summer Sale Announcement"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Internal name for your reference. Recipients won't see this.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="template">1. Template</TabsTrigger>
          <TabsTrigger value="audience">2. Audience</TabsTrigger>
          <TabsTrigger value="review">3. Review</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Start from Template (Optional)</Label>
                <Select value={templateId || ""} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates?.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="body">Email Body (HTML)</Label>
                <Textarea
                  id="body"
                  placeholder="Enter email content..."
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
            </CardHeader>
            <CardContent>
              <AudienceSelector
                value={filterConfig}
                onChange={setFilterConfig}
                segmentId={segmentId}
                onSegmentChange={setSegmentId}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="space-y-4 mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-muted-foreground">Campaign Name</Label>
                  <p className="font-medium">{name || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Subject</Label>
                  <p className="font-medium">{subject || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Recipients</Label>
                  <p className="font-medium">{audiencePreview?.count || 0} customers</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Email Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none p-4 border rounded-lg bg-background max-h-64 overflow-auto"
                  dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>No content</p>" }}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
