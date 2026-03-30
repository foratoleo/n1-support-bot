import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  CreateMediaMeetingInput,
  MediaApiError,
  MediaMeetingResult,
  MeetingRecordingSettings,
} from "./types.ts";

const MEDIA_TOOLS_API_URL =
  Deno.env.get("MEDIA_TOOLS_API_URL") ||
  "https://media.digitalrepublic.dev.br";
const MEDIA_CALLBACK_SECRET = Deno.env.get("MEDIA_CALLBACK_SECRET") || "";
const SUPABASE_URL =
  Deno.env.get("DB_URL") ||
  Deno.env.get("SUPABASE_URL") ||
  "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("DB_SERVICE_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";
const MEDIA_TOOLS_JWT_SECRET = Deno.env.get("MEDIA_TOOLS_JWT_SECRET") || "";

export { MEDIA_CALLBACK_SECRET, SUPABASE_URL };

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchRecordingSettings(
  projectId: string
): Promise<MeetingRecordingSettings | null> {
  const { data, error } = await supabase
    .from("meeting_recording_settings")
    .select("api_key, disclaimer_text, logo_not_recording_url, logo_recording_url")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        fn: "create-media-meeting",
        message: "Failed to fetch meeting_recording_settings",
        projectId,
        error: error.message,
      })
    );
    return null;
  }

  if (data) {
    console.log(
      JSON.stringify({
        level: "info",
        fn: "create-media-meeting",
        message: "Recording settings found",
        projectId,
        hasApiKey: !!data.api_key,
        hasDisclaimer: !!data.disclaimer_text,
        hasLogoNotRecording: !!data.logo_not_recording_url,
        hasLogoRecording: !!data.logo_recording_url,
      })
    );
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        fn: "create-media-meeting",
        message: "No recording settings found, using defaults",
        projectId,
      })
    );
  }

  return data ?? null;
}

export function resolveAuthToken(
  recSettings: MeetingRecordingSettings | null
): string | null {
  const rawToken = recSettings?.api_key?.trim() || MEDIA_TOOLS_JWT_SECRET;

  if (!rawToken || rawToken.length < 16) {
    return null;
  }

  console.log(
    JSON.stringify({
      level: "info",
      fn: "create-media-meeting",
      message: "Auth token resolved",
      source: recSettings?.api_key?.trim() ? "db_api_key" : "env_var",
    })
  );

  return rawToken;
}

export async function callMediaMeetingApi(
  input: CreateMediaMeetingInput,
  recSettings: MeetingRecordingSettings | null,
  authToken: string
): Promise<MediaMeetingResult> {
  const callbackUrl = `${SUPABASE_URL}/functions/v1/media-meeting-callback`;

  const disclaimer = recSettings?.disclaimer_text?.trim();
  const logoNotRecording = recSettings?.logo_not_recording_url?.trim();
  const logoRecording = recSettings?.logo_recording_url?.trim();

  const payload: Record<string, unknown> = {
    meetingUrl: input.meetingUrl,
    externalMeetingId: input.meetingId,
    externalProjectId: input.projectId,
    botName: input.botName || "DR AI",
    callbackUrl,
    callbackHeaders: {
      "X-Callback-Secret": MEDIA_CALLBACK_SECRET,
    },
    languageCode: input.languageCode || "pt",
    metadata: {
      meetingTitle: input.meetingTitle || "",
      meetingType: input.meetingType || "",
      createdByName: input.createdByName || "",
      participants: input.participants || "",
    },
    ...(disclaimer && { disclaimer }),
    ...(logoNotRecording &&
      isValidHttpsUrl(logoNotRecording) && { logoNotRecordingUrl: logoNotRecording }),
    ...(logoRecording &&
      isValidHttpsUrl(logoRecording) && { logoRecordingUrl: logoRecording }),
  };

  if (input.joinAt) {
    payload.joinAt = input.joinAt;
  }

  const response = await fetch(`${MEDIA_TOOLS_API_URL}/api/meetings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    const errorMessage =
      typeof errorBody === "object" && errorBody !== null
        ? (errorBody as Record<string, unknown>).error || JSON.stringify(errorBody)
        : String(errorBody);

    if (response.status === 400) {
      const err = new Error(
        `Validation error from media API: ${errorMessage}`
      ) as MediaApiError;
      err.status = 400;
      err.code = "MEDIA_API_VALIDATION_ERROR";
      throw err;
    }

    if (response.status === 401) {
      const err = new Error(
        `Authentication error from media API: ${errorMessage}`
      ) as MediaApiError;
      err.status = 401;
      err.code = "MEDIA_API_AUTH_ERROR";
      throw err;
    }

    const err = new Error(
      `Media API error (${response.status}): ${errorMessage}`
    ) as MediaApiError;
    err.status = 502;
    err.code = "MEDIA_API_ERROR";
    throw err;
  }

  const data = await response.json();
  return {
    id: data.id,
    status: data.status,
    processingStatus: data.processingStatus,
  };
}

export async function persistMeetingData(
  meetingId: string,
  mediaMeeting: MediaMeetingResult
): Promise<boolean> {
  const { error } = await supabase
    .from("meetings")
    .update({
      media_meeting_id: mediaMeeting.id,
      media_bot_status: mediaMeeting.status,
      media_processing_status: mediaMeeting.processingStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meetingId);

  if (error) {
    console.error(
      JSON.stringify({
        level: "error",
        fn: "create-media-meeting",
        message: "Failed to persist media data",
        meetingId,
        error: error.message,
      })
    );
    return false;
  }

  console.log(
    JSON.stringify({
      level: "info",
      fn: "create-media-meeting",
      message: "Persisted media data",
      meetingId,
      mediaMeetingId: mediaMeeting.id,
      botStatus: mediaMeeting.status,
      processingStatus: mediaMeeting.processingStatus,
    })
  );

  return true;
}
