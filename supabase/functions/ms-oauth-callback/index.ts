// file: supabase/functions/ms-oauth-callback/index.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Handle Microsoft OAuth callback, store tokens, create Recall.ai calendar

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifySignedState } from "../_shared/ms-oauth-utils.ts";
import { encryptToken } from "../_shared/encryption.ts";
import { createRecallCalendar } from "./recall-calendar-client.ts";
import { MS_OAUTH_SCOPES_STRING } from "../_shared/ms-oauth-scopes.ts";
import type {
  OAuthTokenResponse,
  IDTokenClaims,
  CalendarConnectionRecord,
} from "./types.ts";

// --- Environment Variables ---
const MS_OAUTH_CLIENT_ID = Deno.env.get("MS_OAUTH_CLIENT_ID") || "";
const MS_OAUTH_CLIENT_SECRET = Deno.env.get("MS_OAUTH_CLIENT_SECRET") || "";
const MS_OAUTH_REDIRECT_URI = Deno.env.get("MS_OAUTH_REDIRECT_URI") || "";
const SUPABASE_URL = Deno.env.get("DB_URL") || Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("DB_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

// Validate required environment variables
const requiredEnvVars = {
  MS_OAUTH_CLIENT_ID,
  MS_OAUTH_CLIENT_SECRET,
  MS_OAUTH_REDIRECT_URI,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
}

// --- Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- CORS Headers ---
// TODO: Restrict Access-Control-Allow-Origin to specific domains in production
// Currently allows all origins (*) for development convenience.
// In production, replace "*" with FRONTEND_URL or a whitelist of allowed origins.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

// --- Helper Functions ---

/**
 * Decode and validate JWT ID token
 * Validates audience (aud) and issuer (iss) claims for security
 */
function decodeJWT(token: string): IDTokenClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims: IDTokenClaims = JSON.parse(decoded);

    // Validate audience claim - must match our client ID
    if (claims.aud && claims.aud !== MS_OAUTH_CLIENT_ID) {
      console.error("[OAuth] JWT audience mismatch: expected", MS_OAUTH_CLIENT_ID, "got", claims.aud);
      return null;
    }

    // Validate issuer claim - must be from Microsoft identity platform
    // Format: https://login.microsoftonline.com/{tenant}/v2.0 or https://sts.windows.net/{tenant}/
    if (claims.iss) {
      const validIssuerPatterns = [
        /^https:\/\/login\.microsoftonline\.com\/[a-f0-9-]+\/v2\.0$/,
        /^https:\/\/sts\.windows\.net\/[a-f0-9-]+\/$/,
        /^https:\/\/login\.microsoftonline\.com\/common\/v2\.0$/,
      ];
      const isValidIssuer = validIssuerPatterns.some((pattern) => pattern.test(claims.iss!));
      if (!isValidIssuer) {
        console.error("[OAuth] JWT issuer invalid:", claims.iss);
        return null;
      }
    }

    return claims;
  } catch (error) {
    console.error("[OAuth] Error decoding JWT:", error);
    return null;
  }
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string): Promise<OAuthTokenResponse> {
  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

  // IMPORTANT: Use the same scopes as authorization request
  // Microsoft requires scope consistency between authorization and token exchange
  console.log("[OAuth] Token exchange starting...");
  console.log("[OAuth] Scopes:", MS_OAUTH_SCOPES_STRING);
  console.log("[OAuth] Redirect URI:", MS_OAUTH_REDIRECT_URI);
  console.log("[OAuth] Client ID:", MS_OAUTH_CLIENT_ID?.substring(0, 8) + "...");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: MS_OAUTH_CLIENT_ID,
    client_secret: MS_OAUTH_CLIENT_SECRET,
    redirect_uri: MS_OAUTH_REDIRECT_URI,
    scope: MS_OAUTH_SCOPES_STRING,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("[OAuth] Token exchange failed:", response.status);
    console.error("[OAuth] Error response:", errorData);
    throw new Error(`Token exchange failed: ${response.status} - ${errorData}`);
  }

  const tokenResponse = await response.json();
  console.log("[OAuth] Token exchange successful!");
  console.log("[OAuth] Access token length:", tokenResponse.access_token?.length);
  console.log("[OAuth] Refresh token length:", tokenResponse.refresh_token?.length);
  console.log("[OAuth] Scopes granted:", tokenResponse.scope);

  return tokenResponse;
}

/**
 * Upsert calendar connection to database
 */
