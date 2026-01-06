import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { EmailEditor } from "@/components/marketing";
import {
  useEmailTemplate,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  TEMPLATE_CATEGORIES,
} from "@/hooks/useEmailTemplates";
import { Skeleton } from "@/components/ui/skeleton";

export default function TemplateEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";

  const { data: existingTemplate, isLoading } = useEmailTemplate(
    isNew ? undefined : id
  );
  const createMutation = useCreateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();

  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    body_html: "<p>Hello {{customer.first_name}},</p><p></p><p>Best regards,<br>{{business.name}}</p>",
    category: "general",
    is_active: true,
  });

  // Populate form with existing template data
  useEffect(() => {
    if (existingTemplate) {
      setFormData({
        name: existingTemplate.name,
        subject: existingTemplate.subject,
        body_html: existingTemplate.body_html,
        category: existingTemplate.category || "general",
        is_active: existingTemplate.is_active ?? true,
      });
    }
  }, [existingTemplate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.subject || !formData.body_html) {
      return;
    }

    try {
      if (isNew) {
        await createMutation.mutateAsync(formData);
      } else if (id) {
        await updateMutation.mutateAsync({ id, ...formData });
      }
      navigate("/marketing/templates");
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/marketing/templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isNew ? "New Template" : "Edit Template"}
            </h1>
            <p className="text-muted-foreground">
              {isNew
                ? "Create a new reusable email template"
                : `Editing: ${existingTemplate?.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button variant="outline" asChild>
              <Link to={`/marketing/templates/${id}/preview`}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Link>
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Welcome Email"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                placeholder="e.g., Welcome to {{business.name}}!"
                value={formData.subject}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subject: e.target.value }))
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                You can use variables like {"{{customer.first_name}}"} in the subject
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Active templates can be used in sequences and campaigns
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Content</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailEditor
              value={formData.body_html}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, body_html: value }))
              }
              placeholder="Write your email content here..."
            />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
