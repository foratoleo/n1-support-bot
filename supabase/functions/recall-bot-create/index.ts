/**
 * @deprecated 2026-03-14
 * Esta Edge Function foi substituida por `create-media-meeting`.
 * Nao utilizar em novos fluxos. Mantida apenas para referencia historica.
 */

// file: supabase/functions/recall-bot-create/index.ts
// Runtime: Supabase Edge Function (Deno)
// Purpose: Create Recall.ai recording bots

import { createClient } from 'npm:@supabase/supabase-js@2';
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
const CreateBotSchema = z.object({
  meetingUrl: z.string().url("Invalid meeting URL"),
  botName: z.string().min(2, "Bot name must be at least 2 characters").max(100, "Bot name too long"),
  traceId: z.string().optional(),
  // Optional join_at parameter
  joinAt: z.string().optional(),
  // Optional meeting and project IDs for database relationships
  meetingId: z.string().optional(),
  projectId: z.string().optional(),
  // Optional metadata fields
  projectName: z.string().optional(),
  createdBy: z.string().optional(),
  createdByName: z.string().optional(),
  createdByEmail: z.string().optional(),
  transcriptAgent: z.string().optional(),
  participants: z.string().optional(),
  sprintId: z.string().optional(),
  meetingTitle: z.string().optional(),
  meetingType: z.string().optional(),
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

interface RecallBotStatusChange {
  code: string;
  created_at: string;
}

interface RecallBotRecording {
  status?: { code: string };
}

interface RecallBotApiResponse {
  id: string;
  meeting_url: string;
  bot_name: string;
  status_changes: RecallBotStatusChange[];
  recordings?: RecallBotRecording[];
  [key: string]: unknown;
}

interface CreateBotMetadata {
  joinAt?: string;
  projectName?: string;
  projectId?: string;
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  transcriptAgent?: string;
  participants?: string;
  sprintId?: string;
  meetingTitle?: string;
  meetingType?: string;
}

async function createRecallBot(meetingUrl: string, botName: string, metadata: CreateBotMetadata = {}) {
  const response = await fetch(`${RECALL_API_BASE_URL}/bot`, {
    method: "POST",
    headers: {
      "Authorization": `Token ${RECALL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: botName,
      join_at: metadata.joinAt || '',
      metadata: {
        project_name: metadata.projectName || '',
        project_id: metadata.projectId || '',
        created_by: metadata.createdBy || '',
        created_by_name: metadata.createdByName || '',
        created_by_email: metadata.createdByEmail || '',
        transcript_agent: metadata.transcriptAgent || '',
        participants: metadata.participants || '',
        sprint_id: metadata.sprintId || '',
        meeting_title: metadata.meetingTitle || '',
        meeting_type: metadata.meetingType || ''
      },
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              language_code: "pt",
              mode: "prioritize_accuracy",
            },
          },
          diarization: {
            use_separate_streams_when_available: true,
          },
        },
      },
      automatic_leave: {
        waiting_room_timeout: 1200,
        noone_joined_timeout: 1200,
        everyone_left: {
          timeout: 30,
          activate_after: 120
        },
        in_call_not_recording_timeout: 2700,
        in_call_recording_timeout: 14400,
        recording_permission_denied_timeout: 30,
        silence_detection: {
          timeout: 2700,
          activate_after: 1800
        },
        bot_detection: {
          using_participant_events: {
            timeout: 1200,
            activate_after: 1200
          },
          using_participant_names: {
            matches: [
              "bot", "notetaker", "note taker", "recorder",
              "transcriber", "transcript", "ai", "assistant",
              "copilot", "fireflies", "otter", "fathom",
              "grain", "tl;dv", "fellow"
            ],
            timeout: 600,
            activate_after: 1800
          }
        }
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Recall API error: ${response.status} - ${errorData}`);
  }

  return await response.json();
}

async function storeBotInDatabase(
  botData: RecallBotApiResponse,
  meetingUrl: string,
  botName: string,
  meetingId?: string,
  projectId?: string
) {
  const statusChanges = botData.status_changes || [];
  const latestStatusChange = statusChanges.length > 0 ? statusChanges[statusChanges.length - 1].code : null;

  const { data, error } = await supabase
    .from("recall_bots")
    .insert({
      recall_bot_id: botData.id,
      meeting_url: meetingUrl,
      bot_name: botName,
      status: botData.recordings?.[0]?.status?.code || latestStatusChange || "pending",
      meeting_id: meetingId || null,
      project_id: projectId || null,
      metadata: botData,
      created_at: nowIso(),
      updated_at: nowIso(),
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

    // Only allow POST
    if (req.method !== "POST") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } },
        { status: 405, headers: CORS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateBotSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        { status: 400, headers: CORS }
      );
    }

    const {
      meetingUrl,
      botName,
      traceId,
      joinAt,
      meetingId,
      projectName,
      projectId,
      createdBy,
      createdByName,
      createdByEmail,
      transcriptAgent,
      participants,
      sprintId,
      meetingTitle,
      meetingType
    } = parsed.data;

    console.log(`[${traceId || "no-trace"}] Creating bot for meeting: ${meetingUrl}`);

    // Create bot via Recall.ai API with optional metadata
    const recallBotData = await createRecallBot(meetingUrl, botName, {
      joinAt,
      projectName,
      projectId,
      createdBy,
      createdByName,
      createdByEmail,
      transcriptAgent,
      participants,
      sprintId,
      meetingTitle,
      meetingType
    });

    // Store in database with meeting and project relationships
    const dbBot = await storeBotInDatabase(recallBotData, meetingUrl, botName, meetingId, projectId);

    console.log(`[${traceId || "no-trace"}] Bot created: ${dbBot.id} (Recall ID: ${recallBotData.id})`);

    return Response.json(
      {
        botId: dbBot.id,
        recallBotId: recallBotData.id,
        meetingUrl,
        botName,
        status: dbBot.status,
        createdAt: dbBot.created_at,
      },
      { headers: CORS }
    );
  } catch (err: unknown) {
    console.error("Error in recall-bot-create function:", err);

    const hasStatus = (e: unknown): e is Error & { status: number } =>
      e instanceof Error && typeof (e as Record<string, unknown>).status === 'number';
    const hasCode = (e: unknown): e is Error & { code: string } =>
      e instanceof Error && typeof (e as Record<string, unknown>).code === 'string';

    const status = hasStatus(err) ? err.status : 500;
    const code = hasCode(err) ? err.code : "INTERNAL_ERROR";
    const message = err instanceof Error ? err.message : "Unexpected error";

    return Response.json(
      {
        error: {
          code,
          message,
        },
      },
      { status, headers: CORS }
    );
  }
});
