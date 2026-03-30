import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ServiceCallTracker, sanitizeHeaders } from '../_shared/external-service-utils.ts';

const RECALL_API_KEY = Deno.env.get("RECALL_API_KEY") || '';
const RECALL_REGION = Deno.env.get("RECALL_REGION") || "us-west-2";

/**
 * Request interface for syncing bot data from Recall.ai
 * @property bot_id - Recall.ai bot UUID to sync
 * @property force_sync - Force sync regardless of next_sync_at
 */
interface SyncRecallBotRequest {
  bot_id?: string;
  bot_ids?: string[];
  force_sync?: boolean;
}

/**
 * Response interface for sync operation
 */
interface SyncRecallBotResponse {
  success: boolean;
  bot_id: string;
  current_status: string;
  recording_status?: string;
  has_video_url: boolean;
  has_transcript_url: boolean;
  next_sync_at?: string;
  error?: string;
}

/**
 * Batch response interface for syncing multiple bots
 */
interface SyncRecallBotBatchResponse {
  success: boolean;
  total_bots: number;
  successful: number;
  failed: number;
  results: SyncRecallBotResponse[];
}

/**
 * Recall.ai Bot API Response Structure (matching docs/retrive-bot.json)
 */
interface RecallBotApiResponse {
  id: string;
  meeting_url: {
    meeting_id: string;
    platform: string;
  };
  bot_name: string;
  join_at: string;
  recording_config?: Record<string, any>;
  output_media?: Record<string, any>;
  automatic_leave?: Record<string, any>;
  status_changes: Array<{
    code: string;
    message: string | null;
    created_at: string;
    sub_code: string | null;
  }>;
  recordings?: Array<{
    id: string;
    created_at: string;
    started_at: string;
    completed_at: string;
    expires_at: string | null;
    status: {
      code: string;
      sub_code: string | null;
      updated_at: string;
    };
    media_shortcuts?: {
      video_mixed?: {
        id: string;
        created_at: string;
        status: {
          code: string;
          sub_code: string | null;
          updated_at: string;
        };
        metadata?: Record<string, any>;
        data?: {
          download_url: string;
        };
        format?: string;
      };
      transcript?: {
        id: string;
        created_at: string;
        status: {
          code: string;
          sub_code: string | null;
          updated_at: string;
        };
        metadata?: Record<string, any>;
        data?: {
          download_url: string;
          provider_data_download_url?: string;
        };
        diarization?: any;
        provider?: Record<string, any>;
      };
      participant_events?: {
        id: string;
        created_at: string;
        status: {
          code: string;
          sub_code: string | null;
          updated_at: string;
        };
        metadata?: Record<string, any>;
        data?: {
          participant_events_download_url: string;
          speaker_timeline_download_url: string;
          participants_download_url: string;
        };
      };
      meeting_metadata?: {
        id: string;
        created_at: string;
        status: {
          code: string;
          sub_code: string | null;
          updated_at: string;
        };
        metadata?: Record<string, any>;
        data?: {
          title: string | null;
          zoom?: any;
        };
      };
      audio_mixed?: {
        id: string;
        created_at: string;
        status: {
          code: string;
          sub_code: string | null;
          updated_at: string;
        };
        metadata?: Record<string, any>;
        data?: {
          download_url: string;
        };
      };
    };
    metadata?: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
  calendar_meetings?: any[];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Calculate next sync time based on current bot status
 * @param currentStatus - Current bot status code
 * @returns ISO timestamp for next sync, or null if no more syncing needed
 */
function calculateNextSyncAt(currentStatus: string): string | null {
  const now = new Date();

  switch (currentStatus) {
    case 'created':
    case 'ready':
      // Check every 5 minutes for bots waiting to join
      now.setMinutes(now.getMinutes() + 5);
      return now.toISOString();

    case 'joining_call':
    case 'in_waiting_room':
      // Check every 30 seconds while joining
      now.setSeconds(now.getSeconds() + 30);
      return now.toISOString();

    case 'in_call_not_recording':
    case 'in_call_recording':
      // Check every 30 seconds while actively recording
      now.setSeconds(now.getSeconds() + 30);
      return now.toISOString();

    case 'call_ended':
    case 'recording_done':
      // Check every 1 minute while processing
      now.setMinutes(now.getMinutes() + 1);
      return now.toISOString();

    case 'done':
      // No more syncing needed - recording is complete
      return null;

    case 'fatal':
    case 'analysis_failed':
      // Stop syncing on terminal failure states
      return null;

    default:
      // Unknown status - check again in 5 minutes
      now.setMinutes(now.getMinutes() + 5);
      return now.toISOString();
  }
}

/**
 * Sync a single bot from Recall.ai API
 * @param bot_id - Bot ID to sync
 * @param authHeader - Authorization header
 * @param force_sync - Force sync regardless of next_sync_at
 * @param supabaseClient - Supabase client instance
 * @returns Sync result for the bot
 */
async function syncSingleBot(
  bot_id: string,
  authHeader: string,
  force_sync: boolean,
  // deno-lint-ignore no-explicit-any
  supabaseClient: any
): Promise<SyncRecallBotResponse> {
  let tracker: ServiceCallTracker | null = null;
  let requestStartTime = 0;

  try {
    // Get project_id and transcript_requested from existing tracking record
    const { data: existingRecord } = await supabaseClient
      .from('recall_bot_tracking')
      .select('project_id, transcript_requested')
      .eq('bot_id', bot_id)
      .single();

    const projectId = existingRecord?.project_id || '';

    try {
      tracker = new ServiceCallTracker(supabaseClient, {
        projectId,
        serviceName: 'recall',
        serviceCategory: 'integration',
        endpointPath: `/api/v1/bot/${bot_id}`,
        operationType: 'sync',
        requestMethod: 'GET',
        requestUrl: `https://${RECALL_REGION}.recall.ai/api/v1/bot/${bot_id}`,
        requestHeaders: sanitizeHeaders({
          'Authorization': `Token ${RECALL_API_KEY}`,
          'accept': 'application/json'
        }),
        requestBody: {},
        requestParameters: { bot_id, force_sync },
      });

      console.log('[sync-recall-bot] Initializing service call tracker for Recall.ai API');
      await tracker.start();
      requestStartTime = Date.now();
    } catch (trackingSetupError) {
      console.warn('[sync-recall-bot] Tracking setup failed, continuing without tracking:', trackingSetupError);
      tracker = null;
    }

    console.log(`[sync-recall-bot] Fetching bot data for: ${bot_id}`);

    const recallResponse = await fetch(
      `https://${RECALL_REGION}.recall.ai/api/v1/bot/${bot_id}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Token ${RECALL_API_KEY}`,
          "accept": "application/json"
        },
      }
    );

    // Handle error responses
    if (!recallResponse.ok) {
      const errorData = await recallResponse.json().catch(() => ({}));
      console.error(`[sync-recall-bot] Recall API error: ${recallResponse.status}`, {
        status: recallResponse.status,
        error: errorData
      });

      // Record failure in tracker
      if (tracker) {
        try {
          await tracker.fail(errorData.message || 'Recall API error', recallResponse.status);
        } catch (trackerError) {
          console.error('[sync-recall-bot] Tracker error (non-blocking):', trackerError);
        }
      }

      // Store error in sync_errors array
      if (recallResponse.status === 404) {
        // Bot not found - update tracking record with error
        await supabaseClient
          .from('recall_bot_tracking')
          .update({
            sync_errors: supabaseClient.rpc('jsonb_append', {
              jsonb_column: 'sync_errors',
              new_element: JSON.stringify({
                timestamp: new Date().toISOString(),
                status: 404,
                error: 'Bot not found'
              })
            }),
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('bot_id', bot_id);
      }

      return {
        success: false,
        bot_id,
        current_status: 'unknown',
        has_video_url: false,
        has_transcript_url: false,
        error: errorData.message || `Recall API returned ${recallResponse.status}`
      };
    }

    const botData: RecallBotApiResponse = await recallResponse.json();
    console.log(`[sync-recall-bot] Bot data retrieved successfully: ${botData.id}`);

    // Extract status information from status_changes array (latest status)
    const latestStatus = botData.status_changes?.[botData.status_changes.length - 1];
    const currentStatus = latestStatus?.code || 'unknown';
    const currentSubCode = latestStatus?.sub_code || null;
    const statusUpdatedAt = latestStatus?.created_at || null;

    // Extract recording information (first recording)
    const primaryRecording = botData.recordings?.[0];
    const recordingId = primaryRecording?.id || null;
    const recordingStatus = primaryRecording?.status?.code || null;
    const recordingSubCode = primaryRecording?.status?.sub_code || null;
    const recordingCreatedAt = primaryRecording?.created_at || null;
    const recordingStartedAt = primaryRecording?.started_at || null;
    const recordingCompletedAt = primaryRecording?.completed_at || null;
    const recordingExpiresAt = primaryRecording?.expires_at || null;

    // Extract media shortcuts
    const mediaShortcuts = primaryRecording?.media_shortcuts;

    // Video media
    const videoMixed = mediaShortcuts?.video_mixed;
    const videoMediaId = videoMixed?.id || null;
    const videoDownloadUrl = videoMixed?.data?.download_url || null;
    const videoStatus = videoMixed?.status?.code || null;
    const videoFormat = videoMixed?.format || 'mp4';

    // Transcript media
    const transcript = mediaShortcuts?.transcript;
    const transcriptMediaId = transcript?.id || null;
    const transcriptDownloadUrl = transcript?.data?.download_url || null;
    const transcriptProviderDataUrl = transcript?.data?.provider_data_download_url || null;
    const transcriptStatus = transcript?.status?.code || null;
    const transcriptProvider = transcript?.provider || null;

    // Participant events
    const participantEvents = mediaShortcuts?.participant_events;
    const participantEventsId = participantEvents?.id || null;
    const participantEventsUrl = participantEvents?.data?.participant_events_download_url || null;
    const speakerTimelineUrl = participantEvents?.data?.speaker_timeline_download_url || null;
    const participantsUrl = participantEvents?.data?.participants_download_url || null;
    const participantEventsStatus = participantEvents?.status?.code || null;

    // Meeting metadata
    const meetingMetadata = mediaShortcuts?.meeting_metadata;
    const meetingMetadataId = meetingMetadata?.id || null;
    const meetingTitle = meetingMetadata?.data?.title || null;

    // Audio (optional)
    const audioMixed = mediaShortcuts?.audio_mixed;
    const audioMediaId = audioMixed?.id || null;
    const audioDownloadUrl = audioMixed?.data?.download_url || null;
    const audioStatus = audioMixed?.status?.code || null;

    // Calculate next sync time
    const nextSyncAt = calculateNextSyncAt(currentStatus);
    console.log(`[sync-recall-bot] Current status: ${currentStatus}, next sync: ${nextSyncAt}`);

    // Database upsert
    const { data: upsertData, error: upsertError } = await supabaseClient
      .from('recall_bot_tracking')
      .upsert({
        bot_id: botData.id,
        meeting_url: typeof botData.meeting_url === 'string'
          ? botData.meeting_url
          : JSON.stringify(botData.meeting_url),
        meeting_platform: botData.meeting_url?.platform || null,
        platform_meeting_id: botData.meeting_url?.meeting_id || null,
        bot_name: botData.bot_name,
        join_at: botData.join_at,
        recording_config: botData.recording_config || null,
        output_media: botData.output_media || null,
        automatic_leave: botData.automatic_leave || null,
        current_status: currentStatus,
        current_sub_code: currentSubCode,
        status_updated_at: statusUpdatedAt,
        status_changes: botData.status_changes || [],
        recording_id: recordingId,
        recording_status: recordingStatus,
        recording_sub_code: recordingSubCode,
        recording_created_at: recordingCreatedAt,
        recording_started_at: recordingStartedAt,
        recording_completed_at: recordingCompletedAt,
        recording_expires_at: recordingExpiresAt,
        video_media_id: videoMediaId,
        video_download_url: videoDownloadUrl,
        video_status: videoStatus,
        video_format: videoFormat,
        transcript_media_id: transcriptMediaId,
        transcript_download_url: transcriptDownloadUrl,
        transcript_provider_data_url: transcriptProviderDataUrl,
        transcript_status: transcriptStatus,
        transcript_provider: transcriptProvider,
        participant_events_id: participantEventsId,
        participant_events_url: participantEventsUrl,
        speaker_timeline_url: speakerTimelineUrl,
        participants_url: participantsUrl,
        participant_events_status: participantEventsStatus,
        meeting_metadata_id: meetingMetadataId,
        meeting_title: meetingTitle,
        audio_media_id: audioMediaId,
        audio_download_url: audioDownloadUrl,
        audio_status: audioStatus,
        last_sync_at: new Date().toISOString(),
        next_sync_at: nextSyncAt,
        sync_count: supabaseClient.raw('COALESCE(sync_count, 0) + 1'),
        metadata: botData.metadata || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'bot_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (upsertError) {
      console.error('[sync-recall-bot] Database upsert error:', upsertError);

      // Record failure in tracker
      if (tracker) {
        try {
          await tracker.fail(upsertError.message, 500);
        } catch (trackerError) {
          console.error('[sync-recall-bot] Tracker error (non-blocking):', trackerError);
        }
      }

      return {
        success: false,
        bot_id,
        current_status,
        has_video_url: !!videoDownloadUrl,
        has_transcript_url: !!transcriptDownloadUrl,
        error: `Database error: ${upsertError.message}`
      };
    }

    console.log(`[sync-recall-bot] Database updated successfully for bot: ${bot_id}`);

    // Transcript creation trigger
    if (currentStatus === 'done' &&
        recordingId &&
        !existingRecord?.transcript_requested) {

      console.log(`[sync-recall-bot] Recording completed, requesting transcript creation for recording: ${recordingId}`);

      try {
        const transcriptCreateResponse = await fetch(
          `https://${RECALL_REGION}.recall.ai/api/v1/recording/${recordingId}/create_transcript/`,
          {
            method: "POST",
            headers: {
              "Authorization": `Token ${RECALL_API_KEY}`,
              "Content-Type": "application/json",
              "accept": "application/json"
            },
            body: JSON.stringify({
              provider: {
                recallai_async: {
                  language_code: "auto"
                }
              },
              diarization: {
                use_separate_streams_when_available: true
              }
            })
          }
        );

        const transcriptResponseData = await transcriptCreateResponse.json();

        if (transcriptCreateResponse.ok) {
          console.log('[sync-recall-bot] Transcript creation requested successfully:', transcriptResponseData);

          // Update tracking record with transcript request info
          const { error: transcriptUpdateError } = await supabaseClient
            .from('recall_bot_tracking')
            .update({
              transcript_requested: true,
              transcript_requested_at: new Date().toISOString(),
              transcript_create_response: transcriptResponseData
            })
            .eq('bot_id', bot_id);

          if (transcriptUpdateError) {
            console.error('[sync-recall-bot] Failed to update transcript_requested flag:', transcriptUpdateError);
          } else {
            console.log('[sync-recall-bot] Transcript request tracking updated successfully');
          }
        } else {
          console.error('[sync-recall-bot] Transcript creation failed:', {
            status: transcriptCreateResponse.status,
            response: transcriptResponseData
          });

          // Store error but don't fail the main sync
          await supabaseClient
            .from('recall_bot_tracking')
            .update({
              transcript_last_error: `Transcript creation failed: ${JSON.stringify(transcriptResponseData)}`
            })
            .eq('bot_id', bot_id);
        }
      } catch (transcriptError) {
        // Non-blocking: log error but don't fail the main sync operation
        console.error('[sync-recall-bot] Error during transcript creation:', transcriptError);

        // Store error in tracking
        await supabaseClient
          .from('recall_bot_tracking')
          .update({
            transcript_last_error: transcriptError instanceof Error
              ? transcriptError.message
              : 'Unknown transcript creation error'
          })
          .eq('bot_id', bot_id);
      }
    }

    // Record successful completion
    if (tracker) {
      const durationMs = Date.now() - requestStartTime;
      try {
        await tracker.complete(
          recallResponse.status,
          botData,
          { duration_ms: durationMs }
        );
        console.log('[sync-recall-bot] Service call completed successfully:', { durationMs });
      } catch (trackerError) {
        console.error('[sync-recall-bot] Tracker error (non-blocking):', trackerError);
      }
    }

    // Return success response
    return {
      success: true,
      bot_id: botData.id,
      current_status: currentStatus,
      recording_status: recordingStatus || undefined,
      has_video_url: !!videoDownloadUrl,
      has_transcript_url: !!transcriptDownloadUrl,
      next_sync_at: nextSyncAt || undefined,
    };

  } catch (error) {
    console.error(`[sync-recall-bot] Error syncing bot ${bot_id}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });

    // Record failure in tracker
    if (tracker) {
      try {
        await tracker.fail(error instanceof Error ? error.message : 'Unknown error', 500);
      } catch (trackerError) {
        console.error('[sync-recall-bot] Tracker error:', trackerError);
      }
    }

    // Try to store error in sync_errors array
    try {
      if (supabaseClient) {
        await supabaseClient
          .from('recall_bot_tracking')
          .update({
            sync_errors: supabaseClient.raw(`
              COALESCE(sync_errors, '[]'::jsonb) ||
              '${JSON.stringify({
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
              })}'::jsonb
            `),
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('bot_id', bot_id);
      }
    } catch (errorLogError) {
      console.error('[sync-recall-bot] Failed to log error to database:', errorLogError);
    }

    return {
      success: false,
      bot_id,
      current_status: 'unknown',
      has_video_url: false,
      has_transcript_url: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

serve(async (req) => {
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

  const tracker: ServiceCallTracker | null = null;
  const requestStartTime = 0;
  // deno-lint-ignore no-explicit-any
  let supabaseClient: any = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header is required" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { bot_id, bot_ids, force_sync = false }: SyncRecallBotRequest = await req.json();

    // XOR validation - either bot_id OR bot_ids, not both
    if ((bot_id && bot_ids) || (!bot_id && !bot_ids)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Provide either bot_id (single) or bot_ids (array), not both"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate bot_ids array if provided
    if (bot_ids) {
      if (!Array.isArray(bot_ids) || bot_ids.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "bot_ids must be a non-empty array"
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (bot_ids.some(id => !id || typeof id !== 'string' || id.trim() === '')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "All bot_ids must be non-empty strings"
          }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Validate single bot_id if provided
    if (bot_id && (typeof bot_id !== 'string' || bot_id.trim() === '')) {
      return new Response(
        JSON.stringify({ success: false, error: "bot_id must be a non-empty string" }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!RECALL_API_KEY) {
      console.error("[sync-recall-bot] RECALL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "RECALL_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Normalize to array for consistent processing
    const botIdsToProcess = bot_ids || [bot_id as string];

    // === INITIALIZE SUPABASE CLIENT ===
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[sync-recall-bot] Supabase configuration missing');
      return new Response(
        JSON.stringify({ success: false, error: "Database configuration missing" }),
        { status: 500, headers: corsHeaders }
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Process bots sequentially
    console.log(`[sync-recall-bot] Processing ${botIdsToProcess.length} bot(s)`);
    const results: SyncRecallBotResponse[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const currentBotId of botIdsToProcess) {
      try {
        console.log(`[sync-recall-bot] Processing bot: ${currentBotId}`);

        const result = await syncSingleBot(
          currentBotId,
          authHeader,
          force_sync,
          supabaseClient
        );

        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

      } catch (error) {
        // Individual bot error - don't fail entire batch
        console.error(`[sync-recall-bot] Error processing bot ${currentBotId}:`, error);

        const errorResult: SyncRecallBotResponse = {
          success: false,
          bot_id: currentBotId,
          current_status: 'unknown',
          has_video_url: false,
          has_transcript_url: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };

        results.push(errorResult);
        failCount++;
      }
    }

    // Return appropriate response format
    if (bot_ids) {
      // Batch request - return batch response
      const batchResponse: SyncRecallBotBatchResponse = {
        success: failCount === 0,
        total_bots: botIdsToProcess.length,
        successful: successCount,
        failed: failCount,
        results
      };

      return new Response(
        JSON.stringify(batchResponse),
        { status: 200, headers: corsHeaders }
      );
    } else {
      // Single bot request - return single response (backward compatible)
      return new Response(
        JSON.stringify(results[0]),
        { status: results[0].success ? 200 : 500, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error("[sync-recall-bot] Unexpected error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
