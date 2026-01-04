import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  invite_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { invite_id }: InviteEmailRequest = await req.json();
    
    if (!invite_id) {
      throw new Error("invite_id is required");
    }

    console.log(`Fetching invite: ${invite_id}`);

    // Fetch invite with business and inviter details
    const { data: invite, error: inviteError } = await supabase
      .from("team_invites")
      .select(`
        *,
        business:businesses(name),
        inviter:profiles!invited_by(first_name, last_name, email)
      `)
      .eq("id", invite_id)
      .single();

    if (inviteError || !invite) {
      console.error("Invite fetch error:", inviteError);
      throw new Error("Invite not found");
    }

    console.log(`Sending invite email to: ${invite.email}`);

    const businessName = invite.business?.name || "A business";
    const inviterName = invite.inviter
      ? `${invite.inviter.first_name} ${invite.inviter.last_name}`.trim() || invite.inviter.email
      : "A team member";

    // Get the origin from the request or use a default
    const origin = req.headers.get("origin") || "https://servicegrid.app";
    const inviteUrl = `${origin}/invite/${invite.token}`;

    const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <tr>
                  <td style="background-color: #18181b; padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ServiceGrid</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="color: #18181b; margin: 0 0 20px; font-size: 20px;">You've been invited!</h2>
                    <p style="color: #52525b; line-height: 1.6; margin: 0 0 20px;">
                      <strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> on ServiceGrid as a <strong>${roleLabel}</strong>.
                    </p>
                    <p style="color: #52525b; line-height: 1.6; margin: 0 0 30px;">
                      Click the button below to accept this invitation and set up your account.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${inviteUrl}" style="display: inline-block; background-color: #18181b; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 30px 0 0;">
                      This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #fafafa; padding: 20px; text-align: center; border-top: 1px solid #e4e4e7;">
                    <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} ServiceGrid. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ServiceGrid <onboarding@resend.dev>",
        to: [invite.email],
        subject: `You're invited to join ${businessName} on ServiceGrid`,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(errorData.message || "Failed to send email");
    }

    const emailResult = await emailResponse.json();

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-team-invite-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
