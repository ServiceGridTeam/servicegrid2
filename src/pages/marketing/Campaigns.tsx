import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CampaignCard } from "@/components/marketing/CampaignCard";
import {
  useCampaigns,
  useDeleteCampaign,
  useDuplicateCampaign,
  useSendCampaign,
  useCancelCampaign,
  CampaignStatus,
} from "@/hooks/useCampaigns";
import { toast } from "sonner";

export default function Campaigns() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<CampaignStatus | "all">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useCampaigns({
    status: activeTab === "all" ? undefined : activeTab,
    search: search || undefined,
  });

  const deleteCampaign = useDeleteCampaign();
  const duplicateCampaign = useDuplicateCampaign();
  const sendCampaign = useSendCampaign();
  const cancelCampaign = useCancelCampaign();

  const handleSend = async (id: string) => {
    try {
      await sendCampaign.mutateAsync(id);
      toast.success("Campaign is being sent");
    } catch (error) {
      toast.error("Failed to send campaign");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const newCampaign = await duplicateCampaign.mutateAsync(id);
      toast.success("Campaign duplicated");
      navigate(`/marketing/campaigns/${newCampaign.id}`);
    } catch (error) {
      toast.error("Failed to duplicate campaign");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCampaign.mutateAsync(deleteId);
      toast.success("Campaign deleted");
      setDeleteId(null);
    } catch (error) {
      toast.error("Failed to delete campaign");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelCampaign.mutateAsync(id);
      toast.success("Campaign schedule cancelled");
    } catch (error) {
      toast.error("Failed to cancel campaign");
    }
  };

  const filteredCampaigns = campaigns || [];

  const counts = {
    all: campaigns?.length || 0,
    draft: campaigns?.filter((c) => c.status === "draft").length || 0,
    scheduled: campaigns?.filter((c) => c.status === "scheduled").length || 0,
    sent: campaigns?.filter((c) => c.status === "sent").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Send one-time email campaigns to your customers
          </p>
        </div>
        <Button onClick={() => navigate("/marketing/campaigns/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CampaignStatus | "all")}>
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="draft">Drafts ({counts.draft})</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled ({counts.scheduled})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({counts.sent})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {search ? "No campaigns match your search" : "No campaigns yet"}
              </p>
              {!search && (
                <Button
                  className="mt-4"
                  onClick={() => navigate("/marketing/campaigns/new")}
                >
                  Create your first campaign
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  onSend={handleSend}
                  onDuplicate={handleDuplicate}
                  onDelete={setDeleteId}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this campaign. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
