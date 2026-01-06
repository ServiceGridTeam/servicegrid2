import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "./useBusiness";
import type { Tables } from "@/integrations/supabase/types";

export type TimeEntryEdit = Tables<"time_entry_edits">;

export interface TimeEntryEditWithEditor extends TimeEntryEdit {
  editor: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

// Get edit history for a time entry
export function useTimeEntryEditHistory(timeEntryId: string | undefined) {
  return useQuery({
    queryKey: ["time-entry-edits", timeEntryId],
    queryFn: async () => {
      if (!timeEntryId) return [];
      
      const { data, error } = await supabase
        .from("time_entry_edits")
        .select(`
          *,
          editor:profiles!time_entry_edits_edited_by_fkey(id, first_name, last_name)
        `)
        .eq("time_entry_id", timeEntryId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as TimeEntryEditWithEditor[];
    },
    enabled: !!timeEntryId,
  });
}

// Get recent edits for the business
export function useRecentTimeEntryEdits(limit: number = 50) {
  const { data: business } = useBusiness();
  
  return useQuery({
    queryKey: ["time-entry-edits", "recent", business?.id, limit],
    queryFn: async () => {
      if (!business?.id) return [];
      
      const { data, error } = await supabase
        .from("time_entry_edits")
        .select(`
          *,
          editor:profiles!time_entry_edits_edited_by_fkey(id, first_name, last_name)
        `)
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as TimeEntryEditWithEditor[];
    },
    enabled: !!business?.id,
  });
}

// Log an edit to a time entry
export function useLogTimeEntryEdit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      timeEntryId: string;
      fieldChanged: string;
      oldValue: string | null;
      newValue: string | null;
      editReason?: string;
    }) => {
      if (!user?.id || !business?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("time_entry_edits")
        .insert({
          time_entry_id: params.timeEntryId,
          business_id: business.id,
          edited_by: user.id,
          edit_reason: params.editReason || "",
          previous_values: { [params.fieldChanged]: params.oldValue },
          new_values: { [params.fieldChanged]: params.newValue },
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-entry-edits", variables.timeEntryId] });
      queryClient.invalidateQueries({ queryKey: ["time-entry-edits", "recent"] });
    },
  });
}

// Log multiple field changes at once
export function useLogTimeEntryEdits() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: business } = useBusiness();
  
  return useMutation({
    mutationFn: async (params: {
      timeEntryId: string;
      changes: Array<{
        fieldChanged: string;
        oldValue: string | null;
        newValue: string | null;
      }>;
      editReason: string;
    }) => {
      if (!user?.id || !business?.id) throw new Error("Not authenticated");
      
      const previousValues: Record<string, string | null> = {};
      const newValues: Record<string, string | null> = {};
      
      params.changes.forEach(change => {
        previousValues[change.fieldChanged] = change.oldValue;
        newValues[change.fieldChanged] = change.newValue;
      });
      
      const { data, error } = await supabase
        .from("time_entry_edits")
        .insert({
          time_entry_id: params.timeEntryId,
          business_id: business.id,
          edited_by: user.id,
          edit_reason: params.editReason,
          previous_values: previousValues,
          new_values: newValues,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-entry-edits", variables.timeEntryId] });
      queryClient.invalidateQueries({ queryKey: ["time-entry-edits", "recent"] });
    },
  });
}
