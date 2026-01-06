import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface NotificationPreferences {
  id: string;
  user_id: string;
  business_id: string | null;
  email_invoice_sent: boolean;
  email_invoice_reminder: boolean;
  email_invoice_overdue: boolean;
  email_payment_received: boolean;
  email_payment_failed: boolean;
  email_quote_sent: boolean;
  email_quote_approved: boolean;
  email_job_assigned: boolean;
  email_job_status_changed: boolean;
  email_delay_notification: boolean;
  email_team_invite: boolean;
  email_timesheet_submitted: boolean;
  email_timesheet_approved: boolean;
  email_timesheet_rejected: boolean;
  inapp_invoice_activity: boolean;
  inapp_payment_activity: boolean;
  inapp_quote_activity: boolean;
  inapp_job_activity: boolean;
  inapp_team_activity: boolean;
  inapp_geofence_alerts: boolean;
  inapp_timesheet_activity: boolean;
  daily_digest: boolean;
  weekly_summary: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, "id" | "user_id" | "business_id" | "created_at" | "updated_at"> = {
  email_invoice_sent: true,
  email_invoice_reminder: true,
  email_invoice_overdue: true,
  email_payment_received: true,
  email_payment_failed: true,
  email_quote_sent: true,
  email_quote_approved: true,
  email_job_assigned: true,
  email_job_status_changed: true,
  email_delay_notification: true,
  email_team_invite: true,
  email_timesheet_submitted: true,
  email_timesheet_approved: true,
  email_timesheet_rejected: true,
  inapp_invoice_activity: true,
  inapp_payment_activity: true,
  inapp_quote_activity: true,
  inapp_job_activity: true,
  inapp_team_activity: true,
  inapp_geofence_alerts: true,
  inapp_timesheet_activity: true,
  daily_digest: false,
  weekly_summary: false,
};

async function fetchNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching notification preferences:", error);
    throw error;
  }

  return data as NotificationPreferences | null;
}

async function createDefaultPreferences(userId: string, businessId: string | null): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .insert({
      user_id: userId,
      business_id: businessId,
      ...DEFAULT_PREFERENCES,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating default preferences:", error);
    throw error;
  }

  return data as NotificationPreferences;
}

export function useNotificationPreferences() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notification-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Try to fetch existing preferences
      let prefs = await fetchNotificationPreferences(user.id);

      // If none exist, create defaults
      if (!prefs) {
        // Get user's business_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("business_id")
          .eq("id", user.id)
          .single();

        prefs = await createDefaultPreferences(user.id, profile?.business_id || null);
      }

      return prefs;
    },
    enabled: !!user?.id,
  });
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ field, value }: { field: keyof NotificationPreferences; value: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("notification_preferences")
        .update({ [field]: value })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onMutate: async ({ field, value }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notification-preferences", user?.id] });

      // Snapshot previous value
      const previousPrefs = queryClient.getQueryData<NotificationPreferences>(["notification-preferences", user?.id]);

      // Optimistically update
      if (previousPrefs) {
        queryClient.setQueryData<NotificationPreferences>(["notification-preferences", user?.id], {
          ...previousPrefs,
          [field]: value,
        });
      }

      return { previousPrefs };
    },
    onError: (err, _, context) => {
      // Rollback on error
      if (context?.previousPrefs) {
        queryClient.setQueryData(["notification-preferences", user?.id], context.previousPrefs);
      }
      toast.error("Failed to update preference");
    },
    onSuccess: () => {
      toast.success("Preference updated");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", user?.id] });
    },
  });
}
