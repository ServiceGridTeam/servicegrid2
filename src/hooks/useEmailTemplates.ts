import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./useProfile";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type EmailTemplate = Tables<"email_templates">;
export type EmailTemplateInsert = TablesInsert<"email_templates">;
export type EmailTemplateUpdate = TablesUpdate<"email_templates">;

interface UseEmailTemplatesOptions {
  search?: string;
  category?: string;
  isActive?: boolean;
}

export function useEmailTemplates(options: UseEmailTemplatesOptions = {}) {
  const { data: profile } = useProfile();
  const businessId = profile?.business_id;

  return useQuery({
    queryKey: ["email-templates", businessId, options],
    queryFn: async () => {
      if (!businessId) return [];

      let query = supabase
        .from("email_templates")
        .select("*")
        .eq("business_id", businessId)
        .order("updated_at", { ascending: false });

      if (options.search) {
        query = query.or(
          `name.ilike.%${options.search}%,subject.ilike.%${options.search}%`
        );
      }

      if (options.category && options.category !== "all") {
        query = query.eq("category", options.category);
      }

      if (options.isActive !== undefined) {
        query = query.eq("is_active", options.isActive);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!businessId,
  });
}

export function useEmailTemplate(id: string | undefined) {
  const { data: profile } = useProfile();
  const businessId = profile?.business_id;

  return useQuery({
    queryKey: ["email-template", id],
    queryFn: async () => {
      if (!id || !businessId) return null;

      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id)
        .eq("business_id", businessId)
        .single();

      if (error) throw error;
      return data as EmailTemplate;
    },
    enabled: !!id && !!businessId,
  });
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (
      template: Omit<EmailTemplateInsert, "business_id" | "created_by">
    ) => {
      if (!profile?.business_id) throw new Error("No business ID");

      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          ...template,
          business_id: profile.business_id,
          created_by: profile.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create template: " + error.message);
    },
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: EmailTemplateUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["email-template", data.id] });
      toast.success("Template updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update template: " + error.message);
    },
  });
}

export function useDeleteEmailTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete template: " + error.message);
    },
  });
}

export function useDuplicateEmailTemplate() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  return useMutation({
    mutationFn: async (templateId: string) => {
      if (!profile?.business_id) throw new Error("No business ID");

      // Fetch the original template
      const { data: original, error: fetchError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (fetchError) throw fetchError;

      // Create a copy
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          business_id: profile.business_id,
          created_by: profile.id,
          name: `${original.name} (Copy)`,
          subject: original.subject,
          body_html: original.body_html,
          body_text: original.body_text,
          category: original.category,
          variables: original.variables,
          is_active: false, // Copies start as inactive
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template duplicated successfully");
    },
    onError: (error) => {
      toast.error("Failed to duplicate template: " + error.message);
    },
  });
}

// Available template variables for insertion
export const TEMPLATE_VARIABLES = [
  { key: "customer.first_name", label: "Customer First Name" },
  { key: "customer.last_name", label: "Customer Last Name" },
  { key: "customer.email", label: "Customer Email" },
  { key: "customer.phone", label: "Customer Phone" },
  { key: "customer.company", label: "Company Name" },
  { key: "business.name", label: "Business Name" },
  { key: "business.phone", label: "Business Phone" },
  { key: "business.email", label: "Business Email" },
  { key: "business.website", label: "Business Website" },
  { key: "job.title", label: "Job Title" },
  { key: "job.scheduled_date", label: "Job Scheduled Date" },
  { key: "quote.number", label: "Quote Number" },
  { key: "quote.total", label: "Quote Total" },
  { key: "invoice.number", label: "Invoice Number" },
  { key: "invoice.total", label: "Invoice Total" },
  { key: "invoice.due_date", label: "Invoice Due Date" },
  { key: "unsubscribe_link", label: "Unsubscribe Link" },
] as const;

export const TEMPLATE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "welcome", label: "Welcome" },
  { value: "follow-up", label: "Follow-up" },
  { value: "reminder", label: "Reminder" },
  { value: "promotional", label: "Promotional" },
  { value: "transactional", label: "Transactional" },
] as const;
