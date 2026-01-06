import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Monitor, Smartphone, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmailTemplate } from "@/hooks/useEmailTemplates";
import { useCustomers } from "@/hooks/useCustomers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function TemplatePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading: templateLoading } = useEmailTemplate(id);
  const { data: customers } = useCustomers();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("sample");
  const [renderedContent, setRenderedContent] = useState<{
    subject: string;
    html: string;
  } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

  const renderTemplate = async () => {
    if (!id) return;

    setIsRendering(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await supabase.functions.invoke("render-email-template", {
        body: {
          template_id: id,
          customer_id: selectedCustomerId === "sample" ? undefined : selectedCustomerId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setRenderedContent({
        subject: response.data.subject,
        html: response.data.html,
      });
    } catch (error: any) {
      console.error("Error rendering template:", error);
      toast.error("Failed to render template");
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    if (template) {
      renderTemplate();
    }
  }, [template, selectedCustomerId]);

  if (templateLoading) {
    return (
      <div className="container max-w-6xl py-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container max-w-6xl py-6">
        <p className="text-muted-foreground">Template not found</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/marketing/templates/${id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Preview: {template.name}</h1>
            <p className="text-muted-foreground">See how your email will look to customers</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={renderTemplate}
            disabled={isRendering}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRendering ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm">
            <Send className="h-4 w-4 mr-2" />
            Send Test
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Preview Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Data</label>
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sample">Sample Data</SelectItem>
                    {customers?.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose a real customer to see how variables will be replaced
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">View Mode</label>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "desktop" | "mobile")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="desktop" className="gap-2">
                      <Monitor className="h-4 w-4" />
                      Desktop
                    </TabsTrigger>
                    <TabsTrigger value="mobile" className="gap-2">
                      <Smartphone className="h-4 w-4" />
                      Mobile
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Subject Line</CardTitle>
            </CardHeader>
            <CardContent>
              {isRendering ? (
                <Skeleton className="h-6 w-full" />
              ) : (
                <p className="text-sm font-medium">
                  {renderedContent?.subject || template.subject}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Template Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span className="capitalize">{template.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={template.is_active ? "text-green-600" : "text-muted-foreground"}>
                  {template.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Area */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div
              className={`bg-muted/50 flex items-start justify-center p-6 min-h-[600px] ${
                viewMode === "mobile" ? "px-4" : ""
              }`}
            >
              {isRendering ? (
                <div className="w-full max-w-[600px] space-y-4">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : renderedContent ? (
                <div
                  className={`bg-background rounded-lg shadow-lg overflow-hidden transition-all ${
                    viewMode === "mobile" ? "w-[375px]" : "w-full max-w-[600px]"
                  }`}
                >
                  <iframe
                    srcDoc={renderedContent.html}
                    className="w-full min-h-[500px] border-0"
                    title="Email Preview"
                  />
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <p>No preview available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
