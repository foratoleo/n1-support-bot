/**
 * generate-meeting-share-token Edge Function
 *
 * Generates a share token for a meeting, allowing unauthenticated access via a public link.
 * Requires authentication via Bearer token. Validates caller has access to the meeting.
 *
 * Request body:
 * - meeting_id: string (UUID, required)
 * - expires_in_days: number (optional, default 7, max 90)
 *
 * Response:
 * - { success: true, token, share_url, expires_at }
 *
 * @module generate-meeting-share-token
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const OPERATION = 'generate-meeting-share-token';
const DEFAULT_EXPIRES_IN_DAYS = 7;
const MAX_EXPIRES_IN_DAYS = 90;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================================================
// Types
// ============================================================================

interface GenerateShareTokenRequest {
  meeting_id: string;
  expires_in_days?: number;
}

interface GenerateShareTokenResponse {
  success: boolean;
  token?: string;
  share_url?: string;
  expires_at?: string;
  error?: string;
  requestId?: string;
}

// ============================================================================
// Supabase Client
// ============================================================================

function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

// ============================================================================
// Response Helpers
// ============================================================================

function createJsonResponse(data: GenerateShareTokenResponse, statusCode: number): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status: statusCode,
  });
}

function createCorsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

// ============================================================================
// Authentication
// ============================================================================

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

// ============================================================================
// Validation
// ============================================================================

function validateRequest(body: unknown): {
  valid: boolean;
  data?: GenerateShareTokenRequest;
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const req = body as Record<string, unknown>;

  if (!req.meeting_id || typeof req.meeting_id !== 'string') {
    return { valid: false, error: 'meeting_id is required and must be a string' };
  }

  if (!UUID_REGEX.test(req.meeting_id)) {
    return { valid: false, error: 'meeting_id must be a valid UUID' };
  }

  let expiresInDays = DEFAULT_EXPIRES_IN_DAYS;

  if (req.expires_in_days !== undefined) {
    if (typeof req.expires_in_days !== 'number' || !Number.isInteger(req.expires_in_days)) {
      return { valid: false, error: 'expires_in_days must be an integer' };
    }
    if (req.expires_in_days < 1) {
      return { valid: false, error: 'expires_in_days must be at least 1' };
    }
    if (req.expires_in_days > MAX_EXPIRES_IN_DAYS) {
      return { valid: false, error: `expires_in_days must not exceed ${MAX_EXPIRES_IN_DAYS}` };
    }
    expiresInDays = req.expires_in_days;
  }

  return {
    valid: true,
    data: {
      meeting_id: req.meeting_id,
      expires_in_days: expiresInDays,
    },
  };
}

// ============================================================================
// Business Logic
// ============================================================================

/**
 * Verifies the authenticated user has access to the specified meeting.
 * Returns the meeting if found, or null if not accessible.
 */
