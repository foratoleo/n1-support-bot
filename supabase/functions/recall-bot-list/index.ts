// file: supabase/functions/recall-bot-list/index.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: List all Recall.ai bots with auto-refresh from API

import { createClient } from "npm:@supabase/supabase-js";

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

// --- CORS Headers ---
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "no-store",
};

// --- Utility Functions ---
const nowIso = () => new Date().toISOString();

async function getRecallBotStatus(recallBotId: string) {
  const response = await fetch(`${RECALL_API_BASE_URL}/bot/${recallBotId}`, {
    method: "GET",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Recall API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

async function updateBotInDatabase(recallBotId: string, botData: any) {
  const statusChanges = botData.status_changes || [];
  const latestStatusChange = statusChanges.length > 0 ? statusChanges[statusChanges.length - 1].code : null;

  const { data, error } = await supabase
    .from("recall_bots")
    .update({
      status: botData.recordings?.[0]?.status?.code || latestStatusChange || "pending",
      metadata: botData,
      updated_at: nowIso(),
    })
    .eq("recall_bot_id", recallBotId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function storeOrUpdateRecording(botId: string, recordingData: any) {
  if (!recordingData || !recordingData.length) return null;

  const recording = recordingData[0];
  const videoUrl = recording.media_shortcuts?.video_mixed?.data?.download_url;
  const audioUrl = recording.media_shortcuts?.audio_mixed?.data?.download_url;
  const transcriptUrl = recording.media_shortcuts?.transcript?.data?.download_url;

  const { data, error } = await supabase
    .from("recall_recordings")
    .upsert({
      bot_id: botId,
      recall_recording_id: recording.id,
      status: recording.status?.code || "processing",
      started_at: recording.started_at || nowIso(),
      completed_at: recording.completed_at || null,
      video_url: videoUrl || null,
      audio_url: audioUrl || null,
      metadata: recording,
    }, {
      onConflict: "recall_recording_id",
    })
    .select()
    .single();

  if (error) throw error;

  if (transcriptUrl && recording.media_shortcuts?.transcript) {
    await storeOrUpdateTranscript(data.id, recording.media_shortcuts.transcript, transcriptUrl);
  }

  return data;
}

async function storeOrUpdateTranscript(recordingId: string, transcriptData: any, downloadUrl: string) {
  const transcriptResponse = await fetch(downloadUrl);
  const transcriptJson = await transcriptResponse.json();

  const { data, error } = await supabase
    .from("recall_transcripts")
    .upsert({
      recording_id: recordingId,
      recall_transcript_id: transcriptData.id,
      status: transcriptData.status?.code || "processing",
      language: transcriptData.provider?.recallai_streaming?.language_code || "auto",
      transcript_data: transcriptJson,
    }, {
      onConflict: "recall_transcript_id",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Main Handler ---
Deno.serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS });
    }

    // Only allow GET
    if (req.method !== "GET") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is allowed" } },
        { status: 405, headers: CORS }
      );
    }

    const { data: bots, error } = await supabase
      .from("view_recall_bots_with_data")
      .select(`
        id,
        recall_bot_id,
        meeting_url,
        bot_name,
        status,
        created_at,
        updated_at,
        recording_id,
        video_url,
        audio_url,
        transcript_id,
        transcript_data,
        transcript_status,
        language,
        meeting_transcript_id
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const updatedBots = await Promise.all(
      (bots || []).map(async (bot) => {
        try {
          const recallBotData = await getRecallBotStatus(bot.recall_bot_id);
          await updateBotInDatabase(bot.recall_bot_id, recallBotData);

          if (recallBotData.recordings && recallBotData.recordings.length > 0) {
            await storeOrUpdateRecording(bot.id, recallBotData.recordings);
          }

          const { data: updated } = await supabase
            .from("view_recall_bots_with_data")
            .select(`
              id,
              recall_bot_id,
              meeting_url,
              bot_name,
              status,
              created_at,
              updated_at,
              recording_id,
              video_url,
              audio_url,
              transcript_id,
              transcript_data,
              transcript_status,
              language,
              meeting_transcript_id
            `)
            .eq("id", bot.id)
            .single();

          return updated || bot;
        } catch (err) {
          console.error(`Failed to update bot ${bot.id}:`, err);
          return bot;
        }
      })
    );

    return Response.json(updatedBots, { headers: CORS });
  } catch (err: any) {
    console.error("Error in recall-bot-list function:", err);

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
