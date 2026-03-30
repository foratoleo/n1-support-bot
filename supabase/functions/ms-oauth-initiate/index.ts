/**
 * MS OAuth Initiate Edge Function
 *
 * Generates HMAC-signed OAuth state and returns the full authorization URL.
 * This endpoint should be called by the frontend to initiate the OAuth flow
 * securely, without exposing the signing key client-side.
 *
 * @endpoint POST /functions/v1/ms-oauth-initiate
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createSignedState, getMsOAuthConfig } from "../_shared/ms-oauth-utils.ts";
import { MS_OAUTH_SCOPES_STRING } from "../_shared/ms-oauth-scopes.ts";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Microsoft OAuth authorization endpoint
const MS_OAUTH_AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

interface InitiateRequest {
  redirect_url: string;
}

interface InitiateResponse {
  success: true;
  auth_url: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    const response: ErrorResponse = {
      success: false,
      error: "Method not allowed",
      code: "method_not_allowed",
    };
    return new Response(JSON.stringify(response), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      const response: ErrorResponse = {
        success: false,
        error: "Missing or invalid authorization header",
        code: "unauthorized",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[ms-oauth-initiate] Auth error:", authError);
      const response: ErrorResponse = {
        success: false,
        error: "Authentication failed",
        code: "auth_failed",
      };
      return new Response(JSON.stringify(response), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body: InitiateRequest = await req.json();
    const { redirect_url } = body;

    if (!redirect_url) {
      const response: ErrorResponse = {
        success: false,
        error: "Missing redirect_url in request body",
        code: "invalid_request",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate redirect_url is a relative path or same-origin
    if (redirect_url.startsWith("http") && !redirect_url.startsWith(Deno.env.get("FRONTEND_URL") || "")) {
      const response: ErrorResponse = {
        success: false,
        error: "Invalid redirect_url: must be relative path or same-origin",
        code: "invalid_redirect_url",
      };
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[ms-oauth-initiate] Creating signed state for user:", user.id);

    // Create HMAC-signed state
    const signedState = await createSignedState(user.id, redirect_url);

    // Get OAuth config
    const { clientId, redirectUri } = getMsOAuthConfig();

    // Build OAuth authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: MS_OAUTH_SCOPES_STRING,
      state: signedState,
      response_mode: "query",
      prompt: "consent",
    });

    const authUrl = `${MS_OAUTH_AUTHORIZE_URL}?${params.toString()}`;

    console.log("[ms-oauth-initiate] Generated auth URL for user:", user.id);

    const response: InitiateResponse = {
      success: true,
      auth_url: authUrl,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ms-oauth-initiate] Error:", error);

    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const response: ErrorResponse = {
      success: false,
      error: errorMessage,
      code: "internal_error",
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
