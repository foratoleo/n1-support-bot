/**
 * get-shared-meeting Edge Function
 *
 * Public endpoint (no authentication required) that validates a meeting share token
 * and returns the meeting data for external viewers.
 *
 * Accepts:
 * - GET  ?token=<token>
 * - POST { token: "<token>" }
 *
 * Returns:
 * - 200: { success: true, meeting: {...}, token_info: { expires_at, access_count } }
 * - 401: { error: 'TOKEN_INVALID', message: '...' }
 * - 400: { error: 'MISSING_TOKEN', message: '...' }
 * - 405: { error: 'METHOD_NOT_ALLOWED', message: '...' }
 * - 500: { error: 'INTERNAL_ERROR', message: '...' }
 *
 * @module get-shared-meeting
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';

const OPERATION = 'get-shared-meeting';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MeetingShareToken {
  id: string;
  meeting_id: string;
  token: string;
  expires_at: string;
  is_active: boolean;
  access_count: number;
  last_accessed_at: string | null;
}

interface MeetingParticipant {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  participant_type: 'auth_user' | 'team_member' | 'external_email';
}

interface MeetingAsset {
  url: string | null;
}

interface MeetingData {
  id: string;
  title: string;
  meeting_date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  project_name: string;
  sprint_name: string | null;
  transcript_text: string | null;
  transcript_metadata: Record<string, unknown> | null;
  transcript_tags: string[] | null;
  total_participants: number;
  participants: MeetingParticipant[];
  video_url: string | null;
}

interface GetSharedMeetingResponse {
  success: boolean;
  meeting?: MeetingData;
  token_info?: {
    expires_at: string;
    access_count: number;
  };
  error?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createJsonResponse(data: GetSharedMeetingResponse, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Extracts token from GET query param or POST body.
 * Returns null when neither is present.
 */
async function extractToken(req: Request): Promise<string | null> {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    return url.searchParams.get('token');
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      return body?.token ?? null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Fetches participants for a meeting using the view_meeting_participants view.
 * The view performs explicit SQL JOINs (profiles, team_members) which are more
 * reliable than PostgREST automatic FK-based joins.
 * Returns an empty array on error (non-critical).
 */
async function fetchParticipants(
  supabase: ReturnType<typeof createClient>,
  meetingId: string
): Promise<MeetingParticipant[]> {
  try {
    const { data, error } = await supabase
      .from('view_meeting_participants')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true });

    if (error || !data) {
      console.warn(`[${OPERATION}] Could not fetch participants:`, error?.message);
      return [];
    }

    return data.map((row: Record<string, unknown>) => {
      const type = row.participant_type as string;

      if (type === 'external_email') {
        return {
          id: row.id as string,
          name: null,
          email: (row.external_email as string | null) ?? null,
          avatar_url: null,
          participant_type: 'external_email' as const,
        };
      }

      if (type === 'team_member') {
        return {
          id: row.id as string,
          name: (row.team_member_name as string | null) ?? null,
          email: null,
          avatar_url: (row.team_member_avatar_url as string | null) ?? null,
          participant_type: 'team_member' as const,
        };
      }

      if (type === 'auth_user') {
        return {
          id: row.id as string,
          name: (row.auth_user_full_name as string | null) ?? null,
          email: (row.auth_user_email as string | null) ?? null,
          avatar_url: (row.auth_user_avatar_url as string | null) ?? null,
          participant_type: 'auth_user' as const,
        };
      }

      return {
        id: row.id as string,
        name: null,
        email: null,
        avatar_url: null,
        participant_type: type as MeetingParticipant['participant_type'],
      };
    });
  } catch (err) {
    console.warn(`[${OPERATION}] Participant fetch threw:`, err);
    return [];
  }
}

/**
 * Fetches the primary video URL for a meeting from meeting_assets.
 * Returns null when no ready primary video exists (non-critical).
 */
async function fetchPrimaryVideo(
  supabase: ReturnType<typeof createClient>,
  meetingId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('meeting_assets')
      .select('url')
      .eq('meeting_id', meetingId)
      .eq('asset_type', 'video')
      .eq('status', 'ready')
      .eq('is_primary', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return (data as MeetingAsset).url ?? null;
  } catch {
    return null;
  }
}

/**
 * Records a log entry for this token access and updates counters.
 * Non-critical — errors are swallowed to never block the caller.
 */
