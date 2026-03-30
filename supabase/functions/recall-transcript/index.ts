// file: supabase/functions/recall-transcript/index.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Create async transcripts for Recall.ai recordings

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

// --- Request Schemas ---
const CreateTranscriptSchema = z.object({
  botId: z.string().uuid("Invalid bot ID").optional(),
  languageCode: z.string().optional().default("pt"),
  traceId: z.string().optional(),
});

// --- CORS Headers ---
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// --- Utility Functions ---
const nowIso = () => new Date().toISOString();

async function getBotFromDatabase(botId: string) {
  const { data, error } = await supabase
    .from("recall_bots")
    .select("*")
    .eq("id", botId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getOldestPendingBot() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("recall_bots")
    .select("*")
    .eq("status", "pending")
    .gte("updated_at", twentyFourHoursAgo)
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getRecordingForBot(botId: string) {
  const { data, error } = await supabase
    .from("recall_recordings")
    .select("*")
    .eq("bot_id", botId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function createAsyncTranscript(recordingId: string, languageCode: string) {
  const response = await fetch(`${RECALL_API_BASE_URL}/recording/${recordingId}/create_transcript/`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: {
        recallai_async: {
          language_code: languageCode,
        },
      },
      diarization: {
        use_separate_streams_when_available: true,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Recall API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

async function storeTranscriptInDatabase(recordingId: string, transcriptData: any, languageCode: string) {
  const { data, error } = await supabase
    .from("recall_transcripts")
    .insert({
      recording_id: recordingId,
      recall_transcript_id: transcriptData.id,
      transcript_data: transcriptData || [],
      status: "pending",
      language: languageCode,
      created_at: nowIso(),
      updated_at: nowIso(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateBotStatus(botId: string, status: string) {
  const { error } = await supabase
    .from("recall_bots")
    .update({
      status,
      updated_at: nowIso(),
    })
    .eq("id", botId);

  if (error) throw error;
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
    const parsed = CreateTranscriptSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        { status: 400, headers: CORS }
      );
    }

    const { botId, languageCode, traceId } = parsed.data;

    // If botId not provided, get oldest pending bot from last 24 hours
    let bot;
    if (botId) {
      console.log(`[${traceId || "no-trace"}] Creating transcript for bot: ${botId}`);
      bot = await getBotFromDatabase(botId);

      if (!bot) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "Bot not found" } },
          { status: 404, headers: CORS }
        );
      }
    } else {
      console.log(`[${traceId || "no-trace"}] No botId provided, searching for oldest pending bot`);
      bot = await getOldestPendingBot();

      if (!bot) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "No pending bots found in the last 24 hours" } },
          { status: 404, headers: CORS }
        );
      }

      console.log(`[${traceId || "no-trace"}] Found pending bot: ${bot.id} (updated: ${bot.updated_at})`);
    }

    // Get latest recording for the bot
    const recording = await getRecordingForBot(bot.id);
    if (!recording) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "No recording found for this bot" } },
        { status: 404, headers: CORS }
      );
    }

    // Check if recording is completed
    if (recording.status !== "done") {
      return Response.json(
        { error: { code: "INVALID_STATE", message: "Recording is not yet complete" } },
        { status: 400, headers: CORS }
      );
    }

    console.log(`[${traceId || "no-trace"}] Creating async transcript for recording: ${recording.recall_recording_id}`);

    // Create async transcript via Recall.ai API
    const transcriptData = await createAsyncTranscript(recording.recall_recording_id, languageCode);

    // Store in database
    const dbTranscript = await storeTranscriptInDatabase(recording.id, transcriptData, languageCode);

    console.log(`[${traceId || "no-trace"}] Transcript created: ${dbTranscript.id} (Recall ID: ${transcriptData.id})`);

    // Update bot status from 'pending' to 'recording'
    await updateBotStatus(bot.id, "recording");
    console.log(`[${traceId || "no-trace"}] Bot status updated to 'recording' for bot: ${bot.id}`);

    return Response.json(
      {
        transcriptId: dbTranscript.id,
        recallTranscriptId: transcriptData.id,
        recordingId: recording.id,
        botId: bot.id,
        status: "pending",
        language: languageCode,
        createdAt: dbTranscript.created_at,
      },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("Error in recall-transcript function:", err);

    const status = Number(err?.status) || 500;
    return Response.json(
      {
        error: {
          code: err?.code || "INTERNAL_ERROR",
          message: err?.message || "Unexpected error",
        },
      },
      { status, headers: CORS }
    );
  }
});
