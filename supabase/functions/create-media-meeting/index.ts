import { CreateMediaMeetingSchema, MediaApiError } from "./types.ts";
import {
  MEDIA_CALLBACK_SECRET,
  callMediaMeetingApi,
  fetchRecordingSettings,
  persistMeetingData,
  resolveAuthToken,
} from "./service.ts";

const MEDIA_TOOLS_JWT_SECRET = Deno.env.get("MEDIA_TOOLS_JWT_SECRET") || "";

if (!MEDIA_TOOLS_JWT_SECRET) {
  console.warn(
    JSON.stringify({
      level: "warn",
      fn: "create-media-meeting",
      message: "MEDIA_TOOLS_JWT_SECRET is not set. A per-project api_key must be present in meeting_recording_settings for every request, otherwise authentication will fail.",
    })
  );
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (req.method !== "POST") {
      return Response.json(
        { error: { code: "METHOD_NOT_ALLOWED", message: "Only POST is allowed" } },
        { status: 405, headers: CORS }
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = CreateMediaMeetingSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: parsed.error.message,
            details: parsed.error.errors,
          },
        },
        { status: 400, headers: CORS }
      );
    }

    const input = parsed.data;

    if (!MEDIA_CALLBACK_SECRET) {
      console.error(
        JSON.stringify({
          level: "error",
          fn: "create-media-meeting",
          message: "MEDIA_CALLBACK_SECRET is not configured",
        })
      );
      return Response.json(
        {
          error: {
            code: "CONFIGURATION_ERROR",
            message: "Callback secret is not configured. Cannot create meeting securely.",
          },
        },
        { status: 500, headers: CORS }
      );
    }

    if (MEDIA_CALLBACK_SECRET.length < 16) {
      console.warn(
        JSON.stringify({
          level: "warn",
          fn: "create-media-meeting",
          message: "MEDIA_CALLBACK_SECRET appears weak (below minimum length)",
        })
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        fn: "create-media-meeting",
        message: "Creating meeting bot",
        meetingId: input.meetingId,
        projectId: input.projectId,
      })
    );

    const recSettings = await fetchRecordingSettings(input.projectId);

    const authToken = resolveAuthToken(recSettings);

    if (!authToken) {
      console.error(
        JSON.stringify({
          level: "error",
          fn: "create-media-meeting",
          message: "No valid auth token available",
          source: recSettings?.api_key ? "db_api_key_invalid" : "env_var_missing",
        })
      );
      return Response.json(
        {
          error: {
            code: "CONFIGURATION_ERROR",
            message: "No valid auth token configured.",
          },
        },
        { status: 500, headers: CORS }
      );
    }

    const mediaMeeting = await callMediaMeetingApi(input, recSettings, authToken);

    console.log(
      JSON.stringify({
        level: "info",
        fn: "create-media-meeting",
        message: "Meeting bot created",
        mediaMeetingId: mediaMeeting.id,
        status: mediaMeeting.status,
      })
    );

    const persisted = await persistMeetingData(input.meetingId, mediaMeeting);

    return Response.json(
      {
        success: true,
        mediaMeetingId: mediaMeeting.id,
        status: mediaMeeting.status,
        processingStatus: mediaMeeting.processingStatus,
        ...(!persisted && {
          persistWarning: true,
          persistWarningMessage:
            "Bot created successfully but DB record could not be updated. media_meeting_id may be missing.",
        }),
      },
      { status: 201, headers: CORS }
    );
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        level: "error",
        fn: "create-media-meeting",
        message: "Unhandled error",
        error: err instanceof Error ? err.message : String(err),
      })
    );

    const isMediaApiError = (e: unknown): e is MediaApiError =>
      e instanceof Error && ("status" in e || "code" in e);

    const status = isMediaApiError(err) ? Number(err.status) || 500 : 500;
    const code = isMediaApiError(err) ? err.code || "INTERNAL_ERROR" : "INTERNAL_ERROR";
    const message = err instanceof Error ? err.message : "Unexpected error occurred";

    return Response.json(
      { error: { code, message } },
      { status, headers: CORS }
    );
  }
});
