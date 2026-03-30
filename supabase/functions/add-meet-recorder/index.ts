/**
 * @deprecated 2026-03-14
 * Esta Edge Function foi substituida por `create-media-meeting`.
 * Nao utilizar em novos fluxos. Mantida apenas para referencia historica.
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { ServiceCallTracker, sanitizeHeaders } from '../_shared/external-service-utils.ts';
import { createInitialTrackingRecord, type RecallBotMetadata } from '../_shared/recall-bot-types.ts';

const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY");
const RECALL_REGION = Deno.env.get("RECALL_REGION") || "us-west-2";

// BotMetadata is now imported from recall-bot-types.ts as RecallBotMetadata

/**
 * Request interface for adding a meeting recorder bot
 * @property meeting_url - URL of the meeting to join
 * @property bot_name - Display name for the bot in the meeting
 * @property join_at - ISO 8601 datetime when bot should join (e.g., "2024-01-01T10:00:00Z")
 * @property metadata - Optional metadata about the recording session
 */
interface AddRecorderRequest {
  meeting_url: string;
  bot_name: string;
  join_at: string;
  metadata?: RecallBotMetadata;
}

interface RecallBotResponse {
  id: string;
  meeting_url: string;
  bot_name: string;
  join_at: string;
  status_changes: Array<{
    code: string;
    created_at: string;
  }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Only POST method is allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  let tracker: ServiceCallTracker | null = null;
  let requestStartTime = 0;
  let supabaseClient: SupabaseClient | null = null;

