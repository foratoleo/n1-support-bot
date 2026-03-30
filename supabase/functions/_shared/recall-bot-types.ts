/**
 * TypeScript types for Recall.ai Bot Recording Tracking
 *
 * This module provides comprehensive type definitions for tracking
 * Recall.ai bot recordings from creation through completion, including
 * API response structures, database records, and helper functions.
 *
 * @see https://docs.recall.ai/docs/api-reference
 * @see /Users/thiagomontini/PROJECTS/dr-ai-workforce/docs/retrive-bot.json
 */

/**
 * Bot status codes from Recall.ai API
 * Represents the current state of the bot in the meeting lifecycle
 */
export type RecallBotStatus =
  | 'created'                    // Bot created but not yet joining
  | 'ready'                      // Bot ready to join at scheduled time
  | 'joining_call'               // Bot is joining the meeting
  | 'in_waiting_room'            // Bot is waiting for host to admit
  | 'in_call_not_recording'      // Bot joined but not yet recording
  | 'in_call_recording'          // Bot is actively recording
  | 'call_ended'                 // Meeting ended, processing recording
  | 'recording_done'             // Recording processing complete
  | 'done'                       // Bot completed, all media available
  | 'fatal';                     // Bot encountered fatal error

/**
 * Meeting platform types
 * Identifies the video conferencing platform for the meeting
 */
export type MeetingPlatform =
  | 'google_meet'
  | 'zoom'
  | 'teams'
  | 'webex'
  | 'unknown';

/**
 * Recording/Media status codes
 * Tracks the processing status of individual media files
 */
export type RecordingStatus =
  | 'processing'                 // Media is being processed
  | 'done'                       // Media is ready and downloadable
  | 'failed';                    // Media processing failed

/**
 * Status sub-codes for additional context
 * Provides detailed information about specific status conditions
 */
export type RecallBotSubCode =
  | 'call_ended_by_host'
  | 'call_ended_by_participant'
  | 'recording_permission_denied'
  | 'bot_kicked'
  | 'bot_banned'
  | null;

/**
 * Meeting URL structure from Recall.ai API
 */
export interface RecallMeetingUrl {
  meeting_id: string;
  platform: MeetingPlatform;
}

/**
 * Status change event from Recall.ai API
 */
export interface RecallStatusChange {
  code: RecallBotStatus;
  message: string | null;
  created_at: string;
  sub_code: RecallBotSubCode;
}

/**
 * Media status structure
 */
export interface RecallMediaStatus {
  code: RecordingStatus;
  sub_code: string | null;
  updated_at: string;
}

/**
 * Video media data from API
 */
export interface RecallVideoMedia {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, unknown>;
  data: {
    download_url: string;
  };
  format: string;
}

/**
 * Transcript provider configuration
 */
export interface RecallTranscriptProvider {
  recallai_streaming?: {
    language_code: string;
    filter_profanity?: boolean;
    mode?: string;
  };
}

/**
 * Transcript media data from API
 */
export interface RecallTranscriptMedia {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, unknown>;
  data: {
    download_url: string;
    provider_data_download_url: string;
  };
  diarization: unknown | null;
  provider: RecallTranscriptProvider;
}

/**
 * Participant events media data from API
 */
export interface RecallParticipantEventsMedia {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, unknown>;
  data: {
    participant_events_download_url: string;
    speaker_timeline_download_url: string;
    participants_download_url: string;
  };
}

/**
 * Meeting metadata from API
 */
export interface RecallMeetingMetadata {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, unknown>;
  data: {
    title: string | null;
    zoom: unknown | null;
  };
}

/**
 * Audio media data from API (optional)
 */
export interface RecallAudioMedia {
  id: string;
  created_at: string;
  status: RecallMediaStatus;
  metadata: Record<string, unknown>;
  data: {
    download_url: string;
  };
}

/**
 * Media shortcuts collection from recordings
 * Contains all downloadable media types for the recording
 */
export interface RecallMediaShortcuts {
  video_mixed: RecallVideoMedia;
  transcript: RecallTranscriptMedia;
  participant_events: RecallParticipantEventsMedia;
  meeting_metadata: RecallMeetingMetadata;
  audio_mixed: RecallAudioMedia | null;
}

