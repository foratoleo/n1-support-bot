// file: supabase/functions/ms-oauth-callback/types.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Type definitions for MS OAuth callback function

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

export interface IDTokenClaims {
  aud: string;
  iss: string;
  iat: number;
  nbf: number;
  exp: number;
  name?: string;
  oid?: string;
  preferred_username?: string;
  sub?: string;
  tid?: string;
  upn?: string;
  email?: string;
}

export interface CalendarConnectionRecord {
  id?: string;
  user_id: string;
  provider: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  ms_tenant_id: string | null;
  ms_user_principal_name: string | null;
  recall_calendar_id: string | null;
  recall_calendar_status: string;
  connection_status: string;
  last_sync_at?: string;
  last_error?: string;
  created_at?: string;
  updated_at?: string;
}