  try {
    const { meeting_url, bot_name, join_at, metadata }: AddRecorderRequest = await req.json();

    // Validate required fields
    if (!meeting_url || typeof meeting_url !== 'string' || meeting_url.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: "meeting_url is required and must be a non-empty string" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!bot_name || typeof bot_name !== 'string' || bot_name.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: "bot_name is required and must be a non-empty string" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!join_at || typeof join_at !== 'string' || join_at.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: "join_at is required and must be a non-empty string" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate join_at is ISO 8601 datetime
    const joinAtDate = new Date(join_at);
    if (isNaN(joinAtDate.getTime())) {
      return new Response(
        JSON.stringify({ success: false, error: "join_at must be a valid ISO 8601 datetime (e.g., '2024-01-01T10:00:00Z')" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!RECALL_API_KEY) {
      console.error("[add-meet-recorder] RECALL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "RECALL_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Extract metadata with defaults
    const {
      created_by = '',
      created_by_name = '',
      created_by_email = '',
      transcript_agent = '',
      participants = '',
      project_id = '',
      sprint_id = '',
      meeting_title = '',
      meeting_type = ''
    } = metadata || {};

    // Validate project_id metadata
    if (!metadata?.project_id) {
      console.warn('[add-meet-recorder] No project_id in metadata, tracking will use empty string');
    }

    // Project ID from metadata is used for tracking and filtering in external_service_calls table
    const projectId = metadata?.project_id || '';

    // === NON-BLOCKING TRACKING SETUP ===
    // Tracking is observational only - failures must NOT block the main Recall.ai API call
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseKey) {
      try {
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: req.headers.get('Authorization') || '',
            },
          },
        });

        // Initialize service call tracker
        tracker = new ServiceCallTracker(supabaseClient, {
          projectId,
          serviceName: 'recall',
          serviceCategory: 'integration',
          endpointPath: '/api/v1/bot',
          operationType: 'process',
          requestMethod: 'POST',
          requestUrl: `https://${RECALL_REGION}.recall.ai/api/v1/bot`,
          requestHeaders: sanitizeHeaders({
            'Authorization': `Token ${RECALL_API_KEY}`,
            'Content-Type': 'application/json',
            'accept': 'application/json'
          }),
          requestBody: {
            meeting_url,
            bot_name,
            join_at,
            metadata: {
              created_by,
              created_by_name,
              created_by_email,
              transcript_agent,
              participants,
              project_id,
              sprint_id,
              meeting_title,
              meeting_type
            }
          },
          requestParameters: {},
        });

        console.log('[add-meet-recorder] Initializing service call tracker for Recall.ai API');

        // Start tracking - wrapped in try-catch to ensure API call proceeds regardless
        const callId = await tracker.start();
        console.log('[add-meet-recorder] Service call tracking started:', callId);
      } catch (trackingSetupError) {
        // Tracking setup failed, but we continue with the main API call
        console.warn('[add-meet-recorder] Tracking setup failed, continuing without tracking:', trackingSetupError);
        tracker = null; // Ensure tracker is null so subsequent tracker calls are skipped
      }
    } else {
      console.warn('[add-meet-recorder] Supabase config missing, proceeding without service call tracking');
    }

    // Always record start time regardless of tracking status
    requestStartTime = Date.now();

    const recallResponse = await fetch(
      `https://${RECALL_REGION}.recall.ai/api/v1/bot`,
      {
        method: "POST",
        headers: {
          "Authorization": `Token ${RECALL_API_KEY}`,
          "Content-Type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          meeting_url,
          bot_name,
          join_at,
          recording_config: {
            transcript: {
              provider: {
                recallai_streaming: {
                  language_code: "pt",
                  mode: "prioritize_accuracy"
                }
              },
              diarization: {
                use_separate_streams_when_available: true
              }
            }
          },
          metadata: {
            created_by,
            created_by_name,
            created_by_email,
            transcript_agent,
            participants,
            project_id,
            sprint_id,
            meeting_title,
            meeting_type
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
      }
    );

    if (!recallResponse.ok) {
      const errorData = await recallResponse.json().catch(() => ({}));
      console.error(`[add-meet-recorder] Recall API error: ${recallResponse.status}`, {
        status: recallResponse.status,
        error: errorData
      });

      // Record failure in tracker (non-blocking)
      if (tracker) {
        try {
          await tracker.fail(errorData.message || 'Recall API error', recallResponse.status);
          console.log('[add-meet-recorder] Service call failure tracked:', { status: recallResponse.status, error: errorData });
        } catch (trackerError) {
          console.error('[add-meet-recorder] Tracker error (non-blocking):', trackerError);
        }
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.message || `Recall API returned ${recallResponse.status}`,
        }),
        {
          status: recallResponse.status,
          headers: corsHeaders,
        }
      );
    }

    const botData: RecallBotResponse = await recallResponse.json();

    console.log(`[add-meet-recorder] Bot created successfully: ${botData.id}`);

    // Record successful completion (non-blocking)
    if (tracker) {
      const durationMs = Date.now() - requestStartTime;
      try {
        await tracker.complete(
          recallResponse.status,
          botData,
          { duration_ms: durationMs }
        );
        console.log('[add-meet-recorder] Service call completed successfully:', { durationMs });
      } catch (trackerError) {
        console.error('[add-meet-recorder] Tracker error (non-blocking):', trackerError);
      }
    }

    // === CREATE INITIAL TRACKING RECORD (NON-BLOCKING) ===
    // Track the bot in recall_bot_tracking table for status monitoring
    let trackingId: string | null = null;
    if (supabaseClient) {
      try {
        console.log('[add-meet-recorder] Creating initial tracking record for bot:', botData.id);

        // Create initial tracking record using helper function
        const trackingRecord = createInitialTrackingRecord(
          botData.id,
          projectId,
          meeting_url,
          bot_name,
          join_at,
          metadata,
          metadata?.meeting_id // Optional meeting_id from metadata
        );

        const { data: trackingData, error: trackingError } = await supabaseClient
          .from('recall_bot_tracking')
          .insert(trackingRecord)
          .select('id')
          .single();

        if (trackingError) {
          // Log error but don't fail the response - bot was created successfully
          console.error('[add-meet-recorder] Failed to create tracking record (non-blocking):', {
            error: trackingError,
            bot_id: botData.id
          });
        } else {
          trackingId = trackingData.id;
          console.log('[add-meet-recorder] Tracking record created successfully:', trackingId);
        }
      } catch (trackingSetupError) {
        // Tracking failed, but bot creation succeeded - log and continue
        console.error('[add-meet-recorder] Tracking setup error (non-blocking):', trackingSetupError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        botId: botData.id,
        meetingUrl: botData.meeting_url,
        botName: botData.bot_name,
        joinAt: botData.join_at,
        status: botData.status_changes?.[0]?.code || "created",
        trackingId: trackingId, // Include tracking ID if created
      }),
      {
        status: 201,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("[add-meet-recorder] Error creating Recall bot:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });

    // Record failure in tracker
    if (tracker) {
      try {
        await tracker.fail(error instanceof Error ? error.message : 'Unknown error', 500);
      } catch (trackerError) {
        console.error('[add-meet-recorder] Tracker error:', trackerError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
