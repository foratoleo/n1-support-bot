/**
 * Microsoft OAuth Scopes - Centralized Configuration
 *
 * IMPORTANT: All Microsoft OAuth functions MUST use these scopes to ensure consistency.
 * Inconsistent scopes between authorization, token exchange, and refresh can cause
 * token revocation errors (invalid_grant).
 *
 * @module ms-oauth-scopes
 */

/**
 * OAuth scopes requested during authorization.
 * These scopes determine what permissions the user grants to the application.
 *
 * Scope descriptions:
 * - openid: OpenID Connect authentication (required for id_token)
 * - profile: User profile information
 * - email: User email address
 * - offline_access: Enables refresh tokens (CRITICAL for long-lived connections)
 * - Calendars.Read: Read calendar data
 * - Calendars.ReadWrite: Create/update calendar events
 */
export const MS_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "Calendars.Read",
  "Calendars.ReadWrite",
] as const;

/**
 * Scopes as space-separated string (for OAuth requests)
 */
export const MS_OAUTH_SCOPES_STRING = MS_OAUTH_SCOPES.join(" ");

/**
 * Scopes for token refresh requests.
 *
 * According to Microsoft documentation, you can either:
 * 1. Omit scope entirely (server uses original scopes from authorization)
 * 2. Specify same or subset of original scopes
 *
 * We use option 1 (omit scope) for maximum compatibility, as specifying
 * different scopes can cause invalid_grant errors.
 *
 * If you need to specify scopes, use MS_OAUTH_REFRESH_SCOPES_STRING.
 */
export const MS_OAUTH_REFRESH_SCOPES = [
  "offline_access",
  "Calendars.Read",
  "Calendars.ReadWrite",
] as const;

export const MS_OAUTH_REFRESH_SCOPES_STRING = MS_OAUTH_REFRESH_SCOPES.join(" ");

/**
 * Validate that required scopes are present in a token response.
 *
 * @param scopeString - Space-separated scope string from token response
 * @returns Object with validation result and missing scopes
 */
export function validateScopes(scopeString: string): {
  valid: boolean;
  missingScopes: string[];
  grantedScopes: string[];
} {
  const grantedScopes = scopeString.split(" ").map((s) => s.trim().toLowerCase());
  const requiredScopes = ["offline_access", "calendars.read"];

  const missingScopes = requiredScopes.filter(
    (required) => !grantedScopes.some((granted) => granted.toLowerCase() === required)
  );

  return {
    valid: missingScopes.length === 0,
    missingScopes,
    grantedScopes,
  };
}