async function upsertCalendarConnection(
  userId: string,
  tokenResponse: OAuthTokenResponse,
  idTokenClaims: IDTokenClaims | null,
  recallCalendarId: string | null
): Promise<CalendarConnectionRecord> {
  // Encrypt tokens
  const accessTokenEncrypted = await encryptToken(tokenResponse.access_token);
  const refreshTokenEncrypted = await encryptToken(tokenResponse.refresh_token);

  // Calculate token expiration time
  const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

  // Extract Microsoft-specific fields from ID token
  const tenantId = idTokenClaims?.tid || null;
  const userPrincipalName = idTokenClaims?.upn || idTokenClaims?.preferred_username || null;

  const connectionRecord: Omit<CalendarConnectionRecord, "id" | "created_at" | "updated_at"> = {
    user_id: userId,
    provider: "microsoft",
    access_token_encrypted: accessTokenEncrypted,
    refresh_token_encrypted: refreshTokenEncrypted,
    token_expires_at: expiresAt.toISOString(),
    ms_tenant_id: tenantId,
    ms_user_principal_name: userPrincipalName,
    recall_calendar_id: recallCalendarId,
    recall_calendar_status: recallCalendarId ? "active" : "pending",
    connection_status: "connected",
    last_sync_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_calendar_connections")
    .upsert(connectionRecord, {
      onConflict: "user_id,provider",
    })
    .select()
    .single();

  if (error) {
    console.error("[Database] Error upserting calendar connection:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log("[Database] Calendar connection upserted:", data.id);
  return data;
}

/**
 * Create Recall.ai Calendar V2 connection
 */
async function setupRecallCalendar(
  refreshToken: string
): Promise<string | null> {
  const webhookUrl = `${SUPABASE_URL}/functions/v1/recall-calendar-webhook`;

  const result = await createRecallCalendar({
    platform: "microsoft_outlook",
    oauth_client_id: MS_OAUTH_CLIENT_ID,
    oauth_client_secret: MS_OAUTH_CLIENT_SECRET,
    oauth_refresh_token: refreshToken,
    webhook_url: webhookUrl,
  });

  if ("error" in result) {
    console.error("[RecallCalendar] Failed to create calendar:", result.error);
    return null;
  }

  return result.id;
}

/**
 * Generate redirect response to frontend callback page
 *
 * Redirects the popup to the frontend callback page which handles:
 * 1. Sending postMessage to parent window
 * 2. Closing the popup
 *
 * @param status - success or error
 * @param connectionId - The connection ID if successful
 * @param errorCode - The error code if failed
 */
function generateCallbackRedirect(
  status: "success" | "error",
  connectionId?: string,
  errorCode?: string
): Response {
  const isSuccess = status === "success";
  const params = new URLSearchParams();

  params.set("success", isSuccess.toString());

  if (connectionId) {
    params.set("connection_id", connectionId);
  }

  if (errorCode) {
    params.set("error_code", errorCode);
    params.set("error", getErrorMessage(errorCode));
  }

  const redirectUrl = `${FRONTEND_URL}/auth/calendar-callback?${params.toString()}`;

  console.log(`[OAuth] Redirecting to frontend: ${redirectUrl}`);

  return new Response(null, {
    status: 302,
    headers: {
      ...CORS,
      "Location": redirectUrl,
    },
  });
}

// Keep old function name as alias for backward compatibility
const generateCallbackHTML = generateCallbackRedirect;

/**
 * Get user-friendly error message for error codes
 */
function getErrorMessage(errorCode: string): string {
  const messages: Record<string, string> = {
    missing_params: "Missing required parameters. Please try again.",
    invalid_state: "Invalid authentication state. Please try again.",
    token_exchange_failed: "Failed to exchange authorization code. Please try again.",
    database_error: "Failed to save connection. Please try again.",
    unexpected_error: "An unexpected error occurred. Please try again.",
    access_denied: "Access was denied. Please grant the required permissions.",
    consent_required: "Additional consent is required. Please try again.",
    unknown: "An unknown error occurred. Please try again.",
  };
  return messages[errorCode] || messages.unknown;
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    // Only allow GET
    if (req.method !== "GET") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed" } },
        { status: 405, headers: CORS }
      );
    }

    // Parse query parameters
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    // Check for OAuth errors from Microsoft
    if (error) {
      console.error("[OAuth] Microsoft OAuth error:", error, errorDescription);
      return generateCallbackHTML("error", undefined, error);
    }

    // Validate required parameters
    if (!code || !state) {
      console.error("[OAuth] Missing code or state parameter");
      return generateCallbackHTML("error", undefined, "missing_params");
    }

    // Verify state (supports both HMAC-signed and unsigned formats)
    const statePayload = await verifySignedState(state);
    if (!statePayload) {
      console.error("[OAuth] Invalid or expired state");
      return generateCallbackHTML("error", undefined, "invalid_state");
    }

    const { userId } = statePayload;

    console.log(`[OAuth] Processing callback for user: ${userId}`);

    // Exchange authorization code for tokens
    let tokenResponse: OAuthTokenResponse;
    try {
      tokenResponse = await exchangeCodeForTokens(code);
    } catch (err) {
      console.error("[OAuth] Token exchange error:", err);
      return generateCallbackHTML("error", undefined, "token_exchange_failed");
    }

    // Decode ID token to extract user info
    const idTokenClaims = tokenResponse.id_token
      ? decodeJWT(tokenResponse.id_token)
      : null;

    console.log("[OAuth] Token exchange successful, tenant:", idTokenClaims?.tid);

    // Create Recall.ai Calendar V2
    let recallCalendarId: string | null = null;
    try {
      recallCalendarId = await setupRecallCalendar(tokenResponse.refresh_token);
      if (recallCalendarId) {
        console.log("[RecallCalendar] Calendar created:", recallCalendarId);
      } else {
        console.warn("[RecallCalendar] Calendar creation returned null, continuing without it");
      }
    } catch (err) {
      console.error("[RecallCalendar] Error creating calendar:", err);
      // Continue without Recall calendar - user can retry later
    }

    // Store encrypted tokens in database
    let connection: CalendarConnectionRecord;
    try {
      connection = await upsertCalendarConnection(
        userId,
        tokenResponse,
        idTokenClaims,
        recallCalendarId
      );
    } catch (err) {
      console.error("[Database] Error storing connection:", err);
      return generateCallbackHTML("error", undefined, "database_error");
    }

    console.log(`[OAuth] Calendar connection successful for user ${userId}`);

    // Return HTML page that sends postMessage to parent window and closes popup
    return generateCallbackHTML("success", connection.id);
  } catch (err: any) {
    console.error("[OAuth] Unexpected error:", err);
    return generateCallbackHTML("error", undefined, "unexpected_error");
  }
});
