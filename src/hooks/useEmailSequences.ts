import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type EmailSequence = Tables<"email_sequences">;
export type EmailSequenceInsert = TablesInsert<"email_sequences">;
export type EmailSequenceUpdate = TablesUpdate<"email_sequences">;

export type SequenceStep = Tables<"sequence_steps">;
export type SequenceStepInsert = TablesInsert<"sequence_steps">;
export type SequenceStepUpdate = TablesUpdate<"sequence_steps">;

// Fetch all sequences for the business
export function useEmailSequences() {
  return useQuery({
    queryKey: ["email-sequences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sequences")
        .select(`
          *,
          sequence_steps(count),
          sequence_enrollments(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Fetch a single sequence with its steps
export function useEmailSequence(id: string | undefined) {
  return useQuery({
    queryKey: ["email-sequence", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("email_sequences")
        .select(`
          *,
          sequence_steps(
            *,
            email_templates(id, name, subject)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      // Sort steps by step_order
      if (data?.sequence_steps) {
        data.sequence_steps.sort((a: any, b: any) => a.step_order - b.step_order);
      }
      
      return data;
    },
    enabled: !!id,
  });
}

// Create a new sequence
export function useCreateEmailSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sequence: Omit<EmailSequenceInsert, "business_id">) => {
      // Get business_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_id")
        .single();

      if (!profile?.business_id) throw new Error("No business found");

      const { data, error } = await supabase
        .from("email_sequences")
        .insert({ ...sequence, business_id: profile.business_id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-sequences"] });
      toast.success("Sequence created");
    },
    onError: (error) => {
      toast.error(`Failed to create sequence: ${error.message}`);
    },
  });
}

// Update a sequence
export function useUpdateEmailSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: EmailSequenceUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("email_sequences")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-sequences"] });
      queryClient.invalidateQueries({ queryKey: ["email-sequence", data.id] });
      toast.success("Sequence updated");
    },
    onError: (error) => {
      toast.error(`Failed to update sequence: ${error.message}`);
    },
  });
}

// Delete a sequence
export function useDeleteEmailSequence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_sequences")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-sequences"] });
      toast.success("Sequence deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete sequence: ${error.message}`);
    },
  });
}

// Sequence Steps hooks

// Create a step
export function useCreateSequenceStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (step: SequenceStepInsert) => {
      const { data, error } = await supabase
        .from("sequence_steps")
        .insert(step)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-sequence", data.sequence_id] });
      toast.success("Step added");
    },
    onError: (error) => {
      toast.error(`Failed to add step: ${error.message}`);
    },
  });
}

// Update a step
export function useUpdateSequenceStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: SequenceStepUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("sequence_steps")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-sequence", data.sequence_id] });
    },
    onError: (error) => {
      toast.error(`Failed to update step: ${error.message}`);
    },
  });
}

// Delete a step
export function useDeleteSequenceStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, sequenceId }: { id: string; sequenceId: string }) => {
      const { error } = await supabase
        .from("sequence_steps")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { sequenceId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-sequence", data.sequenceId] });
      toast.success("Step removed");
    },
    onError: (error) => {
      toast.error(`Failed to remove step: ${error.message}`);
    },
  });
}

// Reorder steps
export function useReorderSequenceSteps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sequenceId, 
      stepIds 
    }: { 
      sequenceId: string; 
      stepIds: string[] 
    }) => {
      // Update each step with its new order
      const updates = stepIds.map((id, index) => 
        supabase
          .from("sequence_steps")
          .update({ step_order: index })
          .eq("id", id)
      );

      await Promise.all(updates);
      return { sequenceId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["email-sequence", data.sequenceId] });
    },
    onError: (error) => {
      toast.error(`Failed to reorder steps: ${error.message}`);
    },
  });
}

// Trigger options for sequences
export const SEQUENCE_TRIGGERS = [
  { value: "manual", label: "Manual enrollment only" },
  { value: "customer_created", label: "When a new customer is created" },
  { value: "quote_sent", label: "When a quote is sent" },
  { value: "quote_accepted", label: "When a quote is accepted" },
  { value: "job_completed", label: "When a job is completed" },
  { value: "invoice_paid", label: "When an invoice is paid" },
] as const;
