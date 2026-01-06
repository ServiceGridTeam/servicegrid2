import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  periodType?: "weekly" | "biweekly" | "semimonthly" | "monthly";
  startDate?: string;
  count?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's business
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(
        JSON.stringify({ error: "No business found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: GenerateRequest = await req.json();
    const periodType = body.periodType || "weekly";
    const count = body.count || 1;

    // Find the last pay period to continue from
    const { data: lastPeriod } = await supabase
      .from("pay_periods")
      .select("end_date")
      .eq("business_id", profile.business_id)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Calculate start date
    let startDate: Date;
    if (body.startDate) {
      startDate = new Date(body.startDate);
    } else if (lastPeriod) {
      startDate = new Date(lastPeriod.end_date);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      // Default to start of current week (Sunday)
      startDate = new Date();
      const day = startDate.getDay();
      startDate.setDate(startDate.getDate() - day);
      startDate.setHours(0, 0, 0, 0);
    }

    const periods = [];

    for (let i = 0; i < count; i++) {
      let endDate: Date;

      switch (periodType) {
        case "weekly":
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          break;
        case "biweekly":
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 13);
          break;
        case "semimonthly":
          // 1-15 or 16-end of month
          if (startDate.getDate() <= 15) {
            endDate = new Date(startDate.getFullYear(), startDate.getMonth(), 15);
          } else {
            endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          }
          break;
        case "monthly":
          endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
          break;
        default:
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
      }

      periods.push({
        business_id: profile.business_id,
        period_type: periodType,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        status: "open",
      });

      // Move to next period
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() + 1);
    }

    console.log(`Generating ${periods.length} pay periods for business ${profile.business_id}`);

    const { data, error } = await supabase
      .from("pay_periods")
      .insert(periods)
      .select();

    if (error) {
      console.error("Error creating pay periods:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Created ${data.length} pay periods successfully`);

    return new Response(
      JSON.stringify({ success: true, periods: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
