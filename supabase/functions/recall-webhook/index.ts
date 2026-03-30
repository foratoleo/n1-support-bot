// file: supabase/functions/recall-webhook/index.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Handle Recall.ai webhook events for recording and transcript completion
// MODIFICATION: Inserts transcripts into BOTH recall_transcripts AND meeting_transcripts

import { createClient } from "npm:@supabase/supabase-js";
import { z } from "npm:zod";

// --- Environment Variables ---
const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY") || "";
const RECALL_REGION = Deno.env.get("RECALL_REGION") || "us-west-2";
const RECALL_API_BASE_URL = `https://${RECALL_REGION}.recall.ai/api/v1`;
const SUPABASE_URL = Deno.env.get("DB_URL") || Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("DB_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!RECALL_API_KEY) {
  throw new Error("Missing env: RECALL_API_KEY");
}

// --- Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Webhook Event Schemas ---
const RecordingDoneEventSchema = z.object({
  event: z.literal("recording.done"),
  data: z.object({
    bot: z.object({
      id: z.string(),
    }),
    recording: z.object({
      id: z.string(),
    }),
  }),
});

const TranscriptDoneEventSchema = z.object({
  event: z.literal("transcript.done"),
  data: z.object({
    transcript: z.object({
      id: z.string(),
    }),
    recording: z.object({
      id: z.string(),
    }),
    bot: z.object({
      id: z.string(),
    }),
  }),
});

const WebhookEventSchema = z.union([RecordingDoneEventSchema, TranscriptDoneEventSchema]);

// --- CORS Headers ---
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-recall-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// --- Utility Functions ---
const nowIso = () => new Date().toISOString();

