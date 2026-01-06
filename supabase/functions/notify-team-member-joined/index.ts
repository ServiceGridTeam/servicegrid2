import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createNotification } from "../_shared/notifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyTeamMemberJoinedRequest {
  userId: string;
  businessId: string;
  role: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: NotifyTeamMemberJoinedRequest = await req.json();
    const { userId, businessId, role } = body;

    console.log(`Sending notification for new team member: ${userId} joined as ${role}`);

    // Fetch new member's info
    const { data: newMember, error: memberError } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", userId)
      .single();

    if (memberError || !newMember) {
      console.error("Failed to fetch new member:", memberError);
      return new Response(
        JSON.stringify({ error: "Member not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const memberName = newMember.first_name && newMember.last_name
      ? `${newMember.first_name} ${newMember.last_name}`.trim()
      : newMember.email || "A new member";

    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    // Get all existing team members (except the new one)
    const { data: existingMembers, error: membersError } = await supabase
      .from("profiles")
      .select("id")
      .eq("business_id", businessId)
      .neq("id", userId);

    if (membersError) {
      console.error("Failed to fetch existing members:", membersError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch team members" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = { notified: 0, skipped: 0, failed: 0 };

    // Notify each existing team member
    for (const member of existingMembers || []) {
      const result = await createNotification(supabase, {
        userId: member.id,
        businessId,
        type: "team",
        title: "New Team Member",
        message: `${memberName} has joined your team as ${roleLabel}`,
        data: { 
          newUserId: userId, 
          firstName: newMember.first_name,
          lastName: newMember.last_name,
          role 
        },
      });

      if (result.success && !result.skipped) results.notified++;
      else if (result.skipped) results.skipped++;
      else results.failed++;
    }

    console.log(`Team member joined notification result: ${JSON.stringify(results)}`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-team-member-joined:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
