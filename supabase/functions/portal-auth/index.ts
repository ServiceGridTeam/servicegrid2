import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ActionRequest {
  action: string;
  email?: string;
  password?: string;
  token?: string;
  sessionToken?: string;
  businessId?: string;
  customerId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: ActionRequest = await req.json();
    const { action } = body;

    console.log(`[portal-auth] Action: ${action}`);

    switch (action) {
      case "generate-magic-link":
        return await handleGenerateMagicLink(supabase, body, resendApiKey);
      case "validate-magic-link":
        return await handleValidateMagicLink(supabase, body, req);
      case "login-password":
        return await handlePasswordLogin(supabase, body, req);
      case "create-password":
        return await handleCreatePassword(supabase, body);
      case "validate-session":
        return await handleValidateSession(supabase, body);
      case "refresh-session":
        return await handleRefreshSession(supabase, body);
      case "logout":
        return await handleLogout(supabase, body);
      case "switch-context":
        return await handleSwitchContext(supabase, body);
      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[portal-auth] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleGenerateMagicLink(
  supabase: any,
  body: ActionRequest,
  resendApiKey: string | undefined
) {
  const { email } = body;
  if (!email) {
    return errorResponse("Email is required", 400);
  }

  // Find customer account by email
  const { data: account, error: accountError } = await supabase
    .from("customer_accounts")
    .select("id, email")
    .eq("email", email.toLowerCase())
    .single();

  if (accountError || !account) {
    // Don't reveal if account exists - return success anyway
    console.log(`[portal-auth] No account found for ${email}, returning success anyway`);
    return successResponse({ success: true, message: "If an account exists, a magic link will be sent" });
  }

  // Generate magic link token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Get first linked customer to find business for branding
  const { data: link } = await supabase
    .from("customer_account_links")
    .select("business_id, customer_id, businesses(name, logo_url)")
    .eq("customer_account_id", account.id)
    .eq("status", "active")
    .limit(1)
    .single();

  // Create portal invite/magic link record
  const { error: inviteError } = await supabase
    .from("customer_portal_invites")
    .insert({
      invite_token: token,
      email: email.toLowerCase(),
      customer_id: link?.customer_id,
      business_id: link?.business_id,
      expires_at: expiresAt.toISOString(),
      status: "pending",
    });

  if (inviteError) {
    console.error("[portal-auth] Failed to create invite:", inviteError);
    return errorResponse("Failed to generate magic link", 500);
  }

  // Send email via Resend
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const portalUrl = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/portal/magic/${token}`;
      const businessName = link?.businesses?.name || "ServiceGrid";

      await resend.emails.send({
        from: "ServiceGrid <noreply@resend.dev>",
        to: email,
        subject: `Sign in to ${businessName} Portal`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Sign in to ${businessName}</h2>
            <p>Click the button below to sign in to your customer portal:</p>
            <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Sign In to Portal
            </a>
            <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
      console.log(`[portal-auth] Magic link email sent to ${email}`);
    } catch (emailError) {
      console.error("[portal-auth] Failed to send email:", emailError);
      // Don't fail the request - the link is still valid
    }
  }

  return successResponse({ success: true, message: "Magic link sent" });
}

async function handleValidateMagicLink(supabase: any, body: ActionRequest, req: Request) {
  const { token } = body;
  if (!token) {
    return errorResponse("Token is required", 400);
  }

  // Find the invite
  const { data: invite, error: inviteError } = await supabase
    .from("customer_portal_invites")
    .select("*, customers(first_name, last_name), businesses(id, name, logo_url)")
    .eq("invite_token", token)
    .eq("status", "pending")
    .single();

  if (inviteError || !invite) {
    return errorResponse("Invalid or expired link", 400);
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from("customer_portal_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);
    return errorResponse("Link has expired", 400);
  }

  // Find or create customer account
  let { data: account } = await supabase
    .from("customer_accounts")
    .select("id")
    .eq("email", invite.email.toLowerCase())
    .single();

  if (!account) {
    // Create new customer account
    const { data: newAccount, error: createError } = await supabase
      .from("customer_accounts")
      .insert({
        email: invite.email.toLowerCase(),
        auth_method: "magic_link",
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error("[portal-auth] Failed to create account:", createError);
      return errorResponse("Failed to create account", 500);
    }
    account = newAccount;

    // Link account to customer
    if (invite.customer_id && invite.business_id) {
      await supabase.from("customer_account_links").insert({
        customer_account_id: account.id,
        customer_id: invite.customer_id,
        business_id: invite.business_id,
        is_primary: true,
        status: "active",
      });
    }
  }

  // Mark invite as accepted
  await supabase
    .from("customer_portal_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Create session
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || "0.0.0.0";

  const { error: sessionError } = await supabase
    .from("customer_portal_sessions")
    .insert({
      token: sessionToken,
      customer_account_id: account.id,
      expires_at: expiresAt.toISOString(),
      user_agent: userAgent,
      ip_address: ipAddress,
      active_business_id: invite.business_id,
      active_customer_id: invite.customer_id,
    });

  if (sessionError) {
    console.error("[portal-auth] Failed to create session:", sessionError);
    return errorResponse("Failed to create session", 500);
  }

  // Update account last login
  await supabase
    .from("customer_accounts")
    .update({
      last_login_at: new Date().toISOString(),
      login_count: (account.login_count || 0) + 1,
    })
    .eq("id", account.id);

  // Get all linked businesses
  const { data: links } = await supabase
    .from("customer_account_links")
    .select("business_id, customer_id, is_primary, businesses(id, name, logo_url)")
    .eq("customer_account_id", account.id)
    .eq("status", "active");

  const businesses = links?.map((l: any) => ({
    id: l.business_id,
    customerId: l.customer_id,
    name: l.businesses?.name,
    logoUrl: l.businesses?.logo_url,
    isPrimary: l.is_primary,
  })) || [];

  return successResponse({
    sessionToken,
    customerAccountId: account.id,
    activeBusinessId: invite.business_id,
    activeCustomerId: invite.customer_id,
    businesses,
    customerName: invite.customers
      ? `${invite.customers.first_name} ${invite.customers.last_name}`
      : null,
  });
}

async function handlePasswordLogin(supabase: any, body: ActionRequest, req: Request) {
  const { email, password } = body;
  if (!email || !password) {
    return errorResponse("Email and password are required", 400);
  }

  // Find account
  const { data: account, error: accountError } = await supabase
    .from("customer_accounts")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (accountError || !account) {
    return errorResponse("Invalid email or password", 401);
  }

  // Check if locked
  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    return errorResponse("Account is temporarily locked. Please try again later.", 403);
  }

  // Verify password (using simple hash comparison - in production use bcrypt)
  if (!account.password_hash) {
    return errorResponse("Password login not set up. Please use magic link.", 400);
  }

  // Simple password verification (in production, use proper bcrypt)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + account.id);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (hashHex !== account.password_hash) {
    // Increment failed attempts
    const failedAttempts = (account.failed_login_attempts || 0) + 1;
    const updates: any = { failed_login_attempts: failedAttempts };

    // Lock after 5 failed attempts
    if (failedAttempts >= 5) {
      updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    await supabase
      .from("customer_accounts")
      .update(updates)
      .eq("id", account.id);

    return errorResponse("Invalid email or password", 401);
  }

  // Reset failed attempts on success
  await supabase
    .from("customer_accounts")
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      login_count: (account.login_count || 0) + 1,
    })
    .eq("id", account.id);

  // Create session
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || "0.0.0.0";

  // Get primary business
  const { data: primaryLink } = await supabase
    .from("customer_account_links")
    .select("business_id, customer_id, businesses(id, name, logo_url)")
    .eq("customer_account_id", account.id)
    .eq("status", "active")
    .eq("is_primary", true)
    .single();

  const { error: sessionError } = await supabase
    .from("customer_portal_sessions")
    .insert({
      token: sessionToken,
      customer_account_id: account.id,
      expires_at: expiresAt.toISOString(),
      user_agent: userAgent,
      ip_address: ipAddress,
      active_business_id: primaryLink?.business_id,
      active_customer_id: primaryLink?.customer_id,
    });

  if (sessionError) {
    console.error("[portal-auth] Failed to create session:", sessionError);
    return errorResponse("Failed to create session", 500);
  }

  // Get all linked businesses
  const { data: links } = await supabase
    .from("customer_account_links")
    .select("business_id, customer_id, is_primary, businesses(id, name, logo_url)")
    .eq("customer_account_id", account.id)
    .eq("status", "active");

  const businesses = links?.map((l: any) => ({
    id: l.business_id,
    customerId: l.customer_id,
    name: l.businesses?.name,
    logoUrl: l.businesses?.logo_url,
    isPrimary: l.is_primary,
  })) || [];

  return successResponse({
    sessionToken,
    customerAccountId: account.id,
    activeBusinessId: primaryLink?.business_id,
    activeCustomerId: primaryLink?.customer_id,
    businesses,
  });
}

async function handleCreatePassword(supabase: any, body: ActionRequest) {
  const { sessionToken, password } = body;
  if (!sessionToken || !password) {
    return errorResponse("Session token and password are required", 400);
  }

  // Validate session
  const { data: session } = await supabase
    .from("customer_portal_sessions")
    .select("customer_account_id")
    .eq("token", sessionToken)
    .eq("is_revoked", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return errorResponse("Invalid session", 401);
  }

  // Hash password
  const encoder = new TextEncoder();
  const data = encoder.encode(password + session.customer_account_id);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Update account
  await supabase
    .from("customer_accounts")
    .update({
      password_hash: hashHex,
      auth_method: "password",
    })
    .eq("id", session.customer_account_id);

  return successResponse({ success: true });
}

async function handleValidateSession(supabase: any, body: ActionRequest) {
  const { sessionToken } = body;
  if (!sessionToken) {
    return errorResponse("Session token is required", 400);
  }

  const { data: session, error } = await supabase
    .from("customer_portal_sessions")
    .select(`
      *,
      customer_accounts(id, email)
    `)
    .eq("token", sessionToken)
    .eq("is_revoked", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !session) {
    return errorResponse("Invalid or expired session", 401);
  }

  // Update last active
  await supabase
    .from("customer_portal_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", session.id);

  // Get linked businesses
  const { data: links } = await supabase
    .from("customer_account_links")
    .select("business_id, customer_id, is_primary, businesses(id, name, logo_url)")
    .eq("customer_account_id", session.customer_account_id)
    .eq("status", "active");

  const businesses = links?.map((l: any) => ({
    id: l.business_id,
    customerId: l.customer_id,
    name: l.businesses?.name,
    logoUrl: l.businesses?.logo_url,
    isPrimary: l.is_primary,
  })) || [];

  return successResponse({
    valid: true,
    customerAccountId: session.customer_account_id,
    activeBusinessId: session.active_business_id,
    activeCustomerId: session.active_customer_id,
    businesses,
    email: session.customer_accounts?.email,
  });
}

async function handleRefreshSession(supabase: any, body: ActionRequest) {
  const { sessionToken } = body;
  if (!sessionToken) {
    return errorResponse("Session token is required", 400);
  }

  const { data: session, error } = await supabase
    .from("customer_portal_sessions")
    .select("*")
    .eq("token", sessionToken)
    .eq("is_revoked", false)
    .single();

  if (error || !session) {
    return errorResponse("Invalid session", 401);
  }

  // Extend expiry by 30 days
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await supabase
    .from("customer_portal_sessions")
    .update({
      expires_at: newExpiry.toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return successResponse({ success: true, expiresAt: newExpiry.toISOString() });
}

async function handleLogout(supabase: any, body: ActionRequest) {
  const { sessionToken } = body;
  if (!sessionToken) {
    return errorResponse("Session token is required", 400);
  }

  await supabase
    .from("customer_portal_sessions")
    .update({ is_revoked: true })
    .eq("token", sessionToken);

  return successResponse({ success: true });
}

async function handleSwitchContext(supabase: any, body: ActionRequest) {
  const { sessionToken, businessId, customerId } = body;
  if (!sessionToken || !businessId || !customerId) {
    return errorResponse("Session token, business ID, and customer ID are required", 400);
  }

  // Validate session
  const { data: session, error } = await supabase
    .from("customer_portal_sessions")
    .select("id, customer_account_id")
    .eq("token", sessionToken)
    .eq("is_revoked", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !session) {
    return errorResponse("Invalid session", 401);
  }

  // Verify the customer has access to this business
  const { data: link } = await supabase
    .from("customer_account_links")
    .select("id")
    .eq("customer_account_id", session.customer_account_id)
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("status", "active")
    .single();

  if (!link) {
    return errorResponse("Access denied to this business", 403);
  }

  // Update session context
  await supabase
    .from("customer_portal_sessions")
    .update({
      active_business_id: businessId,
      active_customer_id: customerId,
      last_active_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return successResponse({ success: true });
}

function successResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