/**
 * Recording configuration from API
 */
export interface RecallRecordingConfig {
  transcript?: {
    provider: RecallTranscriptProvider;
  };
  realtime_endpoints?: unknown[];
  retention?: {
    type: string;
  };
  video_mixed_layout?: string;
  video_mixed_mp4?: Record<string, unknown>;
  participant_events?: Record<string, unknown>;
  meeting_metadata?: Record<string, unknown>;
  video_mixed_participant_video_when_screenshare?: string;
  start_recording_on?: string;
}

/**
 * Recording data structure from API
 */
export interface RecallRecording {
  id: string;
  created_at: string;
  started_at: string;
  completed_at: string;
  expires_at: string | null;
  status: RecallMediaStatus;
  media_shortcuts: RecallMediaShortcuts;
  metadata: Record<string, unknown>;
}

/**
 * Output media configuration
 */
export interface RecallOutputMedia {
  camera?: {
    kind: string;
    config: {
      url: string;
    };
  };
}

/**
 * Automatic leave configuration
 */
export interface RecallAutomaticLeave {
  waiting_room_timeout?: number;
  noone_joined_timeout?: number;
  everyone_left_timeout?: {
    timeout: number;
    activate_after: number | null;
  };
  in_call_not_recording_timeout?: number;
  recording_permission_denied_timeout?: number;
  silence_detection?: {
    timeout: number;
    activate_after: number;
  };
  bot_detection?: {
    using_participant_events?: {
      timeout: number;
      activate_after: number;
    };
  };
}

/**
 * Bot metadata structure
 * Custom metadata stored with the bot for tracking purposes
 */
export interface RecallBotMetadata {
  created_by?: string;
  created_by_name?: string;
  created_by_email?: string;
  transcript_agent?: string;
  participants?: string;
  project_id?: string;
  sprint_id?: string;
  meeting_title?: string;
  meeting_type?: string;
  [key: string]: unknown;
}

/**
 * Complete Recall.ai Bot API Response
 * Structure returned from GET /api/v1/bot/{bot_id}
 *
 * @see /Users/thiagomontini/PROJECTS/dr-ai-workforce/docs/retrive-bot.json
 */
export interface RecallBotApiResponse {
  id: string;
  meeting_url: RecallMeetingUrl;
  bot_name: string;
  join_at: string;
  recording_config: RecallRecordingConfig;
  status_changes: RecallStatusChange[];
  recordings: RecallRecording[];
  output_media: RecallOutputMedia;
  automatic_leave: RecallAutomaticLeave;
  calendar_meetings: unknown[];
  metadata: RecallBotMetadata;
}

/**
 * Sync error structure for tracking failed sync attempts
 */
export interface RecallSyncError {
  timestamp: string;
  error_message: string;
  status_code?: number;
  retry_attempt?: number;
}

/**
 * Speaker segment in transcript
 * Represents consecutive words spoken by the same person
 */
export interface SpeakerSegment {
  speaker: string;
  text: string;
  start_time: number;
  end_time: number;
  word_count: number;
}

/**
 * Transcript metadata structure stored in meeting_transcripts.transcript_metadata
 * Contains structured transcript data with speaker information and timing
 */
export interface TranscriptMetadata {
  original_words: number;
  grouped_by_speaker: SpeakerSegment[];
  conversation_format: string;
  speakers: string[];
  duration_seconds: number;
  language: string;
  bot_id: string;
  recording_id: string | null;
  processed_at: string;
}

/**
 * Meeting transcript database row
 * Represents the meeting_transcripts table structure
 */
export interface MeetingTranscript {
  id: string;
  meeting_id: string;
  project_id: string;
  transcript_text: string;
  transcript_metadata: TranscriptMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for recall_bot_tracking table
 * Matches the database schema with proper TypeScript types
 *
 * @see supabase/migrations/20251128_create_recall_bot_tracking.sql
 */
export interface RecallBotTrackingRow {
  // Core identifiers
  id: string;
  bot_id: string;

  // Project & Meeting Relations
  project_id: string;
  meeting_id: string | null;

  // Meeting URL Info
  meeting_url: string;
  meeting_platform: string | null;
  platform_meeting_id: string | null;