async function getBotByRecallId(recallBotId: string) {
  const { data, error } = await supabase
    .from("recall_bots")
    .select("*")
    .eq("recall_bot_id", recallBotId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getRecordingByRecallId(recallRecordingId: string) {
  const { data, error } = await supabase
    .from("recall_recordings")
    .select("*")
    .eq("recall_recording_id", recallRecordingId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchRecallRecording(recordingId: string) {
  const response = await fetch(`${RECALL_API_BASE_URL}/recording/${recordingId}`, {
    method: "GET",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Recall API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

async function fetchRecallTranscript(transcriptId: string) {
  const response = await fetch(`${RECALL_API_BASE_URL}/transcript/${transcriptId}`, {
    method: "GET",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Recall API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

/**
 * Extracts media URLs from Recall.ai API response structure
 * Handles nested media_shortcuts structure with fallback to legacy format
 *
 * @param recordingData - Raw Recall.ai recording response
 * @returns Object containing video_url, audio_url, and transcript_url
 */
function extractMediaUrls(recordingData: any): { video_url: string | null; audio_url: string | null; transcript_url: string | null } {
  // Extract from nested media_shortcuts structure (current API format)
  const videoUrl = recordingData?.media_shortcuts?.video_mixed?.data?.download_url || null;
  const audioUrl = recordingData?.media_shortcuts?.audio_mixed?.data?.download_url || null;
  const transcriptUrl = recordingData?.media_shortcuts?.transcript?.data?.download_url || null;

  // Fallback to legacy format for backward compatibility
  const fallbackVideoUrl = videoUrl || recordingData?.video_url || null;
  const fallbackAudioUrl = audioUrl || recordingData?.audio_url || null;

  return {
    video_url: fallbackVideoUrl,
    audio_url: fallbackAudioUrl,
    transcript_url: transcriptUrl,
  };
}

async function updateRecording(botId: string, recallRecordingId: string, recordingData: any) {
  // Calculate expiration date (7 days from completion)
  const expiresAt = recordingData.ended_at
    ? new Date(new Date(recordingData.ended_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Extract media URLs from nested structure
  const { video_url, audio_url, transcript_url } = extractMediaUrls(recordingData);

  // Log extracted URLs for debugging
  console.log('[WEBHOOK] Extracted URLs:', {
    video: !!video_url,
    audio: !!audio_url,
    transcript: !!transcript_url,
  });

  const { data, error } = await supabase
    .from("recall_recordings")
    .upsert({
      bot_id: botId,
      recall_recording_id: recallRecordingId,
      status: "done",
      started_at: recordingData.started_at || nowIso(),
      completed_at: recordingData.ended_at || nowIso(),
      expires_at: expiresAt,
      video_url: video_url,
      audio_url: audio_url,
      transcript_url: transcript_url,
      metadata: recordingData,
    }, {
      onConflict: "recall_recording_id",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- TRANSCRIPT PARSING FUNCTION ---
// Converts Recall.ai transcript format to readable text with speaker attribution
// Uses the same logic as RecallTranscriptViewer component
function parseRecallTranscriptToText(segments: any[]): string {
  const lines: string[] = [];

  segments.forEach(segment => {
    const speaker = segment.participant?.name || 'Unknown Speaker';
    const words = segment.words || [];

    if (words.length === 0) return;

    // Combine all words from the segment into a single text
    const text = words.map((w: any) => w.text).join(' ');

    // Add formatted line with speaker attribution
    lines.push(`${speaker}: ${text}`);
  });

  return lines.join('\n\n');
}

async function fetchTranscriptContent(downloadUrl: string) {
  if (!downloadUrl) return null;

  try {
    const response = await fetch(downloadUrl);
    if (response.ok) {
      return await response.json();
    } else {
      console.warn(`[WEBHOOK] Failed to fetch transcript content: ${response.status}`);
      return null;
    }
  } catch (fetchError) {
    console.error('[WEBHOOK] Error fetching transcript content:', fetchError);
    return null;
  }
}

async function updateTranscript(recordingId: string, recallTranscriptId: string, transcriptData: any, fullTranscriptContent: any) {
  const { data, error } = await supabase
    .from("recall_transcripts")
    .update({
      transcript_data: fullTranscriptContent || transcriptData || [],
      status: "done",
      updated_at: nowIso(),
    })
    .eq("recall_transcript_id", recallTranscriptId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- NEW: INSERT INTO MEETING_TRANSCRIPTS ---
async function insertIntoMeetingTranscripts(
  bot: any,
  recording: any,
  transcriptData: any,
  recallTranscriptId: string,
  fullTranscriptContent: any
) {
  try {
    // Parse transcript to plain text
    // fullTranscriptContent is already the array of segments (RecallTranscriptMetadata)
    const transcriptText = parseRecallTranscriptToText(fullTranscriptContent || []);

    // Fetch meeting details if meeting_id exists
    let meetingTitle = `Meeting Transcript - ${new Date().toLocaleString()}`;
    let meetingDescription = `Automatically generated`;

    if (bot.meeting_id) {
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .select('title, description')
        .eq('id', bot.meeting_id)
        .maybeSingle();

      if (!meetingError && meeting) {
        meetingTitle = meeting.title || meetingTitle;
        meetingDescription = meeting.description || meetingDescription;
      }
    }

    // Insert into meeting_transcripts table with meeting_id and project_id from bot
    const { data: meetingTranscript, error } = await supabase
      .from('meeting_transcripts')
      .insert({
        title: meetingTitle,
        description: meetingDescription,
        meeting_date: recording.completed_at || nowIso(),
        transcript_text: transcriptText,
        transcript_metadata: fullTranscriptContent || [],
        tags: ['auto-generated', 'meeting-transcript', 'ai-transcript'],
        created_by: 'dr-ai-bot',
        is_public: false,
        project_id: bot.project_id || null,
        meeting_id: bot.meeting_id || null
      })
      .select()
      .single();

    if (error) {
      console.error('[WEBHOOK] Failed to insert into meeting_transcripts:', error);
      return null;
    }

    console.log(`[WEBHOOK] Created meeting_transcript: ${meetingTranscript.id}`);

    // Update recall_transcripts with cross-reference
    await supabase
      .from('recall_transcripts')
      .update({ meeting_transcript_id: meetingTranscript.id })
      .eq('recall_transcript_id', recallTranscriptId);

    return meetingTranscript;
  } catch (err) {
    console.error('[WEBHOOK] Error in insertIntoMeetingTranscripts:', err);
    return null;
  }
}

async function createAsyncTranscript(recordingId: string) {
  const response = await fetch(`${RECALL_API_BASE_URL}/recording/${recordingId}/create_transcript/`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: {
        recallai_async: {
          language_code: "auto",
        },
      },
      diarization: {
        use_separate_streams_when_available: true,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Failed to create async transcript: ${response.status} - ${errorData}`);
    return null;
  }

  return await response.json();
}

async function storeTranscriptInDatabase(recordingDbId: string, transcriptData: any) {
  const { data, error } = await supabase
    .from("recall_transcripts")
    .insert({
      recording_id: recordingDbId,
      recall_transcript_id: transcriptData.id,
      transcript_data: transcriptData.words || [],
      status: "pending",
      language: "auto",
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to store transcript in database:", error);
    return null;
  }

  return data;
}

async function handleRecordingDone(event: z.infer<typeof RecordingDoneEventSchema>) {
  const { bot, recording } = event.data;

  console.log(`[WEBHOOK] Recording done - Bot: ${bot.id}, Recording: ${recording.id}`);

  // Get bot from database
  const dbBot = await getBotByRecallId(bot.id);
  if (!dbBot) {
    console.error(`Bot not found in database: ${bot.id}`);
    return { success: false, message: "Bot not found" };
  }

  // Fetch full recording data from Recall.ai
  const recordingData = await fetchRecallRecording(recording.id);

  // Update recording in database
  const dbRecording = await updateRecording(dbBot.id, recording.id, recordingData);

  console.log(`[WEBHOOK] Recording updated in database: ${dbRecording.id}`);

  // Trigger async transcript creation
  try {
    const transcriptData = await createAsyncTranscript(recording.id);
    if (transcriptData) {
      const dbTranscript = await storeTranscriptInDatabase(dbRecording.id, transcriptData);
      console.log(`[WEBHOOK] Async transcript initiated: ${dbTranscript?.id || "unknown"}`);
    }
  } catch (err) {
    console.error("[WEBHOOK] Failed to create async transcript:", err);
    // Don't fail the webhook - transcript creation is async
  }

  return { success: true, recordingId: dbRecording.id };
}

async function handleTranscriptDone(event: z.infer<typeof TranscriptDoneEventSchema>) {
  const { transcript, recording, bot } = event.data;

  console.log(`[WEBHOOK] Transcript done - Transcript: ${transcript.id}, Recording: ${recording.id}`);

  // Get recording from database
  const dbRecording = await getRecordingByRecallId(recording.id);
  if (!dbRecording) {
    console.error(`Recording not found in database: ${recording.id}`);
    return { success: false, message: "Recording not found" };
  }

  // Get bot from database
  const dbBot = await getBotByRecallId(bot.id);
  if (!dbBot) {
    console.error(`Bot not found in database: ${bot.id}`);
    return { success: false, message: "Bot not found" };
  }

  // Fetch full transcript data from Recall.ai
  const transcriptData = await fetchRecallTranscript(transcript.id);

  // Fetch full transcript content from download_url (single fetch for both tables)
  // The download_url is nested in data.download_url from the transcript API response
  const fullTranscriptContent = await fetchTranscriptContent(transcriptData.data?.download_url);

  // Update recall_transcripts table
  const dbTranscript = await updateTranscript(dbRecording.id, transcript.id, transcriptData, fullTranscriptContent);

  console.log(`[WEBHOOK] Transcript updated in recall_transcripts: ${dbTranscript.id}`);

  // NEW: Insert into meeting_transcripts table
  const meetingTranscript = await insertIntoMeetingTranscripts(
    dbBot,
    dbRecording,
    transcriptData,
    transcript.id,
    fullTranscriptContent
  );

  if (meetingTranscript) {
    console.log(`[WEBHOOK] Transcript also saved to meeting_transcripts: ${meetingTranscript.id}`);
  }

  return { success: true, transcriptId: dbTranscript.id, meetingTranscriptId: meetingTranscript?.id };
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    // Only allow POST
    if (req.method !== "POST") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } },
        { status: 405, headers: CORS }
      );
    }

    const body = await req.json().catch(() => ({}));

    const parsed = WebhookEventSchema.safeParse(body);

    if (!parsed.success) {
      console.error("[WEBHOOK] Invalid webhook event:", parsed.error.message);
      // Return 200 to acknowledge receipt even if invalid (prevents retries)
      return Response.json(
        { success: false, error: "Invalid webhook event" },
        { status: 200, headers: CORS }
      );
    }

    const event = parsed.data;
    let result;

    // Handle different event types
    if (event.event === "recording.done") {
      result = await handleRecordingDone(event);
    } else if (event.event === "transcript.done") {
      result = await handleTranscriptDone(event);
    } else {
      console.log(`[WEBHOOK] Unknown event type: ${event.event}`);
      return Response.json(
        { success: false, error: "Unknown event type" },
        { status: 200, headers: CORS }
      );
    }

    // Always return 200 to acknowledge receipt
    return Response.json(
      { success: true, ...result },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("[WEBHOOK] Error processing webhook:", err);

    // Always return 200 to prevent retries (log error for debugging)
    return Response.json(
      {
        success: false,
        error: {
          code: err?.code || "INTERNAL_ERROR",
          message: err?.message || "Unexpected error",
        },
      },
      { headers: CORS }
    );
  }
});
