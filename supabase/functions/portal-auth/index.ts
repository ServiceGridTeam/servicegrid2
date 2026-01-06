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
  customerName?: string;
}

interface AuditLogParams {
  customerId: string;
  businessId: string;
  customerAccountId?: string;
  eventType: "invite_sent" | "login" | "first_login" | "access_revoked";
  eventDetails?: Record<string, unknown>;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}

async function createAuditLog(supabase: any, params: AuditLogParams) {
  try {
    const { error } = await supabase.from("portal_access_audit").insert({
      customer_id: params.customerId,
      business_id: params.businessId,
      customer_account_id: params.customerAccountId,
      event_type: params.eventType,
      event_details: params.eventDetails || {},
      performed_by: params.performedBy,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    });
    if (error) {
      console.error("[portal-auth] Failed to create audit log:", error);
    }
  } catch (err) {
    console.error("[portal-auth] Audit log error:", err);
  }
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
        return await handleValidateMagicLink(supabase, body, req, resendApiKey);
      case "login-password":
        return await handlePasswordLogin(supabase, body, req, resendApiKey);
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
      case "send-invite":
        return await handleSendInvite(supabase, body, resendApiKey, req);
      case "revoke-access":
        return await handleRevokeAccess(supabase, body, req);
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

async function handleValidateMagicLink(supabase: any, body: ActionRequest, req: Request, resendApiKey: string | undefined) {
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

  // Check if this is first login before updating
  const { data: accountData } = await supabase
    .from("customer_accounts")
    .select("login_count")
    .eq("id", account.id)
    .single();
  
  const isFirstLogin = !accountData?.login_count || accountData.login_count === 0;

  // Update account last login
  await supabase
    .from("customer_accounts")
    .update({
      last_login_at: new Date().toISOString(),
      login_count: (accountData?.login_count || 0) + 1,
    })
    .eq("id", account.id);

  // Create audit log for login
  const customerName = invite.customers
    ? `${invite.customers.first_name} ${invite.customers.last_name}`
    : null;
  
  await createAuditLog(supabase, {
    customerId: invite.customer_id,
    businessId: invite.business_id,
    customerAccountId: account.id,
    eventType: isFirstLogin ? "first_login" : "login",
    eventDetails: { method: "magic_link" },
    ipAddress: ipAddress,
    userAgent: userAgent,
  });

  // Send first login notification if applicable
  if (isFirstLogin && invite.business_id && invite.customer_id) {
    // Fire and forget - don't block the login response
    sendFirstLoginNotification(supabase, resendApiKey, {
      customerId: invite.customer_id,
      businessId: invite.business_id,
      customerName: customerName || "",
      customerEmail: invite.email,
    }).catch((err) => console.error("[portal-auth] First login notification error:", err));
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
    activeBusinessId: invite.business_id,
    activeCustomerId: invite.customer_id,
    businesses,
    customerName: invite.customers
      ? `${invite.customers.first_name} ${invite.customers.last_name}`
      : null,
  });
}