async function recordAccess(
  supabase: ReturnType<typeof createClient>,
  tokenId: string,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    // Insert access log
    const { error: logError } = await supabase
      .from('meeting_share_token_logs')
      .insert({
        token_id: tokenId,
        ip_address: ipAddress,
        user_agent: userAgent,
      });

    if (logError) {
      console.warn(`[${OPERATION}] Could not insert access log:`, logError.message);
    }

    // Increment access_count and update last_accessed_at atomically via RPC
    // Fallback to a plain update if the RPC is not available
    const { error: updateError } = await supabase.rpc('increment_token_access_count', {
      p_token_id: tokenId,
    });

    if (updateError) {
      // Fallback: plain update (race condition acceptable here)
      const { error: fallbackError } = await supabase
        .from('meeting_share_tokens')
        .update({
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', tokenId);

      if (fallbackError) {
        console.warn(`[${OPERATION}] Could not update token counters:`, fallbackError.message);
      }
    }
  } catch (err) {
    console.warn(`[${OPERATION}] recordAccess threw:`, err);
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  console.log(`[${OPERATION}] Request received: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return createJsonResponse(
      {
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only GET and POST methods are supported',
      },
      405
    );
  }

  try {
    // T3.1 — Extract token from request
    const token = await extractToken(req);

    if (!token?.trim()) {
      return createJsonResponse(
        {
          success: false,
          error: 'MISSING_TOKEN',
          message: 'Token is required',
        },
        400
      );
    }

    if (!UUID_REGEX.test(token.trim())) {
      return createJsonResponse(
        {
          success: false,
          error: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid token format',
        },
        400
      );
    }

    const supabase = createServiceClient();

    // T3.2 — Validate token: must exist, be active, and not expired
    const { data: tokenRecord, error: tokenError } = await supabase
      .from('meeting_share_tokens')
      .select('id, meeting_id, token, expires_at, is_active, access_count, last_accessed_at')
      .eq('token', token.trim())
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !tokenRecord) {
      console.log(`[${OPERATION}] Token not found or invalid`);
      return createJsonResponse(
        {
          success: false,
          error: 'TOKEN_INVALID',
          message: 'Token inválido ou expirado',
        },
        401
      );
    }

    const shareToken = tokenRecord as MeetingShareToken;

    // T3.3 — Fetch meeting data via view_meeting_with_transcript
    const { data: meetingRow, error: meetingError } = await supabase
      .from('view_meeting_with_transcript')
      .select(
        `
        id,
        title,
        meeting_date,
        start_time,
        end_time,
        description,
        project_name,
        sprint_name,
        transcript_text,
        transcript_metadata,
        transcript_tags,
        total_participants
        `
      )
      .eq('id', shareToken.meeting_id)
      .single();

    if (meetingError || !meetingRow) {
      console.error(
        `[${OPERATION}] Meeting not found for token meeting_id: ${shareToken.meeting_id}`,
        meetingError?.message
      );
      return createJsonResponse(
        {
          success: false,
          error: 'MEETING_NOT_FOUND',
          message: 'Reunião não encontrada',
        },
        404
      );
    }

    // Fetch participants and primary video in parallel (both non-critical)
    const [participants, videoUrl] = await Promise.all([
      fetchParticipants(supabase, shareToken.meeting_id),
      fetchPrimaryVideo(supabase, shareToken.meeting_id),
    ]);

    // T3.4 — Record access log and update counters (fire-and-forget)
    const ipAddress =
      req.headers.get('x-forwarded-for') ??
      req.headers.get('x-real-ip') ??
      null;
    const userAgent = req.headers.get('user-agent') ?? null;

    void recordAccess(supabase, shareToken.id, ipAddress, userAgent);

    // Build response
    const meeting: MeetingData = {
      id: meetingRow.id,
      title: meetingRow.title,
      meeting_date: meetingRow.meeting_date,
      start_time: meetingRow.start_time ?? null,
      end_time: meetingRow.end_time ?? null,
      description: meetingRow.description ?? null,
      project_name: meetingRow.project_name,
      sprint_name: meetingRow.sprint_name ?? null,
      transcript_text: meetingRow.transcript_text ?? null,
      transcript_metadata: meetingRow.transcript_metadata ?? null,
      transcript_tags: meetingRow.transcript_tags ?? null,
      total_participants: meetingRow.total_participants ?? 0,
      participants,
      video_url: videoUrl,
    };

    console.log(`[${OPERATION}] Success: meeting ${meeting.id} served via token ${shareToken.id}`);

    return createJsonResponse(
      {
        success: true,
        meeting,
        token_info: {
          expires_at: shareToken.expires_at,
          // Return the pre-fetch count; the increment runs async above
          access_count: shareToken.access_count + 1,
        },
      },
      200
    );
  } catch (error) {
    console.error(`[${OPERATION}] Unhandled error:`, error);

    return createJsonResponse(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      500
    );
  }
});
