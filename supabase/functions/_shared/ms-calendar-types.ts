/**
 * TypeScript Types for Microsoft Calendar Integration
 *
 * This module provides comprehensive type definitions for MS Calendar integration,
 * including database row types, Microsoft Graph API types, Edge Function request/response
 * types, and Recall.ai Calendar V2 types.
 *
 * @module ms-calendar-types
 */

// =============================================================================
// Calendar Provider Types
// =============================================================================

/**
 * Supported calendar providers
 */
export type CalendarProvider = "microsoft" | "google";

/**
 * Connection status for user calendar connections
 */
export type ConnectionStatus = "connected" | "expired" | "revoked" | "error";

/**
 * Recall.ai calendar integration status
 */
export type RecallCalendarStatus = "pending" | "active" | "error" | "disconnected";

/**
 * Bot schedule status for calendar events
 */
export type BotScheduleStatus =
  | "pending"
  | "scheduled"
  | "joined"
  | "completed"
  | "cancelled"
  | "error";

// =============================================================================
// Database Row Types
// =============================================================================

/**
 * Database row type for user_calendar_connections table
 * Stores OAuth tokens and connection metadata for each user's calendar
 *
 * @see supabase/migrations/20251229_ms_calendar_integration.sql
 */
export interface UserCalendarConnectionRow {
  id: string;
  user_id: string;
  provider: CalendarProvider;

  // Provider account info
  provider_account_id: string | null;
  provider_email: string | null;

  // OAuth tokens (encrypted)
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;

  // Connection status
  status: ConnectionStatus;
  last_error: string | null;
  last_error_at: string | null;

  // Recall.ai Calendar V2 integration
  recall_calendar_id: string | null;
  recall_calendar_status: RecallCalendarStatus | null;
  recall_webhook_secret: string | null;

  // Metadata
  scopes: string[] | null;
  metadata: Record<string, unknown> | null;

  // Audit fields
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Insert type for user_calendar_connections
 */
export interface UserCalendarConnectionInsert {
  user_id: string;
  provider: CalendarProvider;
  provider_account_id?: string;
  provider_email?: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  status?: ConnectionStatus;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Update type for user_calendar_connections
 */
export interface UserCalendarConnectionUpdate {
  provider_account_id?: string;
  provider_email?: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  token_expires_at?: string;
  status?: ConnectionStatus;
  last_error?: string | null;
  last_error_at?: string | null;
  recall_calendar_id?: string | null;
  recall_calendar_status?: RecallCalendarStatus | null;
  recall_webhook_secret?: string | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Database row type for user_calendar_selections table
 * Stores which calendars are monitored for auto-recording
 *
 * @see supabase/migrations/20251229_ms_calendar_integration.sql
 */
export interface UserCalendarSelectionRow {
  id: string;
  connection_id: string;
  user_id: string;

  // Calendar identification
  ms_calendar_id: string;
  calendar_name: string;
  calendar_color: string | null;

  // Monitoring settings
  is_monitored: boolean;
  auto_record_all: boolean;

  // Metadata
  metadata: Record<string, unknown> | null;

  // Audit fields
  created_at: string;
  updated_at: string;
}

/**
 * Insert type for user_calendar_selections
 */
export interface UserCalendarSelectionInsert {
  connection_id: string;
  user_id: string;
  ms_calendar_id: string;
  calendar_name: string;
  calendar_color?: string;
  is_monitored?: boolean;
  auto_record_all?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Database row type for calendar_event_bot_schedules table
 * Tracks bot scheduling for calendar events
 *
 * @see supabase/migrations/20251229_ms_calendar_integration.sql
 */
export interface CalendarEventBotScheduleRow {
  id: string;
  connection_id: string;
  selection_id: string | null;
  user_id: string;
  project_id: string | null;

  // Calendar event info
  ms_event_id: string;
  event_subject: string | null;
  event_start: string;
  event_end: string;
  meeting_url: string | null;

  // Bot scheduling
  bot_id: string | null;
  bot_status: BotScheduleStatus;
  scheduled_at: string | null;
  joined_at: string | null;
  completed_at: string | null;

  // Error tracking
  last_error: string | null;
  retry_count: number;
  next_retry_at: string | null;

  // Metadata
  metadata: Record<string, unknown> | null;

