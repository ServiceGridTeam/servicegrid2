import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptToken, encryptToken } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate?: string;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

function base64UrlDecode(str: string): string {
  // Replace URL-safe characters and add padding
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

function getHeader(headers: Array<{ name: string; value: string }> | undefined, name: string): string | undefined {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function extractEmailBody(payload: GmailMessage["payload"]): { text: string; html: string } {
  let text = "";
  let html = "";

  if (payload?.body?.data) {
    text = base64UrlDecode(payload.body.data);
  }

  if (payload?.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = base64UrlDecode(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = base64UrlDecode(part.body.data);
      }
    }
  }

  return { text, html };
}

async function generateContentHash(from: string, subject: string, body: string): Promise<string> {
  const content = `${from}|${subject}|${body.slice(0, 500)}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      console.error("Token refresh failed:", await response.text());
      return null;
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

async function syncConnection(supabase: any, connection: any): Promise<{ synced: number; errors: number }> {
  console.log(`Syncing connection ${connection.id} (${connection.email_address})`);

  let accessToken: string;
  let tokenRefreshed = false;

  // Check if token needs refresh (expires in less than 5 minutes)
  const tokenExpiresAt = new Date(connection.token_expires_at);
  if (tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log("Token expiring soon, refreshing...");
    
    const refreshToken = await decryptToken(connection.encrypted_refresh_token);
    const newTokens = await refreshGoogleToken(refreshToken);
    
    if (!newTokens) {
      console.error("Failed to refresh token");
      await supabase
        .from("email_connections")
        .update({
          connection_health: "error",
          sync_errors_count: connection.sync_errors_count + 1,
          last_error_message: "Failed to refresh OAuth token",
          last_error_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
      return { synced: 0, errors: 1 };
    }

    accessToken = newTokens.accessToken;
    tokenRefreshed = true;

    // Save new access token
    await supabase
      .from("email_connections")
      .update({
        encrypted_access_token: await encryptToken(accessToken),
        token_expires_at: newTokens.expiresAt.toISOString(),
      })
      .eq("id", connection.id);
  } else {
    accessToken = await decryptToken(connection.encrypted_access_token);
  }

  // Build query - fetch messages newer than last sync
  let query = "is:inbox";
  if (connection.last_sync_message_id) {
    // Gmail's after: uses message internal date, not ID
    // We'll filter by date instead for more reliable results
  }

  try {
    // List recent messages (max 20 per sync)
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("q", query);
    listUrl.searchParams.set("maxResults", "20");

    const listResponse = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("Gmail list failed:", errorText);
      throw new Error(`Gmail API error: ${listResponse.status}`);
    }

    const listData: GmailListResponse = await listResponse.json();
    const messageRefs = listData.messages || [];

    if (messageRefs.length === 0) {
      console.log("No new messages");
      await supabase
        .from("email_connections")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connection.id);
      return { synced: 0, errors: 0 };
    }

    console.log(`Found ${messageRefs.length} messages to process`);

    let synced = 0;
    let errors = 0;
    let latestMessageId = connection.last_sync_message_id;

    for (const ref of messageRefs) {
      // Skip if we've already processed this message
      if (connection.last_sync_message_id === ref.id) {
        continue;
      }

      // Check if already exists
      const { data: existing } = await supabase
        .from("inbound_emails")
        .select("id")
        .eq("connection_id", connection.id)
        .eq("provider_message_id", ref.id)
        .limit(1);

      if (existing && existing.length > 0) {
        continue;
      }

      // Fetch full message
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!msgResponse.ok) {
        console.error(`Failed to fetch message ${ref.id}`);
        errors++;
        continue;
      }

      const message: GmailMessage = await msgResponse.json();
      
      // Skip messages in trash or spam
      if (message.labelIds?.includes("TRASH") || message.labelIds?.includes("SPAM")) {
        continue;
      }

      const headers = message.payload?.headers || [];
      const fromHeader = getHeader(headers, "From") || "";
      const toHeader = getHeader(headers, "To") || "";
      const subject = getHeader(headers, "Subject") || "";
      
      // Parse from address and name
      const fromMatch = fromHeader.match(/(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?/);
      const fromName = fromMatch?.[1]?.trim() || null;
      const fromAddress = fromMatch?.[2]?.trim() || fromHeader;

      const { text, html } = extractEmailBody(message.payload);
      const receivedAt = new Date(parseInt(message.internalDate || "0")).toISOString();

      // Generate content hash for deduplication
      const contentHash = await generateContentHash(fromAddress, subject, text);

      // Check for duplicates
      const { data: duplicateCheck } = await supabase
        .rpc("check_email_duplicate", {
          p_thread_id: message.threadId,
          p_content_hash: contentHash,
          p_from_address: fromAddress,
          p_connection_id: connection.id,
        });

      const isDuplicate = duplicateCheck?.[0]?.is_duplicate || false;
      const duplicateOfId = duplicateCheck?.[0]?.duplicate_of_id || null;

      // Insert email
      const { data: insertedEmail, error: insertError } = await supabase
        .from("inbound_emails")
        .insert({
          business_id: connection.business_id,
          connection_id: connection.id,
          provider_message_id: ref.id,
          thread_id: message.threadId,
          from_address: fromAddress,
          from_name: fromName,
          to_address: toHeader,
          subject,
          body_text: text,
          body_html: html,
          received_at: receivedAt,
          content_hash: contentHash,
          is_duplicate: isDuplicate,
          duplicate_of_id: duplicateOfId,
          status: isDuplicate ? "ignored" : "new",
          classification_stage: isDuplicate ? "complete" : "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error(`Failed to insert email ${ref.id}:`, insertError);
        errors++;
        continue;
      }

      // Track latest message for next sync
      if (!latestMessageId || ref.id > latestMessageId) {
        latestMessageId = ref.id;
      }

      synced++;

      // Trigger classification for non-duplicates
      if (!isDuplicate && insertedEmail) {
        supabase.functions.invoke("classify-email", {
          body: { email_id: insertedEmail.id },
        }).catch((e: Error) => console.error("Classification trigger failed:", e));
      }
    }

    // Update connection sync status
    await supabase
      .from("email_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_message_id: latestMessageId,
        connection_health: errors > synced ? "warning" : "healthy",
        sync_errors_count: errors > 0 ? connection.sync_errors_count + errors : 0,
      })
      .eq("id", connection.id);

    return { synced, errors };
  } catch (error) {
    console.error(`Sync error for connection ${connection.id}:`, error);
    
    await supabase
      .from("email_connections")
      .update({
        connection_health: "error",
        sync_errors_count: connection.sync_errors_count + 1,
        last_error_message: error instanceof Error ? error.message : "Unknown error",
        last_error_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    return { synced: 0, errors: 1 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if triggered for a specific connection
    let connectionId: string | null = null;
    try {
      const body = await req.json();
      connectionId = body?.connection_id;
    } catch {
      // No body or invalid JSON - sync all
    }

    // Fetch active connections that need syncing
    let query = supabase
      .from("email_connections")
      .select("*")
      .eq("is_active", true)
      .eq("provider", "gmail");

    if (connectionId) {
      query = query.eq("id", connectionId);
    } else {
      // Only sync connections that haven't been synced in their poll interval
      // For now, sync all active connections (cron will handle interval)
    }

    const { data: connections, error: fetchError } = await query;

    if (fetchError) {
      console.error("Failed to fetch connections:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch connections" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active connections to sync" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Syncing ${connections.length} connection(s)`);

    const results = [];
    for (const connection of connections) {
      const result = await syncConnection(supabase, connection);
      results.push({
        connection_id: connection.id,
        email: connection.email_address,
        ...result,
      });
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

    console.log(`Sync complete: ${totalSynced} emails synced, ${totalErrors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        connections_synced: results.length,
        emails_synced: totalSynced,
        errors: totalErrors,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email sync error:", error);
    return new Response(
      JSON.stringify({ error: "Sync failed", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
