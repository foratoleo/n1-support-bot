/**
 * MS Token Refresh Edge Function
 *
 * Proactively refreshes Microsoft OAuth tokens before they expire.
 * Designed to be called via Supabase CRON job (weekly recommended).
 *
 * Features:
 * - Refreshes tokens expiring within configurable threshold (default: 14 days)
 * - Updates both access_token and refresh_token (rolling 90-day window)
 * - Marks revoked/expired connections appropriately
 * - Logs execution results to calendar_token_refresh_log table
 *
 * Request body (optional):
 * {
 *   "days_threshold": 14,  // Refresh tokens expiring within N days
 *   "dry_run": false,      // If true, only report what would be refreshed
 *   "connection_id": "..." // Optional: refresh specific connection only
 * }
 *
 * @module ms-token-refresh
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { encryptToken, decryptToken } from '../_shared/encryption.ts';
import { MS_OAUTH_REFRESH_SCOPES_STRING } from '../_shared/ms-oauth-scopes.ts';

// ============================================
// CORS Headers
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================
// Types
// ============================================

interface TokenRefreshRequest {
  /** Refresh tokens expiring within N days (default: 14) */
  days_threshold?: number;
  /** If true, only report what would be refreshed without actually refreshing */
  dry_run?: boolean;
  /** Optional: refresh specific connection only */
  connection_id?: string;
}

interface ConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  connection_status: string;
  ms_user_principal_name: string | null;
  last_error: string | null;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface RefreshResult {
  connection_id: string;
  user_id: string;
  email: string | null;
  status: 'refreshed' | 'revoked' | 'error' | 'skipped';
  old_expires_at: string;
  new_expires_at?: string;
  error_message?: string;
}

interface TokenRefreshResponse {
  success: boolean;
  dry_run: boolean;
  days_threshold: number;
  total_connections: number;
  refreshed: number;
  revoked: number;
  errors: number;
  skipped: number;
  results: RefreshResult[];
  execution_time_ms: number;
}

// ============================================
// Environment Configuration
// ============================================

const MS_OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

function getEnvOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ============================================
// Token Refresh Logic
// ============================================

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse | { error: string; error_description: string }> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: MS_OAUTH_REFRESH_SCOPES_STRING,
  });

  const response = await fetch(MS_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      error: data.error || 'token_refresh_failed',
      error_description: data.error_description || `Token refresh failed: ${response.status}`,
    };
  }

  return data as TokenResponse;
}

/**
 * Get connections with tokens expiring within threshold
 */
async function getExpiringConnections(
  supabase: ReturnType<typeof createClient>,
  daysThreshold: number,
  specificConnectionId?: string
): Promise<ConnectionRow[]> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysThreshold);

  let query = supabase
    .from('user_calendar_connections')
    .select('*')
    .eq('provider', 'microsoft')
    .eq('connection_status', 'connected')
    .lt('token_expires_at', threshold.toISOString());

  if (specificConnectionId) {
    query = query.eq('id', specificConnectionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ms-token-refresh] Error fetching expiring connections:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  return (data || []) as ConnectionRow[];
}

/**
 * Update connection with new tokens
 */
