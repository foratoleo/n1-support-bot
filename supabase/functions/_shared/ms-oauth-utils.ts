/**
 * Microsoft OAuth Utilities for Supabase Edge Functions
 *
 * Provides OAuth state management, token refresh, and MS Graph API client
 * for Microsoft 365 calendar integration.
 *
 * @module ms-oauth-utils
 */

// =============================================================================
// Environment Variables
// =============================================================================

/**
 * Get STATE_SIGNING_KEY from environment (loaded lazily)
 */
function getStateSigningKey(): string {
  const key = Deno.env.get("STATE_SIGNING_KEY");
  if (!key) {
    throw new Error("Missing env: STATE_SIGNING_KEY");
  }
  return key;
}

/**
 * Get MS OAuth configuration from environment
 */
export function getMsOAuthConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = Deno.env.get("MS_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("MS_OAUTH_CLIENT_SECRET");
  const redirectUri = Deno.env.get("MS_OAUTH_REDIRECT_URI");

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing MS OAuth env vars: MS_OAUTH_CLIENT_ID, MS_OAUTH_CLIENT_SECRET, MS_OAUTH_REDIRECT_URI"
    );
  }

  return { clientId, clientSecret, redirectUri };
}

// =============================================================================
// Types
// =============================================================================

export interface StatePayload {
  user_id: string;
  redirect_url: string;
  expires_at: number;
  nonce: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface TokenError {
  error: string;
  error_description?: string;
}

export type RefreshTokenResult =
  | TokenResponse
  | { error: string; error_description?: string };

// =============================================================================
// HMAC State Signing
// =============================================================================

/** State expiration time in milliseconds (15 minutes) */
const STATE_EXPIRATION_MS = 15 * 60 * 1000;

/**
 * Sign a message using HMAC-SHA256
 */
async function hmacSign(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getStateSigningKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify HMAC signature using constant-time comparison
 */
async function hmacVerify(message: string, signature: string): Promise<boolean> {
  const expectedSignature = await hmacSign(message);
  // Use constant-time comparison to prevent timing attacks
  if (expectedSignature.length !== signature.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a cryptographically secure random nonce
 */
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create HMAC-signed state parameter for OAuth flow
 *
 * Creates a state string with user_id, redirect_url, expires_at (15 min), and nonce.
 * Format: base64(payload).hmac_signature
 *
 * @param userId - User ID initiating the OAuth flow
 * @param redirectUrl - URL to redirect after OAuth callback
 * @returns Signed state string
 *
 * @example
 * ```typescript
 * const state = await createSignedState('user-123', '/calendar/settings');
 * const authUrl = `https://login.microsoftonline.com/.../authorize?state=${encodeURIComponent(state)}`;
 * ```
 */
export async function createSignedState(
  userId: string,
  redirectUrl: string
): Promise<string> {
  const payload: StatePayload = {
    user_id: userId,
    redirect_url: redirectUrl,
    expires_at: Date.now() + STATE_EXPIRATION_MS,
    nonce: generateNonce(),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = btoa(payloadJson);
  const signature = await hmacSign(payloadBase64);

  return `${payloadBase64}.${signature}`;
}

/**
 * Unsigned state payload from frontend (simpler format)
 */
interface UnsignedStatePayload {
  user_id: string;
  redirect_url: string;
  nonce: string;
  timestamp: number;
}

/**
 * Verify and decode state parameter
 *
 * Supports two formats:
 * 1. HMAC-signed: `base64(payload).hmac_signature` (more secure)
 * 2. Unsigned: `base64(payload)` (simpler, from frontend)
 *
 * Returns the decoded payload if valid, or null if:
 * - Invalid format
 * - Invalid signature (for signed format)
 * - State has expired
 *
 * @param state - The state string to verify
 * @returns Decoded payload with userId, redirectUrl, nonce or null if invalid
 *
 * @example
 * ```typescript
 * const payload = await verifySignedState(state);
 * if (!payload) {
 *   return new Response('Invalid state', { status: 400 });
 * }
 * const { userId, redirectUrl, nonce } = payload;
 * ```
 */
export async function verifySignedState(
  state: string
): Promise<{ userId: string; redirectUrl: string; nonce: string } | null> {
  try {
    const parts = state.split(".");

    // Check if it's HMAC-signed format (2 parts) or unsigned format (1 part)
    if (parts.length === 2) {
      // HMAC-signed format: base64(payload).signature
      return await verifyHmacSignedState(parts[0], parts[1]);
    } else if (parts.length === 1) {
      // Unsigned format from frontend: just base64(payload)
      return verifyUnsignedState(state);
    } else {
      console.error("[OAuth] Invalid state format: unexpected number of parts");
      return null;
    }
  } catch (error) {
    console.error("[OAuth] Error verifying state:", error);
    return null;
  }
}

/**
 * Verify HMAC-signed state format
 */
async function verifyHmacSignedState(
  payloadBase64: string,
  signature: string
): Promise<{ userId: string; redirectUrl: string; nonce: string } | null> {
  if (!payloadBase64 || !signature) {
    console.error("[OAuth] Invalid state format: missing parts");
    return null;
  }

  // Verify HMAC signature
  const isValid = await hmacVerify(payloadBase64, signature);
  if (!isValid) {
    console.error("[OAuth] Invalid state signature");
    return null;
  }

  // Decode payload
  let payloadJson: string;
  try {
    payloadJson = atob(payloadBase64);
  } catch {
    console.error("[OAuth] Invalid base64 in state");
    return null;
  }

  const payload: StatePayload = JSON.parse(payloadJson);

  // Validate required fields
  if (!payload.user_id || !payload.redirect_url || !payload.expires_at || !payload.nonce) {
    console.error("[OAuth] Missing required fields in state payload");
    return null;
  }

  // Check expiration
  if (Date.now() > payload.expires_at) {
    console.error("[OAuth] State expired");
    return null;
  }

  return {
    userId: payload.user_id,
    redirectUrl: payload.redirect_url,
    nonce: payload.nonce,
  };
}

/**
 * Verify unsigned state format (from frontend)
 * Less secure but allows frontend-generated states
 */
function verifyUnsignedState(
  state: string
): { userId: string; redirectUrl: string; nonce: string } | null {
  // Decode payload
  let payloadJson: string;
  try {
    payloadJson = atob(state);
  } catch {
    console.error("[OAuth] Invalid base64 in unsigned state");
    return null;
  }

  let payload: UnsignedStatePayload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    console.error("[OAuth] Invalid JSON in unsigned state");
    return null;
  }

  // Validate required fields
  if (!payload.user_id || !payload.redirect_url || !payload.nonce || !payload.timestamp) {
    console.error("[OAuth] Missing required fields in unsigned state payload");
    return null;
  }

  // Check expiration (15 minutes from timestamp)
  const STATE_EXPIRATION_MS = 15 * 60 * 1000;
  if (Date.now() > payload.timestamp + STATE_EXPIRATION_MS) {
    console.error("[OAuth] Unsigned state expired");
    return null;
  }

  console.log("[OAuth] Verified unsigned state for user:", payload.user_id);

  return {
    userId: payload.user_id,
    redirectUrl: payload.redirect_url,
    nonce: payload.nonce,
  };
}

// =============================================================================
// Token Refresh
// =============================================================================

/**
 * Refresh Microsoft OAuth access token using refresh token
 *
 * Uses environment variables for client credentials if not provided.
 * Handles invalid_grant errors for revoked tokens by returning error object.
 *
 * @param refreshToken - The refresh token to exchange
 * @returns Token response with new access_token, or error object for revoked tokens
 *
 * @example
 * ```typescript
 * const result = await refreshAccessToken(encryptedRefreshToken);
 * if ('error' in result) {
 *   // Token was revoked, need re-authentication
 *   console.log('Token revoked:', result.error_description);
 * } else {
 *   // Success
 *   const { access_token, refresh_token, expires_in } = result;
 * }
 * ```
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshTokenResult> {
  const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const { clientId, clientSecret } = getMsOAuthConfig();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle invalid_grant (revoked tokens)
      if (data.error === "invalid_grant") {
        console.warn("[OAuth] Refresh token is invalid or revoked:", data.error_description);
        return {
          error: data.error,
          error_description: data.error_description || "Token has been revoked or expired",
        };
      }

      // Handle other errors
      console.error("[OAuth] Token refresh failed:", data);
      return {
        error: data.error || "token_refresh_failed",
        error_description: data.error_description || `Token refresh failed: ${response.status}`,
      };
    }

    return data as TokenResponse;
  } catch (error) {
    console.error("[OAuth] Network error during token refresh:", error);
    return {
      error: "network_error",
      error_description: error instanceof Error ? error.message : "Network error during token refresh",
    };
  }
}

// =============================================================================
// Microsoft Graph API Client
// =============================================================================

/** MS Graph API base URL */
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export interface GraphCalendar {
  id: string;
  name: string;
  color: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  owner?: {
    address?: string;
  };
}

/**
 * Microsoft Graph API client interface
 */
export interface GraphClientInterface {
  get: <T = unknown>(path: string) => Promise<T>;
  post: <T = unknown>(path: string, body: unknown) => Promise<T>;
}

/**
 * Error thrown when Graph API request fails
 */
export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "GraphApiError";
  }
}

/**
 * Microsoft Graph API Client
 *
 * Provides methods for interacting with Microsoft Graph API
 * with proper authentication and error handling.
 *
 * @example
 * ```typescript
 * const client = createGraphClient(accessToken);
 *
 * // Get calendars
 * const calendars = await client.listCalendars();
 *
 * // Generic get request
 * const events = await client.get<{ value: Event[] }>('/me/calendar/events');
 *
 * // Generic post request
 * const newEvent = await client.post('/me/calendar/events', { subject: 'Meeting' });
 * ```
 */
export class GraphClient implements GraphClientInterface {
  constructor(private accessToken: string) {}

  /**
   * Make a GET request to MS Graph API
   *
   * @param path - API path (e.g., '/me/calendars')
   * @returns Parsed JSON response
   * @throws GraphApiError on failure
   */
  async get<T = unknown>(path: string): Promise<T> {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE_URL}${path}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a POST request to MS Graph API
   *
   * @param path - API path (e.g., '/me/calendar/events')
   * @param body - Request body
   * @returns Parsed JSON response
   * @throws GraphApiError on failure
   */
  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE_URL}${path}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a PATCH request to MS Graph API
   *
   * @param path - API path
   * @param body - Request body
   * @returns Parsed JSON response
   * @throws GraphApiError on failure
   */
  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE_URL}${path}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  /**
   * Make a DELETE request to MS Graph API
   *
   * @param path - API path
   * @throws GraphApiError on failure
   */
  async delete(path: string): Promise<void> {
    const url = path.startsWith("http") ? path : `${GRAPH_BASE_URL}${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      await this.handleError(response);
    }
  }

  /**
   * List user's calendars
   *
   * @returns Array of calendars
   */
  async listCalendars(): Promise<GraphCalendar[]> {
    const data = await this.get<{ value: GraphCalendar[] }>("/me/calendars");
    return data.value || [];
  }

  /**
   * Get user profile information
   *
   * @returns User profile
   */
  async getUserProfile(): Promise<{
    id: string;
    userPrincipalName: string;
    displayName: string;
    mail: string;
  }> {
    return this.get("/me");
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      await this.handleError(response);
    }

    // Handle empty responses
    const contentLength = response.headers.get("content-length");
    if (contentLength === "0" || response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Handle API error response
   */
  private async handleError(response: Response): Promise<never> {
    let errorMessage = `Graph API error: ${response.status}`;
    let errorCode: string | undefined;
    let requestId: string | undefined;

    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error.message || errorMessage;
        errorCode = errorData.error.code;
      }
    } catch {
      // Response might not be JSON
      const text = await response.text().catch(() => "");
      if (text) {
        errorMessage = `${errorMessage} - ${text}`;
      }
    }

    requestId = response.headers.get("request-id") || undefined;

    console.error("[GraphClient] API error:", {
      status: response.status,
      message: errorMessage,
      code: errorCode,
      requestId,
    });

    throw new GraphApiError(errorMessage, response.status, errorCode, requestId);
  }
}

/**
 * Create a Microsoft Graph API client with access token
 *
 * @param accessToken - Valid MS Graph access token
 * @returns GraphClient instance with get/post methods
 *
 * @example
 * ```typescript
 * const client = createGraphClient(accessToken);
 * const calendars = await client.listCalendars();
 * ```
 */
export function createGraphClient(accessToken: string): GraphClient {
  return new GraphClient(accessToken);
}
