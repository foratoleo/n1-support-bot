/**
 * TypeScript types for Recall.ai Calendar V2 Webhook Events
 *
 * Webhook events from Recall.ai Calendar API:
 * - calendar.update: Calendar status changed
 * - calendar.sync_events: Calendar events synced/updated
 *
 * @see https://docs.recall.ai/docs/calendar-v2
 */

/**
 * Meeting platform types
 */
export type MeetingPlatform =
  | 'teams'
  | 'zoom'
  | 'google_meet'
  | 'webex'
  | 'unknown';

/**
 * Webhook event types from Recall.ai Calendar API
 */
export type RecallCalendarWebhookEvent =
  | 'calendar.update'
  | 'calendar.sync_events';

/**
 * Calendar status values from Recall.ai
 */
export type RecallCalendarStatus =
  | 'pending'
  | 'active'
  | 'error'
  | 'disconnected';

/**
 * Bot scheduling status values
 */
export type BotScheduleStatus =
  | 'pending'
  | 'scheduled'
  | 'joined'
  | 'completed'
  | 'cancelled'
  | 'error';

/**
 * Online meeting info from Recall.ai event
 */
export interface RecallOnlineMeeting {
  conference_url?: string;
  join_url?: string;
  provider?: string;
}

/**
 * Organizer info from Recall.ai event
 */
export interface RecallEventOrganizer {
  email?: string;
  name?: string;
}

/**
 * Attendee info from Recall.ai event
 */
export interface RecallEventAttendee {
  email?: string;
  name?: string;
  response_status?: string;
}

/**
 * Calendar event from Recall.ai Calendar V2 API
 * Structure returned from GET /api/v2/calendar/{id}/events
 */
export interface RecallCalendarEvent {
  id: string;
  calendar_id: string;
  start_time: string;
  end_time: string;
  title?: string;
  description?: string;
  location?: string;
  organizer?: RecallEventOrganizer;
  attendees?: RecallEventAttendee[];
  online_meeting?: RecallOnlineMeeting;
  ical_uid?: string;
  recurring_event_id?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
}

/**
 * Base webhook payload structure
 */
export interface RecallWebhookPayloadBase {
  event: RecallCalendarWebhookEvent;
  calendar_id: string;
  timestamp: string;
}

/**
 * Payload for calendar.update event
 */
export interface RecallCalendarUpdatePayload extends RecallWebhookPayloadBase {
  event: 'calendar.update';
  data: {
    status: RecallCalendarStatus;
    error_message?: string;
  };
}

/**
 * Payload for calendar.sync_events event
 */
export interface RecallCalendarSyncEventsPayload extends RecallWebhookPayloadBase {
  event: 'calendar.sync_events';
  data?: {
    events_added?: number;
    events_updated?: number;
    events_deleted?: number;
  };
}

/**
 * Union type for all webhook payloads
 */
export type RecallWebhookPayload =
  | RecallCalendarUpdatePayload
  | RecallCalendarSyncEventsPayload;

/**
 * Result from processing sync events
 */
export interface SyncEventsResult {
  processed: number;
  scheduled: number;
  errors: number;
  details: {
    eventId: string;
    action: 'upserted' | 'scheduled' | 'skipped' | 'error';
    error?: string;
  }[];
}

/**
 * Result from extracting meeting URL
 */
export interface MeetingUrlExtraction {
  url: string | null;
  platform: MeetingPlatform;
}

/**
 * Database row for user_calendar_connections
 */
export interface CalendarConnectionRow {
  id: string;
  user_id: string;
  provider: string;
  recall_calendar_id: string | null;
  recall_calendar_status: string | null;
  connection_status: string;
  last_sync_at: string | null;
  last_error: string | null;
}

/**
 * Database row for user_calendar_selections
 */
export interface CalendarSelectionRow {
  id: string;
  connection_id: string;
  user_id: string;
  ms_calendar_id: string;
  calendar_name: string;
  is_monitored: boolean;
  auto_record_all: boolean;
}

/**
 * Database row for calendar_event_bot_schedule
 */
export interface EventBotScheduleRow {
  id: string;
  calendar_selection_id: string;
  user_id: string;
  ms_event_id: string;
  ms_event_icaluid: string | null;
  recall_event_id: string | null;
  event_title: string;
  event_start: string;
  event_end: string;
  meeting_url: string | null;
  meeting_platform: string | null;
  recall_bot_id: string | null;
  bot_status: BotScheduleStatus;
  schedule_error: string | null;
  is_recording_enabled: boolean;
  manually_disabled: boolean;
  project_id: string | null;
}

/**
 * Insert data for calendar_event_bot_schedule
 */
export interface EventBotScheduleInsert {
  calendar_selection_id: string;
  user_id: string;
  ms_event_id: string;
  ms_event_icaluid?: string | null;
  recall_event_id?: string | null;
  event_title: string;
  event_start: string;
  event_end: string;
  meeting_url?: string | null;
  meeting_platform?: string | null;
  recall_bot_id?: string | null;
  bot_status?: BotScheduleStatus;
  schedule_error?: string | null;
  is_recording_enabled?: boolean;
  project_id?: string | null;
}