async function updateConnectionTokens(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  encryptedAccessToken: string,
  encryptedRefreshToken: string,
  expiresAt: Date
): Promise<void> {
  const { error } = await supabase
    .from('user_calendar_connections')
    .update({
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      token_expires_at: expiresAt.toISOString(),
      connection_status: 'connected',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId);

  if (error) {
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }
}

/**
 * Mark connection as revoked or error
 */
async function markConnectionFailed(
  supabase: ReturnType<typeof createClient>,
  connectionId: string,
  status: 'revoked' | 'expired' | 'error',
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from('user_calendar_connections')
    .update({
      connection_status: status,
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId);

  if (error) {
    console.error(`[ms-token-refresh] Failed to mark connection ${connectionId} as ${status}:`, error);
  }
}

/**
 * Log token refresh execution
 */
async function logTokenRefreshExecution(
  supabase: ReturnType<typeof createClient>,
  result: RefreshResult
): Promise<void> {
  const { error } = await supabase.from('calendar_token_refresh_log').insert({
    connection_id: result.connection_id,
    user_id: result.user_id,
    refresh_status: result.status,
    old_expires_at: result.old_expires_at,
    new_expires_at: result.new_expires_at || null,
    error_message: result.error_message || null,
  });

  if (error) {
    // Non-critical, log but don't throw
    console.error('[ms-token-refresh] Failed to log refresh execution:', error);
  }
}

// ============================================
// Main Handler
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const executionId = crypto.randomUUID().slice(0, 8);

  // ========== EXECUTION START BANNER ==========
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           MS-TOKEN-REFRESH CRON JOB EXECUTION                  ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Execution ID: ${executionId}                                        ║`);
  console.log(`║  Started at:   ${new Date().toISOString()}              ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Parse request body
    let requestBody: TokenRefreshRequest = {};
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        console.log(`[${executionId}] Raw request body: ${text || '(empty)'}`);
        if (text) {
          requestBody = JSON.parse(text);
        }
      } catch {
        console.log(`[${executionId}] No JSON body provided (OK for CRON)`);
      }
    }

    const daysThreshold = requestBody.days_threshold ?? 14;
    const dryRun = requestBody.dry_run ?? false;
    const specificConnectionId = requestBody.connection_id;

    console.log(`[${executionId}] ┌─── CONFIGURATION ───────────────────────────`);
    console.log(`[${executionId}] │ Days threshold: ${daysThreshold}`);
    console.log(`[${executionId}] │ Dry run: ${dryRun}`);
    console.log(`[${executionId}] │ Specific connection: ${specificConnectionId || '(all connections)'}`);
    console.log(`[${executionId}] └──────────────────────────────────────────────`);

    // Get environment variables
    console.log(`[${executionId}] Checking environment variables...`);
    const supabaseUrl = getEnvOrThrow('SUPABASE_URL');
    const supabaseServiceKey = getEnvOrThrow('SUPABASE_SERVICE_ROLE_KEY');
    const msClientId = getEnvOrThrow('MS_OAUTH_CLIENT_ID');
    const msClientSecret = getEnvOrThrow('MS_OAUTH_CLIENT_SECRET');

    console.log(`[${executionId}] ✓ SUPABASE_URL: ${supabaseUrl.substring(0, 30)}...`);
    console.log(`[${executionId}] ✓ SUPABASE_SERVICE_ROLE_KEY: ***${supabaseServiceKey.slice(-8)}`);
    console.log(`[${executionId}] ✓ MS_OAUTH_CLIENT_ID: ${msClientId.substring(0, 8)}...`);
    console.log(`[${executionId}] ✓ MS_OAUTH_CLIENT_SECRET: ***${msClientSecret.slice(-4)}`);

    // Create Supabase client with service role
    console.log(`[${executionId}] Creating Supabase client...`);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get connections expiring within threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
    console.log(`[${executionId}] Querying connections with token_expires_at < ${thresholdDate.toISOString()}`);

    const connections = await getExpiringConnections(supabase, daysThreshold, specificConnectionId);

    console.log('');
    console.log(`[${executionId}] ┌─── DATABASE QUERY RESULTS ──────────────────`);
    console.log(`[${executionId}] │ Found ${connections.length} connection(s) to process`);
    if (connections.length === 0) {
      console.log(`[${executionId}] │ (No tokens expiring within ${daysThreshold} days)`);
    } else {
      for (const conn of connections) {
        const expiresIn = Math.round((new Date(conn.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        console.log(`[${executionId}] │ - ${conn.id.substring(0, 8)}... | ${conn.ms_user_principal_name || 'N/A'} | expires in ${expiresIn} days`);
      }
    }
    console.log(`[${executionId}] └──────────────────────────────────────────────`);
    console.log('');

    const results: RefreshResult[] = [];
    let refreshedCount = 0;
    let revokedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each connection
    for (let i = 0; i < connections.length; i++) {
      const connection = connections[i];
      console.log(`[${executionId}] ┌─── PROCESSING CONNECTION ${i + 1}/${connections.length} ────────`);
      console.log(`[${executionId}] │ ID: ${connection.id}`);
      console.log(`[${executionId}] │ User: ${connection.user_id}`);
      console.log(`[${executionId}] │ Email: ${connection.ms_user_principal_name || 'N/A'}`);
      console.log(`[${executionId}] │ Current expiry: ${connection.token_expires_at}`);
      console.log(`[${executionId}] │ Status: ${connection.connection_status}`);

      const result: RefreshResult = {
        connection_id: connection.id,
        user_id: connection.user_id,
        email: connection.ms_user_principal_name,
        status: 'skipped',
        old_expires_at: connection.token_expires_at,
      };

      try {
        if (dryRun) {
          result.status = 'skipped';
          skippedCount++;
          console.log(`[${executionId}] │ [DRY RUN] Would refresh this connection`);
          console.log(`[${executionId}] └──────────────────────────────────────────────`);
        } else {
          // Decrypt refresh token
          console.log(`[${executionId}] │ Decrypting refresh token...`);
          const refreshToken = await decryptToken(connection.refresh_token_encrypted);
          console.log(`[${executionId}] │ ✓ Token decrypted (${refreshToken.length} chars)`);

          // Attempt token refresh
          console.log(`[${executionId}] │ Calling Microsoft OAuth token endpoint...`);
          console.log(`[${executionId}] │ Scopes: ${MS_OAUTH_REFRESH_SCOPES_STRING}`);
          const tokenResult = await refreshAccessToken(refreshToken, msClientId, msClientSecret);

          if ('error' in tokenResult) {
            // Token refresh failed
            console.log(`[${executionId}] │ ✗ Microsoft returned error: ${tokenResult.error}`);
            console.log(`[${executionId}] │   Description: ${tokenResult.error_description}`);

            if (tokenResult.error === 'invalid_grant') {
              // Token was revoked by user
              result.status = 'revoked';
              result.error_message = tokenResult.error_description;
              revokedCount++;

              console.log(`[${executionId}] │ → Marking connection as REVOKED`);
              await markConnectionFailed(
                supabase,
                connection.id,
                'revoked',
                'Token revoked by user. Please reconnect your calendar.'
              );

              console.log(`[${executionId}] │ Result: TOKEN REVOKED (user action required)`);
            } else {
              // Other error
              result.status = 'error';
              result.error_message = tokenResult.error_description;
              errorCount++;

              console.log(`[${executionId}] │ → Marking connection as ERROR`);
              await markConnectionFailed(supabase, connection.id, 'error', tokenResult.error_description);

              console.log(`[${executionId}] │ Result: ERROR - ${tokenResult.error}`);
            }
            console.log(`[${executionId}] └──────────────────────────────────────────────`);
          } else {
            // Success - encrypt and save new tokens
            console.log(`[${executionId}] │ ✓ Microsoft returned new tokens!`);
            console.log(`[${executionId}] │   Access token: ${tokenResult.access_token.length} chars`);
            console.log(`[${executionId}] │   Refresh token: ${tokenResult.refresh_token.length} chars`);
            console.log(`[${executionId}] │   Expires in: ${tokenResult.expires_in} seconds`);
            console.log(`[${executionId}] │   Scopes granted: ${tokenResult.scope}`);

            const newExpiresAt = new Date(Date.now() + tokenResult.expires_in * 1000);
            console.log(`[${executionId}] │ New expiry: ${newExpiresAt.toISOString()}`);

            console.log(`[${executionId}] │ Encrypting tokens...`);
            const encryptedAccessToken = await encryptToken(tokenResult.access_token);
            const encryptedRefreshToken = await encryptToken(tokenResult.refresh_token);
            console.log(`[${executionId}] │ ✓ Tokens encrypted`);

            console.log(`[${executionId}] │ Saving to database...`);
            await updateConnectionTokens(
              supabase,
              connection.id,
              encryptedAccessToken,
              encryptedRefreshToken,
              newExpiresAt
            );
            console.log(`[${executionId}] │ ✓ Database updated`);

            result.status = 'refreshed';
            result.new_expires_at = newExpiresAt.toISOString();
            refreshedCount++;

            console.log(`[${executionId}] │ Result: SUCCESS - Token refreshed!`);
            console.log(`[${executionId}] └──────────────────────────────────────────────`);
          }

          // Log to database
          console.log(`[${executionId}] Logging execution to calendar_token_refresh_log...`);
          await logTokenRefreshExecution(supabase, result);
        }
      } catch (error) {
        result.status = 'error';
        result.error_message = error instanceof Error ? error.message : 'Unknown error';
        errorCount++;

        console.log(`[${executionId}] │ ✗ EXCEPTION: ${result.error_message}`);
        console.log(`[${executionId}] └──────────────────────────────────────────────`);
        console.error(`[${executionId}] Full error:`, error);

        if (!dryRun) {
          await logTokenRefreshExecution(supabase, result);
        }
      }

      results.push(result);
      console.log('');
    }

    const executionTimeMs = Date.now() - startTime;

    // ========== EXECUTION SUMMARY ==========
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    EXECUTION SUMMARY                           ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Execution ID:      ${executionId}                                   ║`);
    console.log(`║  Total connections: ${String(connections.length).padEnd(42)}║`);
    console.log(`║  ✓ Refreshed:       ${String(refreshedCount).padEnd(42)}║`);
    console.log(`║  ✗ Revoked:         ${String(revokedCount).padEnd(42)}║`);
    console.log(`║  ⚠ Errors:          ${String(errorCount).padEnd(42)}║`);
    console.log(`║  ○ Skipped:         ${String(skippedCount).padEnd(42)}║`);
    console.log(`║  Execution time:    ${String(executionTimeMs + 'ms').padEnd(42)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');

    const response: TokenRefreshResponse = {
      success: true,
      dry_run: dryRun,
      days_threshold: daysThreshold,
      total_connections: connections.length,
      refreshed: refreshedCount,
      revoked: revokedCount,
      errors: errorCount,
      skipped: skippedCount,
      results,
      execution_time_ms: executionTimeMs,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    FATAL ERROR                                 ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║  Execution ID: ${executionId}                                        ║`);
    console.log(`║  Error: ${(error instanceof Error ? error.message : 'Unknown').substring(0, 54).padEnd(54)}║`);
    console.log(`║  Time: ${String(executionTimeMs + 'ms').padEnd(55)}║`);
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.error(`[${executionId}] Full error:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: executionTimeMs,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