  // Bot Configuration
  bot_name: string;
  join_at: Date;
  recording_config: Record<string, unknown> | null;
  output_media: Record<string, unknown> | null;
  automatic_leave: Record<string, unknown> | null;

  // Status Tracking
  current_status: string;
  current_sub_code: string | null;
  status_updated_at: Date | null;
  status_changes: unknown[];

  // Recording Info
  recording_id: string | null;
  recording_status: string | null;
  recording_sub_code: string | null;
  recording_created_at: Date | null;
  recording_started_at: Date | null;
  recording_completed_at: Date | null;
  recording_expires_at: Date | null;

  // Video Media
  video_media_id: string | null;
  video_download_url: string | null;
  video_status: string | null;
  video_format: string | null;

  // Transcript Media
  transcript_media_id: string | null;
  transcript_download_url: string | null;
  transcript_provider_data_url: string | null;
  transcript_status: string | null;
  transcript_provider: Record<string, unknown> | null;

  // Transcript Processing (added by migration 20251128220930)
  transcript_requested: boolean;
  transcript_requested_at: Date | null;
  transcript_create_response: Record<string, unknown> | null;
  transcript_processed: boolean;
  transcript_processed_at: Date | null;
  transcript_processing_attempts: number;
  transcript_last_error: string | null;
  transcript_next_retry_at: Date | null;

  // Participant Events
  participant_events_id: string | null;
  participant_events_url: string | null;
  speaker_timeline_url: string | null;
  participants_url: string | null;
  participant_events_status: string | null;

  // Meeting Metadata
  meeting_metadata_id: string | null;
  meeting_title: string | null;

  // Audio (optional)
  audio_media_id: string | null;
  audio_download_url: string | null;
  audio_status: string | null;

  // Download Status Tracking
  video_downloaded: boolean;
  video_downloaded_at: Date | null;
  transcript_downloaded: boolean;
  transcript_downloaded_at: Date | null;
  participant_events_downloaded: boolean;
  participant_events_downloaded_at: Date | null;

  // Sync Management
  last_sync_at: Date | null;
  next_sync_at: Date | null;
  sync_count: number;
  sync_errors: unknown[];

  // Custom Metadata
  metadata: Record<string, unknown>;

