import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type NotificationType = 
  | "quote" 
  | "invoice" 
  | "payment" 
  | "job" 
  | "team" 
  | "geofence"
  | "timesheet";

export interface CreateNotificationParams {
  userId: string;
  businessId: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  skipPreferenceCheck?: boolean;
}

// Map notification types to preference field names
const TYPE_TO_PREF: Record<NotificationType, string> = {
  quote: "inapp_quote_activity",
  invoice: "inapp_invoice_activity",
  payment: "inapp_payment_activity",
  job: "inapp_job_activity",
  team: "inapp_team_activity",
  geofence: "inapp_geofence_alerts",
  timesheet: "inapp_timesheet_activity",
};

export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationParams
): Promise<{ success: boolean; skipped?: boolean; reason?: string; error?: string }> {
  const { userId, businessId, type, title, message, data, skipPreferenceCheck } = params;

  // Check user preferences unless explicitly skipped
  if (!skipPreferenceCheck) {
    const prefField = TYPE_TO_PREF[type];
    
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select(prefField)
      .eq("user_id", userId)
      .single();

    // If preferences exist and this type is disabled, skip
    const prefValue = prefs ? (prefs as unknown as Record<string, unknown>)[prefField] : undefined;
    if (prefValue === false) {
      console.log(`Skipping ${type} notification for user ${userId} - preference disabled`);
      return { success: true, skipped: true, reason: "user_preference_disabled" };
    }
  }

  // Insert the notification
  const { error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      business_id: businessId,
      type,
      title,
      message,
      data: data || {},
    });

  if (error) {
    console.error("Failed to create notification:", error);
    return { success: false, error: error.message };
  }

  console.log(`Created ${type} notification for user ${userId}: ${title}`);
  return { success: true };
}

// Helper to notify all team members of a business
export async function notifyBusinessTeam(
  supabase: SupabaseClient,
  businessId: string,
  params: Omit<CreateNotificationParams, "userId" | "businessId">
): Promise<{ notified: number; skipped: number; failed: number }> {
  // Get all team members
  const { data: members, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("business_id", businessId);

  if (error || !members) {
    console.error("Failed to fetch team members:", error);
    return { notified: 0, skipped: 0, failed: 1 };
  }

  const results = { notified: 0, skipped: 0, failed: 0 };

  for (const member of members) {
    const result = await createNotification(supabase, {
      ...params,
      userId: member.id,
      businessId,
    });

    if (result.success && !result.skipped) results.notified++;
    else if (result.skipped) results.skipped++;
    else results.failed++;
  }

  return results;
}

// Helper to check email preference before sending
export async function shouldSendEmail(
  supabase: SupabaseClient,
  userId: string,
  emailPrefField: string
): Promise<boolean> {
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select(emailPrefField)
    .eq("user_id", userId)
    .single();

  // Default to true if no preferences set
  if (!prefs) return true;
  
  const prefValue = (prefs as unknown as Record<string, unknown>)[emailPrefField];
  return prefValue !== false;
}
