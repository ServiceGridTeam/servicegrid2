import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Mail, Search } from "lucide-react";
import {
  useEmailTemplates,
  useDeleteEmailTemplate,
  useDuplicateEmailTemplate,
  useUpdateEmailTemplate,
  TEMPLATE_CATEGORIES,
} from "@/hooks/useEmailTemplates";
import { EmailTemplateTable, DeleteTemplateDialog } from "@/components/marketing";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function Templates() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: templates, isLoading } = useEmailTemplates({
    search: debouncedSearch,
    category,
  });

  const deleteMutation = useDeleteEmailTemplate();
  const duplicateMutation = useDuplicateEmailTemplate();
  const updateMutation = useUpdateEmailTemplate();

  const handleDelete = (id: string) => {
    const template = templates?.find((t) => t.id === id);
    setTemplateToDelete({ id, name: template?.name || "" });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete.id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id);
  };

  const handleToggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, is_active: isActive });
  };

  const hasTemplates = templates && templates.length > 0;
  const showEmptyState =
    !isLoading && !hasTemplates && !debouncedSearch && category === "all";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-muted-foreground">
            Create reusable email templates with dynamic variables
          </p>
        </div>
        <Button asChild>
          <Link to="/marketing/templates/new">
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </Button>
      </div>

      {!showEmptyState && (
        <>
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              {TEMPLATE_CATEGORIES.map((cat) => (
                <TabsTrigger key={cat.value} value={cat.value}>
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {showEmptyState ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No templates yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create your first email template to use in sequences and campaigns.
            </p>
            <Button asChild>
              <Link to="/marketing/templates/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <EmailTemplateTable
              templates={templates}
              isLoading={isLoading}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
            />
          </CardContent>
        </Card>
      )}

      <DeleteTemplateDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        templateName={templateToDelete?.name}
      />
    </div>
  );
}