  // Audit Fields
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * Insert data for creating initial tracking record
 * Used when bot is first created via add-meet-recorder
 */
export interface RecallBotTrackingInsert {
  bot_id: string;
  project_id: string;
  meeting_id?: string;
  meeting_url: string;
  meeting_platform?: string;
  platform_meeting_id?: string;
  bot_name: string;
  join_at: string;
  recording_config?: Record<string, unknown>;
  output_media?: Record<string, unknown>;
  automatic_leave?: Record<string, unknown>;
  current_status: string;
  status_changes?: unknown[];
  next_sync_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Parse meeting URL to extract platform and meeting ID
 *
 * @param url - Meeting URL to parse
 * @returns Object with platform and meeting ID
 */
export function parseMeetingUrl(url: string): {
  platform: MeetingPlatform;
  meetingId: string | null;
} {
  const urlLower = url.toLowerCase();

  // Google Meet
  if (urlLower.includes('meet.google.com')) {
    const match = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
    return {
      platform: 'google_meet',
      meetingId: match ? match[1] : null,
    };
  }

  // Zoom
  if (urlLower.includes('zoom.us') || urlLower.includes('zoom.com')) {
    const match = url.match(/\/j\/(\d+)/);
    return {
      platform: 'zoom',
      meetingId: match ? match[1] : null,
    };
  }

  // Microsoft Teams
  if (urlLower.includes('teams.microsoft.com') || urlLower.includes('teams.live.com')) {
    const match = url.match(/\/l\/meetup-join\/([^/?]+)/);
    return {
      platform: 'teams',
      meetingId: match ? match[1] : null,
    };
  }

  // Webex
  if (urlLower.includes('webex.com')) {
    const match = url.match(/\/meet\/([^/?]+)/);
    return {
      platform: 'webex',
      meetingId: match ? match[1] : null,
    };
  }

  return {
    platform: 'unknown',
    meetingId: null,
  };
}

/**
 * Calculate next sync time based on bot status
 *
 * Sync intervals by status:
 * - created/ready: 5 minutes (bot hasn't joined yet)
 * - joining_call/in_waiting_room: 30 seconds (critical phase)
 * - in_call_recording: 30 seconds (actively recording)
 * - call_ended/recording_done: 1 minute (processing phase)
 * - done: null (no more syncing needed)
 * - fatal: null (terminal state)
 *
 * @param status - Current bot status
 * @param joinAt - Scheduled join time (ISO 8601)
 * @returns ISO 8601 timestamp for next sync or null if no more syncing needed
 */
export function calculateNextSyncTime(status: RecallBotStatus, joinAt?: string): string | null {
  const now = new Date();

  // Terminal states - no more syncing needed
  if (status === 'done' || status === 'fatal') {
    return null;
  }

  // For 'created' or 'ready' status, check join_at time
  if ((status === 'created' || status === 'ready') && joinAt) {
    const joinDate = new Date(joinAt);
    const minutesUntilJoin = (joinDate.getTime() - now.getTime()) / (1000 * 60);

    // If join is more than 5 minutes away, sync 5 minutes before join
    if (minutesUntilJoin > 5) {
      const syncTime = new Date(joinDate.getTime() - (5 * 60 * 1000));
      return syncTime.toISOString();
    }

    // If join is within 5 minutes, sync in 30 seconds
    const nextSync = new Date(now.getTime() + (30 * 1000));
    return nextSync.toISOString();
  }

  // Active states - frequent syncing
  if (status === 'joining_call' || status === 'in_waiting_room' || status === 'in_call_recording') {
    const nextSync = new Date(now.getTime() + (30 * 1000)); // 30 seconds
    return nextSync.toISOString();
  }

  // Processing states - moderate syncing
  if (status === 'in_call_not_recording' || status === 'call_ended' || status === 'recording_done') {
    const nextSync = new Date(now.getTime() + (60 * 1000)); // 1 minute
    return nextSync.toISOString();
  }

  // Default: 5 minutes
  const nextSync = new Date(now.getTime() + (5 * 60 * 1000));
  return nextSync.toISOString();
}

/**
 * Convert Recall.ai API response to database row format
 * Maps API response fields to database columns
 *
 * @param apiResponse - Complete API response from Recall.ai
 * @param projectId - Project ID for tracking
 * @param meetingId - Optional meeting ID for association
 * @returns Database insert/update object
 */
export function apiResponseToDbRow(
  apiResponse: RecallBotApiResponse,
  projectId: string,
  meetingId?: string
): Partial<RecallBotTrackingRow> {
  // Get latest status change
  const latestStatus = apiResponse.status_changes?.[apiResponse.status_changes.length - 1];

  // Get primary recording (first in array)
  const recording = apiResponse.recordings?.[0];

  // Parse meeting URL
  const { platform, meetingId: platformMeetingId } = parseMeetingUrl(
    typeof apiResponse.meeting_url === 'string'
      ? apiResponse.meeting_url
      : `https://meet.google.com/${apiResponse.meeting_url.meeting_id}`
  );

  // Calculate next sync time
  const nextSyncAt = calculateNextSyncTime(latestStatus?.code, apiResponse.join_at);

  const dbRow: Partial<RecallBotTrackingRow> = {
    bot_id: apiResponse.id,
    project_id: projectId,
    meeting_id: meetingId || null,

    // Meeting URL Info
    meeting_url: typeof apiResponse.meeting_url === 'string'
      ? apiResponse.meeting_url
      : `https://meet.google.com/${apiResponse.meeting_url.meeting_id}`,
    meeting_platform: platform !== 'unknown' ? platform : apiResponse.meeting_url.platform,
    platform_meeting_id: platformMeetingId || apiResponse.meeting_url.meeting_id,

    // Bot Configuration
    bot_name: apiResponse.bot_name,
    join_at: new Date(apiResponse.join_at),
    recording_config: apiResponse.recording_config as Record<string, unknown>,
    output_media: apiResponse.output_media as Record<string, unknown>,
    automatic_leave: apiResponse.automatic_leave as Record<string, unknown>,

    // Status Tracking
    current_status: latestStatus?.code || 'created',
    current_sub_code: latestStatus?.sub_code || null,
    status_updated_at: latestStatus?.created_at ? new Date(latestStatus.created_at) : null,
    status_changes: apiResponse.status_changes as unknown[],

    // Sync Management
    last_sync_at: new Date(),
    next_sync_at: nextSyncAt ? new Date(nextSyncAt) : null,

    // Custom Metadata
    metadata: apiResponse.metadata as Record<string, unknown>,
  };

  // Add recording data if available
  if (recording) {
    dbRow.recording_id = recording.id;
    dbRow.recording_status = recording.status.code;
    dbRow.recording_sub_code = recording.status.sub_code;
    dbRow.recording_created_at = new Date(recording.created_at);
    dbRow.recording_started_at = new Date(recording.started_at);
    dbRow.recording_completed_at = new Date(recording.completed_at);
    dbRow.recording_expires_at = recording.expires_at ? new Date(recording.expires_at) : null;

    // Video media
    if (recording.media_shortcuts?.video_mixed) {
      const video = recording.media_shortcuts.video_mixed;
      dbRow.video_media_id = video.id;
      dbRow.video_download_url = video.data.download_url;
      dbRow.video_status = video.status.code;
      dbRow.video_format = video.format;
    }

    // Transcript media
    if (recording.media_shortcuts?.transcript) {
      const transcript = recording.media_shortcuts.transcript;
      dbRow.transcript_media_id = transcript.id;
      dbRow.transcript_download_url = transcript.data.download_url;
      dbRow.transcript_provider_data_url = transcript.data.provider_data_download_url;
      dbRow.transcript_status = transcript.status.code;
      dbRow.transcript_provider = transcript.provider as Record<string, unknown>;
    }

    // Participant events
    if (recording.media_shortcuts?.participant_events) {
      const events = recording.media_shortcuts.participant_events;
      dbRow.participant_events_id = events.id;
      dbRow.participant_events_url = events.data.participant_events_download_url;
      dbRow.speaker_timeline_url = events.data.speaker_timeline_download_url;
      dbRow.participants_url = events.data.participants_download_url;
      dbRow.participant_events_status = events.status.code;
    }

    // Meeting metadata
    if (recording.media_shortcuts?.meeting_metadata) {
      const metadata = recording.media_shortcuts.meeting_metadata;
      dbRow.meeting_metadata_id = metadata.id;
      dbRow.meeting_title = metadata.data.title;
    }

    // Audio media (optional)
    if (recording.media_shortcuts?.audio_mixed) {
      const audio = recording.media_shortcuts.audio_mixed;
      dbRow.audio_media_id = audio.id;
      dbRow.audio_download_url = audio.data.download_url;
      dbRow.audio_status = audio.status.code;
    }
  }

  return dbRow;
}

/**
 * Create initial tracking insert from bot creation request
 * Used by add-meet-recorder to create tracking record when bot is first created
 *
 * @param botId - Recall.ai bot ID
 * @param projectId - Project ID
 * @param meetingUrl - Meeting URL
 * @param botName - Bot display name
 * @param joinAt - Scheduled join time (ISO 8601)
 * @param metadata - Optional custom metadata
 * @param meetingId - Optional meeting ID
 * @returns Database insert object
 */
export function createInitialTrackingRecord(
  botId: string,
  projectId: string,
  meetingUrl: string,
  botName: string,
  joinAt: string,
  metadata?: RecallBotMetadata,
  meetingId?: string
): RecallBotTrackingInsert {
  const { platform, meetingId: platformMeetingId } = parseMeetingUrl(meetingUrl);
  const nextSyncAt = calculateNextSyncTime('created', joinAt);

  return {
    bot_id: botId,
    project_id: projectId,
    meeting_id: meetingId,
    meeting_url: meetingUrl,
    meeting_platform: platform,
    platform_meeting_id: platformMeetingId,
    bot_name: botName,
    join_at: joinAt,
    current_status: 'created',
    status_changes: [{
      code: 'created',
      message: null,
      created_at: new Date().toISOString(),
      sub_code: null,
    }],
    next_sync_at: nextSyncAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    metadata: metadata || {},
  };
}
