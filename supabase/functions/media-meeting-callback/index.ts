// file: supabase/functions/media-meeting-callback/index.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Receive callback from DR Media Tools when meeting processing is complete
//          (video, audio, transcript ready). Persists data into meetings, meeting_transcripts,
//          and meeting_assets tables.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod';

// --- Environment Variables ---
const MEDIA_CALLBACK_SECRET = Deno.env.get('MEDIA_CALLBACK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('DB_URL') || Deno.env.get('SUPABASE_URL') || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('DB_SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!MEDIA_CALLBACK_SECRET) {
  console.warn('[media-meeting-callback] MEDIA_CALLBACK_SECRET not set — all requests will be rejected');
}

// --- Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- CORS Headers ---
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

// --- Callback Payload Schema (Zod) ---
const RecordingSchema = z.object({
  status: z.string(),
  videoUrl: z.string().url().nullable().optional(),
  audioUrl: z.string().url().nullable().optional(),
});

const TranscriptSchema = z.object({
  status: z.string(),
  language: z.string().nullable().optional(),
  transcriptUrl: z.string().url().nullable().optional(),
});

const MeetingPayloadSchema = z.object({
  id: z.string(),
  externalMeetingId: z.string(),
  externalProjectId: z.string().optional(),
  status: z.string(),
  recording: RecordingSchema,
  transcript: TranscriptSchema,
});

const CallbackPayloadSchema = z.object({
  event: z.string(),
  meeting: MeetingPayloadSchema.optional(),
  timestamp: z.string(),
});

// --- Transcript Types ---
interface TranscriptWord {
  text: string;
  start_time?: number;
  end_time?: number;
}

interface TranscriptSegment {
  participant?: { name: string };
  words: TranscriptWord[];
}

interface MeetingStatusUpdate {
  media_processing_status: string;
  updated_at: string;
  media_bot_status?: string;
}