  // Audit fields
  created_at: string;
  updated_at: string;
}

/**
 * Insert type for calendar_event_bot_schedules
 */
export interface CalendarEventBotScheduleInsert {
  connection_id: string;
  selection_id?: string;
  user_id: string;
  project_id?: string;
  ms_event_id: string;
  event_subject?: string;
  event_start: string;
  event_end: string;
  meeting_url?: string;
  bot_status?: BotScheduleStatus;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Microsoft Graph API Types
// =============================================================================

/**
 * Microsoft Graph Calendar object
 * @see https://learn.microsoft.com/en-us/graph/api/resources/calendar
 */
export interface MSCalendar {
  id: string;
  name: string;
  color: string;
  canShare: boolean;
  canEdit: boolean;
  isDefaultCalendar: boolean;
  owner: {
    name: string;
    address: string;
  };
}

/**
 * Microsoft Graph Event date/time format
 */
export interface MSEventDateTime {
  dateTime: string;
  timeZone: string;
}

/**
 * Microsoft Graph Event location
 */
export interface MSEventLocation {
  displayName?: string;
  locationType?: string;
  uniqueId?: string;
  uniqueIdType?: string;
}

/**
 * Microsoft Graph Online Meeting info
 */
export interface MSOnlineMeeting {
  joinUrl: string;
  conferenceId?: string;
  tollNumber?: string;
}

/**
 * Microsoft Graph Event object
 * @see https://learn.microsoft.com/en-us/graph/api/resources/event
 */
export interface MSEvent {
  id: string;
  subject: string;
  start: MSEventDateTime;
  end: MSEventDateTime;
  location?: MSEventLocation;
  onlineMeeting?: MSOnlineMeeting | null;
  isOnlineMeeting: boolean;
  onlineMeetingUrl?: string | null;
  bodyPreview?: string;
  webLink: string;
  isCancelled?: boolean;
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees?: Array<{
    type: string;
    status: {
      response: string;
      time?: string;
    };
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
}

/**
 * Microsoft Graph list response wrapper
 */
export interface MSGraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

// =============================================================================
// Edge Function Request/Response Types
// =============================================================================

/**
 * OAuth callback parameters from Microsoft
 */
export interface OAuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

/**
 * Calendar sync request payload
 */
export interface CalendarSyncRequest {
  action: "list" | "update";
  connectionId?: string;
  selections?: Array<{
    msCalendarId: string;
    isMonitored: boolean;
    autoRecordAll: boolean;
  }>;
}

/**
 * Calendar sync response payload
 */
export interface CalendarSyncResponse {
  success: boolean;
  calendars?: MSCalendar[];
  selections?: UserCalendarSelectionRow[];
  error?: string;
}

/**
 * OAuth initiate request
 */
export interface OAuthInitiateRequest {
  redirectUrl?: string;
}

/**
 * OAuth initiate response
 */
export interface OAuthInitiateResponse {
  success: boolean;
  authUrl?: string;
  error?: string;
}

/**
 * Connection status response
 */
export interface ConnectionStatusResponse {
  success: boolean;
  connected: boolean;
  provider?: CalendarProvider;
  email?: string;
  status?: ConnectionStatus;
  tokenExpiresAt?: string;
  recallStatus?: RecallCalendarStatus;
  error?: string;
}

// =============================================================================
// Recall.ai Calendar V2 Types
// =============================================================================

/**
 * Recall.ai supported calendar platforms
 */
export type RecallCalendarPlatform = "microsoft_outlook" | "google_calendar";

/**
 * Request body for creating a Recall.ai Calendar
 * @see https://docs.recall.ai/reference/calendar-v2
 */
export interface RecallCalendarCreateRequest {
  platform: RecallCalendarPlatform;
  oauth_client_id: string;
  oauth_client_secret: string;
  oauth_refresh_token: string;
  webhook_url: string;
}

/**
 * Response from creating a Recall.ai Calendar
 */
export interface RecallCalendarCreateResponse {
  id: string;
  platform: RecallCalendarPlatform;
  status: string;
  created_at: string;
}

/**
 * Recall.ai Calendar event
 */
export interface RecallCalendarEvent {
  id: string;
  calendar_id: string;
  title: string | null;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  platform: string | null;
  status: string;
}

/**
 * Recall.ai Calendar webhook event
 */
export interface RecallCalendarWebhookEvent {
  event_type:
    | "calendar.event.created"
    | "calendar.event.updated"
    | "calendar.event.deleted"
    | "calendar.sync.completed"
    | "calendar.sync.failed";
  calendar_id: string;
  data: {
    event?: RecallCalendarEvent;
    error?: string;
  };
  timestamp: string;
}

/**
 * Recall.ai bot scheduling request
 */
export interface RecallBotScheduleRequest {
  meeting_url: string;
  join_at?: string;
  bot_name?: string;
  recording_config?: {
    transcript?: {
      provider: {
        recallai_streaming?: {
          language_code: string;
        };
      };
    };
  };
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a connection status indicates the token needs refresh
 */
export function needsTokenRefresh(status: ConnectionStatus): boolean {
  return status === "expired" || status === "error";
}

/**
 * Check if a connection status indicates re-authentication is needed
 */
export function needsReauthentication(status: ConnectionStatus): boolean {
  return status === "revoked";
}

/**
 * Extract meeting URL from MS Event
 */
export function extractMeetingUrl(event: MSEvent): string | null {
  // Try onlineMeetingUrl first
  if (event.onlineMeetingUrl) {
    return event.onlineMeetingUrl;
  }

  // Try onlineMeeting.joinUrl
  if (event.onlineMeeting?.joinUrl) {
    return event.onlineMeeting.joinUrl;
  }

  return null;
}

/**
 * Check if an event is a Teams meeting
 */
export function isTeamsMeeting(event: MSEvent): boolean {
  const meetingUrl = extractMeetingUrl(event);
  if (!meetingUrl) return false;

  return (
    meetingUrl.includes("teams.microsoft.com") ||
    meetingUrl.includes("teams.live.com")
  );
}

/**
 * Convert database row to API response format (camelCase)
 */
export function connectionRowToResponse(
  row: UserCalendarConnectionRow
): ConnectionStatusResponse {
  return {
    success: true,
    connected: row.status === "connected",
    provider: row.provider,
    email: row.provider_email || undefined,
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    recallStatus: row.recall_calendar_status || undefined,
  };
}