async function validateMeetingAccess(
  supabase: SupabaseClient,
  meetingId: string,
  userId: string
): Promise<{ hasAccess: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, project_id')
      .eq('id', meetingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return { hasAccess: false, error: null };
      }
      console.error(`[${OPERATION}] Meeting lookup error:`, error.message);
      return { hasAccess: false, error: error.message };
    }

    if (!data) {
      return { hasAccess: false, error: null };
    }

    // Verify the user has access to the project associated with this meeting
    const { data: access, error: accessError } = await supabase
      .from('user_project_access')
      .select('id')
      .eq('project_id', data.project_id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (accessError) {
      console.error(`[${OPERATION}] Access check error:`, accessError.message);
      return { hasAccess: false, error: accessError.message };
    }

    return { hasAccess: access !== null, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] validateMeetingAccess exception:`, err);
    return { hasAccess: false, error: 'Failed to validate meeting access' };
  }
}

/**
 * Generates and persists a share token for the meeting.
 */
async function generateShareToken(
  supabase: SupabaseClient,
  meetingId: string,
  userId: string,
  expiresInDays: number
): Promise<{ token: string | null; expiresAt: string | null; error: string | null }> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    const expiresAtIso = expiresAt.toISOString();

    const { data, error } = await supabase
      .from('meeting_share_tokens')
      .insert({
        meeting_id: meetingId,
        created_by: userId,
        expires_at: expiresAtIso,
        is_active: true,
      })
      .select('token, expires_at')
      .single();

    if (error) {
      console.error(`[${OPERATION}] Token insert error:`, error.message);
      return { token: null, expiresAt: null, error: error.message };
    }

    if (!data) {
      return { token: null, expiresAt: null, error: 'Token creation returned no data' };
    }

    return { token: data.token, expiresAt: data.expires_at, error: null };
  } catch (err) {
    console.error(`[${OPERATION}] generateShareToken exception:`, err);
    return { token: null, expiresAt: null, error: 'Failed to generate share token' };
  }
}

/**
 * Builds the public share URL for the given token.
 */
function buildShareUrl(token: string): string {
  const frontendUrl =
    Deno.env.get('FRONTEND_URL') ||
    Deno.env.get('VITE_APP_URL') ||
    'https://app.draiworkforce.com';

  return `${frontendUrl}/meetings/share/${token}`;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req: Request) => {
  const requestId = crypto.randomUUID();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return createJsonResponse(
      { success: false, error: 'Only POST method is allowed', requestId },
      405
    );
  }

  try {
    const supabase = createAdminClient();

    // Extract and validate Bearer token
    const authHeader = req.headers.get('Authorization');
    const token = extractBearerToken(authHeader);

    if (!token) {
      console.error(`[${OPERATION}] [${requestId}] No authorization token provided`);
      return createJsonResponse(
        { success: false, error: 'Authorization token is required', requestId },
        401
      );
    }

    // Authenticate the caller
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error(`[${OPERATION}] [${requestId}] Authentication failed:`, authError?.message);
      return createJsonResponse(
        { success: false, error: authError?.message || 'Authentication failed', requestId },
        401
      );
    }

    console.log(`[${OPERATION}] [${requestId}] Caller authenticated: ${user.id}`);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createJsonResponse(
        { success: false, error: 'Invalid JSON in request body', requestId },
        400
      );
    }

    const validation = validateRequest(body);

    if (!validation.valid || !validation.data) {
      console.error(`[${OPERATION}] [${requestId}] Validation failed:`, validation.error);
      return createJsonResponse(
        { success: false, error: validation.error || 'Validation failed', requestId },
        400
      );
    }

    const { meeting_id, expires_in_days } = validation.data;

    console.log(`[${OPERATION}] [${requestId}] Generating token for meeting: ${meeting_id}`);

    // Verify user has access to the meeting
    const { hasAccess, error: accessError } = await validateMeetingAccess(
      supabase,
      meeting_id,
      user.id
    );

    if (accessError) {
      console.error(`[${OPERATION}] [${requestId}] Access check error:`, accessError);
      return createJsonResponse(
        { success: false, error: 'Failed to verify meeting access', requestId },
        500
      );
    }

    if (!hasAccess) {
      console.error(`[${OPERATION}] [${requestId}] Access denied for meeting: ${meeting_id}, user: ${user.id}`);
      return createJsonResponse(
        { success: false, error: 'Meeting not found or access denied', requestId },
        403
      );
    }

    // Generate and persist the share token
    const {
      token: shareToken,
      expiresAt,
      error: tokenError,
    } = await generateShareToken(supabase, meeting_id, user.id, expires_in_days!);

    if (tokenError || !shareToken || !expiresAt) {
      console.error(`[${OPERATION}] [${requestId}] Token generation failed:`, tokenError);
      return createJsonResponse(
        { success: false, error: 'Failed to generate share token', requestId },
        500
      );
    }

    const shareUrl = buildShareUrl(shareToken);

    console.log(`[${OPERATION}] [${requestId}] Token generated successfully for meeting: ${meeting_id}`);

    return createJsonResponse(
      {
        success: true,
        token: shareToken,
        share_url: shareUrl,
        expires_at: expiresAt,
        requestId,
      },
      200
    );
  } catch (err) {
    console.error(`[${OPERATION}] [${requestId}] Unexpected error:`, err);
    return createJsonResponse(
      {
        success: false,
        error: err instanceof Error ? err.message : 'An unexpected error occurred',
        requestId,
      },
      500
    );
  }
});