async function handlePasswordLogin(supabase: any, body: ActionRequest, req: Request, resendApiKey: string | undefined) {
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

  // Check if this is first login before updating
  const isFirstLogin = !account.login_count || account.login_count === 0;

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

  // Create audit log for login
  if (primaryLink?.business_id && primaryLink?.customer_id) {
    await createAuditLog(supabase, {
      customerId: primaryLink.customer_id,
      businessId: primaryLink.business_id,
      customerAccountId: account.id,
      eventType: isFirstLogin ? "first_login" : "login",
      eventDetails: { method: "password" },
      ipAddress: ipAddress,
      userAgent: userAgent,
    });
  }

  // Send first login notification if applicable
  if (isFirstLogin && primaryLink?.business_id && primaryLink?.customer_id) {
    // Fire and forget - don't block the login response
    sendFirstLoginNotification(supabase, resendApiKey, {
      customerId: primaryLink.customer_id,
      businessId: primaryLink.business_id,
      customerName: "",
      customerEmail: account.email,
    }).catch((err) => console.error("[portal-auth] First login notification error:", err));
  }

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

async function handleSendInvite(
  supabase: any,
  body: ActionRequest,
  resendApiKey: string | undefined,
  req: Request
) {
  const { customerId, businessId, email, customerName } = body;
  
  if (!customerId || !businessId) {
    return errorResponse("Customer ID and Business ID are required", 400);
  }

  // Get customer details if email not provided
  let customerEmail = email;
  let displayName = customerName;
  
  if (!customerEmail) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("email, first_name, last_name")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return errorResponse("Customer not found", 404);
    }

    if (!customer.email) {
      return errorResponse("Customer has no email address", 400);
    }

    customerEmail = customer.email;
    displayName = `${customer.first_name} ${customer.last_name}`;
  }

  // Get business details for branding
  const { data: business } = await supabase
    .from("businesses")
    .select("name, logo_url")
    .eq("id", businessId)
    .single();

  // Find or create customer account
  let { data: account } = await supabase
    .from("customer_accounts")
    .select("id")
    .eq("email", customerEmail!.toLowerCase())
    .single();

  if (!account) {
    const { data: newAccount, error: createError } = await supabase
      .from("customer_accounts")
      .insert({
        email: customerEmail!.toLowerCase(),
        auth_method: "magic_link",
        email_verified: false,
      })
      .select()
      .single();

    if (createError) {
      console.error("[portal-auth] Failed to create account:", createError);
      return errorResponse("Failed to create customer account", 500);
    }
    account = newAccount;
  }

  // Create or update customer account link
  const { data: existingLink } = await supabase
    .from("customer_account_links")
    .select("id")
    .eq("customer_account_id", account.id)
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .single();

  if (!existingLink) {
    await supabase.from("customer_account_links").insert({
      customer_account_id: account.id,
      customer_id: customerId,
      business_id: businessId,
      is_primary: true,
      status: "active",
    });
  }

  // Generate magic link token
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Create portal invite record
  const { error: inviteError } = await supabase
    .from("customer_portal_invites")
    .insert({
      invite_token: token,
      email: customerEmail!.toLowerCase(),
      customer_id: customerId,
      business_id: businessId,
      expires_at: expiresAt.toISOString(),
      status: "pending",
    });

  if (inviteError) {
    console.error("[portal-auth] Failed to create invite:", inviteError);
    return errorResponse("Failed to generate invite", 500);
  }

  // Send email via Resend
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app");
      const portalUrl = `${baseUrl}/portal/magic/${token}`;
      const businessName = business?.name || "ServiceGrid";

      await resend.emails.send({
        from: "ServiceGrid <noreply@resend.dev>",
        to: [customerEmail!],
        subject: `Access Your ${businessName} Customer Portal`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to ${businessName}</h2>
            <p>Hi${displayName ? ` ${displayName}` : ''},</p>
            <p>You've been invited to access your customer portal where you can view quotes, invoices, schedule appointments, and more.</p>
            <a href="${portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Access Your Portal
            </a>
            <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't expect this email, you can safely ignore it.</p>
          </div>
        `,
      });
      console.log(`[portal-auth] Portal invite sent to ${customerEmail}`);
    } catch (emailError) {
      console.error("[portal-auth] Failed to send invite email:", emailError);
      return errorResponse("Failed to send invite email", 500);
    }
  } else {
    console.warn("[portal-auth] No RESEND_API_KEY configured, skipping email");
    return errorResponse("Email service not configured", 500);
  }

  // Create audit log for invite
  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || "0.0.0.0";

  await createAuditLog(supabase, {
    customerId,
    businessId,
    customerAccountId: account.id,
    eventType: "invite_sent",
    eventDetails: { email: customerEmail },
    ipAddress,
    userAgent,
  });

  return successResponse({ 
    success: true, 
    message: "Portal invite sent",
    email: customerEmail
  });
}

async function handleRevokeAccess(supabase: any, body: ActionRequest, req: Request) {
  const { customerId, businessId } = body;
  
  if (!customerId || !businessId) {
    return errorResponse("Customer ID and Business ID are required", 400);
  }

  console.log(`[portal-auth] Revoking access for customer ${customerId} from business ${businessId}`);

  // Find the customer_account_link
  const { data: link, error: linkError } = await supabase
    .from("customer_account_links")
    .select("id, customer_account_id")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .eq("status", "active")
    .single();

  if (linkError || !link) {
    console.log("[portal-auth] No active link found:", linkError);
    return errorResponse("No active portal access found for this customer", 404);
  }

  // Update link status to revoked
  const { error: updateError } = await supabase
    .from("customer_account_links")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", link.id);

  if (updateError) {
    console.error("[portal-auth] Failed to revoke link:", updateError);
    return errorResponse("Failed to revoke access", 500);
  }

  // Revoke all active sessions for this account/business combination
  const { error: sessionError } = await supabase
    .from("customer_portal_sessions")
    .update({ is_revoked: true })
    .eq("customer_account_id", link.customer_account_id)
    .eq("active_business_id", businessId)
    .eq("is_revoked", false);

  if (sessionError) {
    console.warn("[portal-auth] Failed to revoke sessions:", sessionError);
    // Don't fail the request - the link is already revoked
  }

  // Create audit log for revocation
  const userAgent = req.headers.get("user-agent") || "";
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || "0.0.0.0";

  await createAuditLog(supabase, {
    customerId,
    businessId,
    customerAccountId: link.customer_account_id,
    eventType: "access_revoked",
    ipAddress,
    userAgent,
  });

  console.log(`[portal-auth] Successfully revoked access for customer ${customerId}`);
  return successResponse({ success: true, message: "Portal access revoked" });
}

async function sendFirstLoginNotification(
  supabase: any,
  resendApiKey: string | undefined,
  params: {
    customerId: string;
    businessId: string;
    customerName: string;
    customerEmail: string;
  }
) {
  const { customerId, businessId, customerName, customerEmail } = params;
  
  console.log(`[portal-auth] Sending first login notification for ${customerEmail}`);

  // Fetch business details
  const { data: business } = await supabase
    .from("businesses")
    .select("name, email")
    .eq("id", businessId)
    .single();

  if (!business) {
    console.warn("[portal-auth] Business not found for notification");
    return;
  }

  // Get business team members (profiles linked to this business)
  const { data: members } = await supabase
    .from("business_memberships")
    .select("user_id, profiles(id, email)")
    .eq("business_id", businessId)
    .eq("status", "active");

  // Create in-app notifications for team (respecting preferences)
  if (members && members.length > 0) {
    for (const member of members) {
      // Check notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("inapp_portal_activity")
        .eq("user_id", member.user_id)
        .single();

      // Only create notification if preference is enabled (default true)
      if (prefs?.inapp_portal_activity !== false) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            user_id: member.user_id,
            business_id: businessId,
            type: "portal",
            title: `${customerName || customerEmail} logged into the portal`,
            message: `Your customer has successfully accessed their portal for the first time.`,
            data: { customerId, customerEmail },
          });

        if (notifError) {
          console.error("[portal-auth] Failed to create notification:", notifError);
        }
      }
    }
  }

  // Send email notification to team members who have the preference enabled
  if (resendApiKey && members && members.length > 0) {
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app");
    
    for (const member of members) {
      const memberEmail = member.profiles?.email;
      if (!memberEmail) continue;

      // Check notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("email_portal_first_login")
        .eq("user_id", member.user_id)
        .single();

      // Only send email if preference is enabled (default true)
      if (prefs?.email_portal_first_login !== false) {
        try {
          const resend = new Resend(resendApiKey);
          
          await resend.emails.send({
            from: "ServiceGrid <noreply@resend.dev>",
            to: [memberEmail],
            subject: `${customerName || customerEmail} just logged into their portal`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>🎉 New Portal Login</h2>
                <p>Great news! <strong>${customerName || "A customer"}</strong> (${customerEmail}) has successfully logged into their customer portal for the first time.</p>
                <p>They now have access to:</p>
                <ul>
                  <li>View and approve quotes</li>
                  <li>Pay invoices online</li>
                  <li>Request service appointments</li>
                  <li>Track job progress</li>
                </ul>
                <a href="${baseUrl}/customers/${customerId}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                  View Customer
                </a>
                <p style="color: #666; font-size: 14px;">— ${business.name || "ServiceGrid"}</p>
              </div>
            `,
          });
          console.log(`[portal-auth] First login notification email sent to ${memberEmail}`);
        } catch (emailError) {
          console.error("[portal-auth] Failed to send first login email:", emailError);
        }
      }
    }
  }
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
