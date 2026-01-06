import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PortalInvite {
  id: string;
  email: string;
  customer_id: string;
  business_id: string;
  invite_token: string;
  expires_at: string;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  customers: {
    first_name: string;
    last_name: string;
  } | null;
  businesses: {
    name: string;
    logo_url: string | null;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.warn("[process-portal-invite-reminders] No RESEND_API_KEY configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    console.log("[process-portal-invite-reminders] Starting reminder processing...");

    // Find pending invites eligible for reminders:
    // - Status is 'pending'
    // - Not expired (expires_at > now)
    // - Created at least 24 hours ago
    // - Last reminder sent more than 3 days ago (or never)
    // - Reminder count < 3
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: invites, error: fetchError } = await supabase
      .from("customer_portal_invites")
      .select(`
        id,
        email,
        customer_id,
        business_id,
        invite_token,
        expires_at,
        reminder_count,
        last_reminder_sent_at,
        customers(first_name, last_name),
        businesses(name, logo_url)
      `)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .lt("created_at", oneDayAgo)
      .lt("reminder_count", 3)
      .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${threeDaysAgo}`)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("[process-portal-invite-reminders] Failed to fetch invites:", fetchError);
      throw fetchError;
    }

    console.log(`[process-portal-invite-reminders] Found ${invites?.length || 0} invites needing reminders`);

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    if (!invites || invites.length === 0) {
      return new Response(
        JSON.stringify({ success: true, ...results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = supabaseUrl.replace(".supabase.co", ".lovable.app");

    for (const invite of invites as unknown as PortalInvite[]) {
      results.processed++;

      try {
        const businessName = invite.businesses?.name || "ServiceGrid";
        const customerName = invite.customers
          ? `${invite.customers.first_name} ${invite.customers.last_name}`
          : null;
        const portalUrl = `${baseUrl}/portal/magic/${invite.invite_token}`;
        const expiryDate = new Date(invite.expires_at).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const reminderNumber = (invite.reminder_count || 0) + 1;
        const subject = reminderNumber === 1
          ? `Reminder: Your ${businessName} portal access is waiting`
          : `Final Reminder: Access your ${businessName} portal`;

        await resend.emails.send({
          from: "ServiceGrid <noreply@resend.dev>",
          to: [invite.email],
          subject,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Your Customer Portal Awaits</h2>
              <p>Hi${customerName ? ` ${customerName}` : ""},</p>
              <p>You received an invitation to access your <strong>${businessName}</strong> customer portal, but haven't logged in yet.</p>
              <p>With your portal access, you can:</p>
              <ul>
                <li>View and approve quotes</li>
                <li>Pay invoices online</li>
                <li>Request service appointments</li>
                <li>Track job progress in real-time</li>
              </ul>
              <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                Login to Portal
              </a>
              <p style="color: #666; font-size: 14px;">This invitation expires on ${expiryDate}.</p>
              <p style="color: #666; font-size: 14px;">If you have any questions, please contact ${businessName}.</p>
            </div>
          `,
        });

        // Update invite reminder tracking
        await supabase
          .from("customer_portal_invites")
          .update({
            reminder_count: reminderNumber,
            last_reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", invite.id);

        // Log to audit
        await supabase.from("portal_access_audit").insert({
          customer_id: invite.customer_id,
          business_id: invite.business_id,
          event_type: "reminder_sent",
          event_details: {
            email: invite.email,
            reminder_number: reminderNumber,
            invite_id: invite.id,
          },
        });

        console.log(`[process-portal-invite-reminders] Sent reminder ${reminderNumber} to ${invite.email}`);
        results.sent++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[process-portal-invite-reminders] Failed to send reminder to ${invite.email}:`, errorMsg);
        results.failed++;
        results.errors.push(`${invite.email}: ${errorMsg}`);
      }
    }

    console.log(`[process-portal-invite-reminders] Complete. Sent: ${results.sent}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[process-portal-invite-reminders] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
