import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type MembershipAction =
  | "invite"
  | "change-role"
  | "remove"
  | "leave"
  | "suspend"
  | "reactivate"
  | "transfer-ownership"
  | "set-primary";

interface RequestBody {
  action: MembershipAction;
  targetUserId?: string;
  targetBusinessId?: string;
  membershipId?: string;
  newRole?: string;
  email?: string;
  reason?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any, "public", any>;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user client for auth validation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for privileged operations
    const adminClient: AdminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { action } = body;

    console.log(`[membership-management] Action: ${action}, User: ${user.id}`);

    let result: unknown;

    switch (action) {
      case "change-role":
        result = await changeRole(adminClient, user.id, body);
        break;

      case "remove":
        result = await removeMember(adminClient, user.id, body);
        break;

      case "leave":
        result = await leaveBusiness(adminClient, user.id, body);
        break;

      case "suspend":
        result = await suspendMember(adminClient, user.id, body);
        break;

      case "reactivate":
        result = await reactivateMember(adminClient, user.id, body);
        break;

      case "transfer-ownership":
        result = await transferOwnership(adminClient, user.id, body);
        break;

      case "set-primary":
        result = await setPrimaryBusiness(adminClient, user.id, body);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[membership-management] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper to check if user has role in business
async function getUserRoleInBusiness(
  client: AdminClient,
  userId: string,
  businessId: string
): Promise<string | null> {
  const { data } = await client
    .from("business_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .eq("status", "active")
    .single();
  return data?.role || null;
}

// Helper to log audit entry
async function logAudit(
  client: AdminClient,
  membershipId: string,
  userId: string,
  businessId: string,
  action: string,
  performedBy: string,
  oldRole?: string | null,
  newRole?: string | null,
  reason?: string | null,
  metadata?: Record<string, unknown>
) {
  await client.from("business_membership_audit").insert({
    membership_id: membershipId,
    user_id: userId,
    business_id: businessId,
    action,
    performed_by: performedBy,
    old_role: oldRole,
    new_role: newRole,
    reason,
    metadata,
  });
}

// Change a member's role
async function changeRole(
  client: AdminClient,
  performerId: string,
  body: RequestBody
) {
  const { membershipId, newRole, reason } = body;
  if (!membershipId || !newRole) {
    throw new Error("membershipId and newRole are required");
  }

  // Get the target membership
  const { data: membership, error: membershipError } = await client
    .from("business_memberships")
    .select("*")
    .eq("id", membershipId)
    .single();

  if (membershipError || !membership) {
    throw new Error("Membership not found");
  }

  // Check performer has permission (owner or admin)
  const performerRole = await getUserRoleInBusiness(client, performerId, membership.business_id);
  if (!performerRole || !["owner", "admin"].includes(performerRole)) {
    throw new Error("You do not have permission to change roles");
  }

  // Cannot change owner's role unless you're the owner
  if (membership.role === "owner" && performerRole !== "owner") {
    throw new Error("Only the owner can change their own role");
  }

  // Cannot promote to owner
  if (newRole === "owner") {
    throw new Error("Use transfer-ownership to make someone an owner");
  }

  const oldRole = membership.role;

  // Update membership
  const { error: updateError } = await client
    .from("business_memberships")
    .update({ role: newRole })
    .eq("id", membershipId);

  if (updateError) throw updateError;

  // Also update legacy user_roles table
  await client.from("user_roles").delete().eq("user_id", membership.user_id);
  await client.from("user_roles").insert({ user_id: membership.user_id, role: newRole });

  // If user's active context is this business, update active_role
  await client
    .from("profiles")
    .update({ active_role: newRole })
    .eq("id", membership.user_id)
    .eq("active_business_id", membership.business_id);

  // Log audit
  await logAudit(
    client,
    membershipId,
    membership.user_id,
    membership.business_id,
    "role_changed",
    performerId,
    oldRole,
    newRole,
    reason
  );

  return { success: true, newRole };
}

// Remove a member from business
async function removeMember(
  client: AdminClient,
  performerId: string,
  body: RequestBody
) {
  const { membershipId, reason } = body;
  if (!membershipId) throw new Error("membershipId is required");

  const { data: membership, error } = await client
    .from("business_memberships")
    .select("*")
    .eq("id", membershipId)
    .single();

  if (error || !membership) throw new Error("Membership not found");

  // Check performer has permission
  const performerRole = await getUserRoleInBusiness(client, performerId, membership.business_id);
  if (!performerRole || !["owner", "admin"].includes(performerRole)) {
    throw new Error("You do not have permission to remove members");
  }

  // Cannot remove owner
  if (membership.role === "owner") {
    throw new Error("Cannot remove the owner. Transfer ownership first.");
  }

  // Cannot remove yourself (use leave instead)
  if (membership.user_id === performerId) {
    throw new Error("Use the leave action to remove yourself");
  }

  // Update status to removed
  await client
    .from("business_memberships")
    .update({ status: "removed" })
    .eq("id", membershipId);

  // Clear user's active context if this was their active business
  await client
    .from("profiles")
    .update({ active_business_id: null, active_role: null })
    .eq("id", membership.user_id)
    .eq("active_business_id", membership.business_id);

  // Log audit
  await logAudit(
    client,
    membershipId,
    membership.user_id,
    membership.business_id,
    "removed",
    performerId,
    membership.role,
    null,
    reason
  );

  return { success: true };
}

// Leave a business voluntarily
async function leaveBusiness(
  client: AdminClient,
  userId: string,
  body: RequestBody
) {
  const { targetBusinessId, reason } = body;
  if (!targetBusinessId) throw new Error("targetBusinessId is required");

  const { data: membership, error } = await client
    .from("business_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", targetBusinessId)
    .eq("status", "active")
    .single();

  if (error || !membership) throw new Error("You are not a member of this business");

  // Cannot leave if you're the only owner
  if (membership.role === "owner") {
    const { data: owners } = await client
      .from("business_memberships")
      .select("id")
      .eq("business_id", targetBusinessId)
      .eq("role", "owner")
      .eq("status", "active");

    if (!owners || owners.length <= 1) {
      throw new Error("You are the only owner. Transfer ownership first.");
    }
  }

  // Update status to left
  await client
    .from("business_memberships")
    .update({ status: "left" })
    .eq("id", membership.id);

  // Clear active context if this was active
  await client
    .from("profiles")
    .update({ active_business_id: null, active_role: null })
    .eq("id", userId)
    .eq("active_business_id", targetBusinessId);

  // Log audit
  await logAudit(
    client,
    membership.id,
    userId,
    targetBusinessId,
    "left",
    userId,
    membership.role,
    null,
    reason
  );

  return { success: true };
}

// Suspend a member temporarily
async function suspendMember(
  client: AdminClient,
  performerId: string,
  body: RequestBody
) {
  const { membershipId, reason } = body;
  if (!membershipId) throw new Error("membershipId is required");

  const { data: membership, error } = await client
    .from("business_memberships")
    .select("*")
    .eq("id", membershipId)
    .single();

  if (error || !membership) throw new Error("Membership not found");

  // Check performer has permission (owner only for suspend)
  const performerRole = await getUserRoleInBusiness(client, performerId, membership.business_id);
  if (performerRole !== "owner") {
    throw new Error("Only the owner can suspend members");
  }

  if (membership.role === "owner") {
    throw new Error("Cannot suspend the owner");
  }

  // Update status
  await client
    .from("business_memberships")
    .update({ status: "suspended" })
    .eq("id", membershipId);

  // Clear active context
  await client
    .from("profiles")
    .update({ active_business_id: null, active_role: null })
    .eq("id", membership.user_id)
    .eq("active_business_id", membership.business_id);

  // Log audit
  await logAudit(
    client,
    membershipId,
    membership.user_id,
    membership.business_id,
    "suspended",
    performerId,
    null,
    null,
    reason
  );

  return { success: true };
}

// Reactivate a suspended member
async function reactivateMember(
  client: AdminClient,
  performerId: string,
  body: RequestBody
) {
  const { membershipId, reason } = body;
  if (!membershipId) throw new Error("membershipId is required");

  const { data: membership, error } = await client
    .from("business_memberships")
    .select("*")
    .eq("id", membershipId)
    .single();

  if (error || !membership) throw new Error("Membership not found");

  if (membership.status !== "suspended") {
    throw new Error("Member is not suspended");
  }

  // Check performer has permission (owner only)
  const performerRole = await getUserRoleInBusiness(client, performerId, membership.business_id);
  if (performerRole !== "owner") {
    throw new Error("Only the owner can reactivate members");
  }

  // Update status
  await client
    .from("business_memberships")
    .update({ status: "active" })
    .eq("id", membershipId);

  // Log audit
  await logAudit(
    client,
    membershipId,
    membership.user_id,
    membership.business_id,
    "reactivated",
    performerId,
    null,
    null,
    reason
  );

  return { success: true };
}

// Transfer ownership to another member
async function transferOwnership(
  client: AdminClient,
  ownerId: string,
  body: RequestBody
) {
  const { targetUserId, targetBusinessId, reason } = body;
  if (!targetUserId || !targetBusinessId) {
    throw new Error("targetUserId and targetBusinessId are required");
  }

  // Check current user is owner
  const { data: ownerMembership } = await client
    .from("business_memberships")
    .select("*")
    .eq("user_id", ownerId)
    .eq("business_id", targetBusinessId)
    .eq("role", "owner")
    .eq("status", "active")
    .single();

  if (!ownerMembership) {
    throw new Error("You are not the owner of this business");
  }

  // Check target is active member
  const { data: targetMembership } = await client
    .from("business_memberships")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("business_id", targetBusinessId)
    .eq("status", "active")
    .single();

  if (!targetMembership) {
    throw new Error("Target user is not an active member");
  }

  // Demote current owner to admin
  await client
    .from("business_memberships")
    .update({ role: "admin" })
    .eq("id", ownerMembership.id);

  // Promote target to owner
  await client
    .from("business_memberships")
    .update({ role: "owner" })
    .eq("id", targetMembership.id);

  // Update legacy user_roles
  await client.from("user_roles").delete().eq("user_id", ownerId);
  await client.from("user_roles").insert({ user_id: ownerId, role: "admin" });
  await client.from("user_roles").delete().eq("user_id", targetUserId);
  await client.from("user_roles").insert({ user_id: targetUserId, role: "owner" });

  // Update active roles if needed
  await client
    .from("profiles")
    .update({ active_role: "admin" })
    .eq("id", ownerId)
    .eq("active_business_id", targetBusinessId);

  await client
    .from("profiles")
    .update({ active_role: "owner" })
    .eq("id", targetUserId)
    .eq("active_business_id", targetBusinessId);

  // Log audit for both
  await logAudit(
    client,
    ownerMembership.id,
    ownerId,
    targetBusinessId,
    "ownership_transferred_from",
    ownerId,
    "owner",
    "admin",
    reason
  );

  await logAudit(
    client,
    targetMembership.id,
    targetUserId,
    targetBusinessId,
    "ownership_transferred_to",
    ownerId,
    targetMembership.role,
    "owner",
    reason
  );

  return { success: true, newOwnerId: targetUserId };
}

// Set primary business for user
async function setPrimaryBusiness(
  client: AdminClient,
  userId: string,
  body: RequestBody
) {
  const { targetBusinessId } = body;
  if (!targetBusinessId) throw new Error("targetBusinessId is required");

  // Check user has active membership
  const { data: membership, error } = await client
    .from("business_memberships")
    .select("*")
    .eq("user_id", userId)
    .eq("business_id", targetBusinessId)
    .eq("status", "active")
    .single();

  if (error || !membership) {
    throw new Error("You are not a member of this business");
  }

  // Clear other primaries
  await client
    .from("business_memberships")
    .update({ is_primary: false })
    .eq("user_id", userId)
    .neq("business_id", targetBusinessId);

  // Set this as primary
  await client
    .from("business_memberships")
    .update({ is_primary: true })
    .eq("id", membership.id);

  return { success: true };
}