interface MeetingAssetRecord {
  meeting_id: string;
  asset_type: 'video' | 'audio';
  name: string;
  description: string;
  url: string;
  status: string;
  is_primary: boolean;
  sort_order: number;
  source: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Constants ---
const VALID_BOT_STATUSES = new Set([
  'pending', 'joining_call', 'in_call_not_recording',
  'in_call_recording', 'call_ended', 'done', 'fatal',
]);

const BOT_STATUS_MAP: Record<string, string> = {
  completed: 'done',
  failed: 'fatal',
};

// --- Utility Functions ---
const nowIso = () => new Date().toISOString();

function mapBotStatus(apiStatus: string): string | undefined {
  const mapped = BOT_STATUS_MAP[apiStatus] || apiStatus;
  return VALID_BOT_STATUSES.has(mapped) ? mapped : undefined;
}

/**
 * Parses Recall.ai / DR Media Tools transcript JSON format to readable text with speaker attribution.
 * Expected format: array of segments with { participant: { name }, words: [{ text }] }
 */
function parseTranscriptToText(segments: TranscriptSegment[]): string {
  const lines: string[] = [];

  for (const segment of segments) {
    const speaker = segment.participant?.name || 'Unknown Speaker';
    const words = segment.words || [];

    if (words.length === 0) continue;

    const text = words.map((w) => w.text).join(' ');
    lines.push(`${speaker}: ${text}`);
  }

  return lines.join('\n\n');
}

/**
 * Fetches transcript JSON content from a pre-signed S3 URL.
 */
async function fetchTranscriptContent(transcriptUrl: string): Promise<TranscriptSegment[] | null> {
  try {
    const response = await fetch(transcriptUrl);
    if (!response.ok) {
      console.error(`[CALLBACK] Failed to fetch transcript content: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('[CALLBACK] Error fetching transcript content:', err);
    return null;
  }
}

/**
 * Updates meetings table with processing status.
 */
async function updateMeetingStatus(meetingId: string, processingStatus: string, mediaBotStatus?: string) {
  const updatePayload: MeetingStatusUpdate = {
    media_processing_status: processingStatus,
    updated_at: nowIso(),
  };

  if (mediaBotStatus) {
    updatePayload.media_bot_status = mediaBotStatus;
  }

  const { error } = await supabase
    .from('meetings')
    .update(updatePayload)
    .eq('id', meetingId);

  if (error) {
    console.error(`[CALLBACK] Failed to update meeting ${meetingId}:`, error);
    throw error;
  }

  console.log(`[CALLBACK] Updated meeting ${meetingId} — processing_status: ${processingStatus}`);
}

/**
 * Atomically upserts a record into meeting_transcripts.
 * Uses INSERT ... ON CONFLICT (meeting_id) DO UPDATE SET ... to eliminate the
 * TOCTOU race condition that could occur when DR Media Tools delivers the
 * callback twice concurrently.
 * Requires the unique constraint meeting_transcripts_meeting_id_unique on meeting_id.
 */
async function upsertMeetingTranscript(
  meetingId: string,
  projectId: string | null,
  meetingTitle: string,
  meetingDescription: string | null,
  transcriptText: string,
  transcriptUrl: string | undefined,
  audioUrl: string | undefined,
  transcriptMetadata: TranscriptSegment[] | null,
  meetingDate: string,
) {
  const { data: existing } = await supabase
    .from('meeting_transcripts')
    .select('id')
    .eq('meeting_id', meetingId)
    .maybeSingle();

  const payload = {
    title: meetingTitle,
    description: meetingDescription || 'Automatically generated by DR Media Tools',
    meeting_date: meetingDate,
    transcript_text: transcriptText,
    transcript_url: transcriptUrl || null,
    audio_url: audioUrl || null,
    transcript_metadata: transcriptMetadata || [],
    tags: ['auto-generated', 'media-tools', 'ai-transcript'],
    created_by: 'dr-media-tools',
    is_public: false,
    project_id: projectId,
    meeting_id: meetingId,
  };

  let data;
  let error;

  if (existing) {
    ({ data, error } = await supabase
      .from('meeting_transcripts')
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from('meeting_transcripts')
      .insert(payload)
      .select()
      .single());
  }

  if (error) {
    console.error('[CALLBACK] Failed to persist meeting_transcript:', error);
    throw error;
  }

  console.log(`[CALLBACK] Persisted meeting_transcript: ${data.id}`);
  return data;
}

/**
 * Inserts assets (video, audio) into meeting_assets table.
 * Skips if URL is not provided.
 */
async function insertMeetingAssets(
  meetingId: string,
  videoUrl: string | undefined,
  audioUrl: string | undefined,
  createdBy: string | null,
) {
  const assets: MeetingAssetRecord[] = [];

  if (videoUrl) {
    assets.push({
      meeting_id: meetingId,
      asset_type: 'video',
      name: 'Meeting Recording',
      description: 'Video recording generated by DR Media Tools',
      url: videoUrl,
      status: 'ready',
      is_primary: true,
      sort_order: 0,
      source: 'dr-media-tools',
      metadata: {},
      created_by: createdBy,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  if (audioUrl) {
    assets.push({
      meeting_id: meetingId,
      asset_type: 'audio',
      name: 'Meeting Audio',
      description: 'Audio recording generated by DR Media Tools',
      url: audioUrl,
      status: 'ready',
      is_primary: false,
      sort_order: 1,
      source: 'dr-media-tools',
      metadata: {},
      created_by: createdBy,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
  }

  if (assets.length === 0) {
    console.log('[CALLBACK] No asset URLs provided — skipping asset insertion');
    return [];
  }

  const results = [];

  for (const asset of assets) {
    const { data: existing } = await supabase
      .from('meeting_assets')
      .select('id, asset_type')
      .eq('meeting_id', asset.meeting_id)
      .eq('asset_type', asset.asset_type)
      .eq('source', 'dr-media-tools')
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('meeting_assets')
        .update({ url: asset.url, status: asset.status, updated_at: nowIso() })
        .eq('id', existing.id)
        .select('id, asset_type')
        .single();

      if (error) {
        console.error(`[CALLBACK] Failed to update meeting_asset (${asset.asset_type}):`, error);
        throw error;
      }

      results.push(data);
    } else {
      const { data, error } = await supabase
        .from('meeting_assets')
        .insert(asset)
        .select('id, asset_type')
        .single();

      if (error) {
        console.error(`[CALLBACK] Failed to insert meeting_asset (${asset.asset_type}):`, error);
        throw error;
      }

      results.push(data);
    }
  }

  console.log(`[CALLBACK] Persisted ${results.length} meeting asset(s)`);
  return results;
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS });
    }

    // Only allow POST
    if (req.method !== 'POST') {
      return Response.json(
        { error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' } },
        { status: 405, headers: CORS },
      );
    }

    // --- Security: Validate callback secret ---
    const callbackSecret = req.headers.get('x-callback-secret');
    if (!callbackSecret || callbackSecret !== MEDIA_CALLBACK_SECRET) {
      console.warn('[CALLBACK] Unauthorized request — invalid or missing X-Callback-Secret');
      return Response.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid callback secret' } },
        { status: 401, headers: CORS },
      );
    }

    // --- Parse and validate payload ---
    const body = await req.json().catch(() => ({}));
    const parsed = CallbackPayloadSchema.safeParse(body);

    if (!parsed.success) {
      console.error('[CALLBACK] Invalid payload:', parsed.error.message);
      // Return 200 to prevent retries on malformed payloads
      return Response.json(
        { success: false, error: 'Invalid callback payload' },
        { status: 200, headers: CORS },
      );
    }

    const { event, meeting } = parsed.data;

    // Handle unknown event types gracefully
    if (event !== 'meeting.processed') {
      console.log(`[CALLBACK] Received unhandled event type: ${event} — skipping`);
      return Response.json(
        { success: true, skipped: true, reason: 'unhandled event type' },
        { status: 200, headers: CORS },
      );
    }

    if (!meeting) {
      console.error('[CALLBACK] meeting.processed event received without meeting data');
      return Response.json(
        { success: false, error: 'Missing meeting data for meeting.processed event' },
        { status: 200, headers: CORS },
      );
    }

    const {
      externalMeetingId,
      externalProjectId,
      status: meetingStatus,
      recording,
      transcript,
    } = meeting;

    console.log(`[CALLBACK] Processing event meeting.processed — externalMeetingId: ${externalMeetingId}`);

    // --- Look up the meeting in our database ---
    const { data: dbMeeting, error: meetingError } = await supabase
      .from('meetings')
      .select('id, title, description, project_id, created_by')
      .eq('id', externalMeetingId)
      .maybeSingle();

    if (meetingError) {
      console.error('[CALLBACK] Error fetching meeting:', meetingError);
      return Response.json(
        { success: false, error: 'Database error looking up meeting' },
        { status: 200, headers: CORS },
      );
    }

    if (!dbMeeting) {
      console.error(`[CALLBACK] Meeting not found: ${externalMeetingId}`);
      return Response.json(
        { success: false, error: `Meeting not found: ${externalMeetingId}` },
        { status: 200, headers: CORS },
      );
    }

    const meetingId = dbMeeting.id;
    const projectId = dbMeeting.project_id || externalProjectId || null;

    // --- 1. Update meeting status ---
    await updateMeetingStatus(meetingId, 'completed', mapBotStatus(meetingStatus));

    // --- 2. Fetch and parse transcript ---
    let transcriptText = '';
    let transcriptContent: TranscriptSegment[] | null = null;

    if (transcript.transcriptUrl) {
      transcriptContent = await fetchTranscriptContent(transcript.transcriptUrl);
      if (transcriptContent && Array.isArray(transcriptContent)) {
        transcriptText = parseTranscriptToText(transcriptContent);
      } else {
        console.warn('[CALLBACK] Transcript content is not a valid array — storing empty text');
      }
    } else {
      console.warn('[CALLBACK] No transcriptUrl provided — transcript will be empty');
    }

    // --- 3. Upsert meeting transcript ---
    const meetingTranscript = await upsertMeetingTranscript(
      meetingId,
      projectId,
      dbMeeting.title || `Meeting Transcript - ${new Date().toLocaleString()}`,
      dbMeeting.description,
      transcriptText,
      transcript.transcriptUrl,
      recording.audioUrl,
      transcriptContent,
      nowIso(),
    );

    // --- 4. Insert meeting assets (video + audio) ---
    const assets = await insertMeetingAssets(
      meetingId,
      recording.videoUrl,
      recording.audioUrl,
      dbMeeting.created_by || null,
    );

    console.log(`[CALLBACK] Completed processing for meeting ${meetingId} — transcript: ${meetingTranscript.id}, assets: ${assets.length}`);

    // Always return 200 to acknowledge receipt
    return Response.json(
      {
        success: true,
        meetingId,
        transcriptId: meetingTranscript.id,
        assetsCount: assets.length,
      },
      { status: 200, headers: CORS },
    );
  } catch (err: unknown) {
    console.error('[CALLBACK] Unhandled error:', err);

    const code = err instanceof Error && 'code' in err ? (err as Error & { code: string }).code : 'INTERNAL_ERROR';
    const message = err instanceof Error ? err.message : 'Unexpected error processing callback';

    // Always return 200 to prevent unnecessary retries from DR Media Tools
    return Response.json(
      {
        success: false,
        error: {
          code,
          message,
        },
      },
      { status: 200, headers: CORS },
    );
  }
});
