/**
 * MS Calendar Sync Edge Function - Type Definitions
 *
 * Local types for request/response handling in the calendar sync function.
 */

// ============================================
// Connection Status Types
// ============================================

export type ConnectionStatus = 'connected' | 'expired' | 'revoked' | 'error';
export type RecallCalendarStatus = 'pending' | 'active' | 'error' | 'disconnected';

// ============================================
// Database Row Types
// ============================================

export interface UserCalendarConnectionRow {
  id: string;
  user_id: string;
  provider: 'microsoft' | 'google';
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  ms_tenant_id: string | null;
  ms_user_principal_name: string | null;
  recall_calendar_id: string | null;
  recall_calendar_status: RecallCalendarStatus;
  connection_status: ConnectionStatus;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCalendarSelectionRow {
  id: string;
  connection_id: string;
  user_id: string;
  ms_calendar_id: string;
  calendar_name: string;
  calendar_color: string | null;
  calendar_owner_email: string | null;
  is_default: boolean;
  is_monitored: boolean;
  auto_record_all: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Microsoft Graph Types
// ============================================

export interface MSCalendar {
  id: string;
  name: string;
  color: string;
  hexColor?: string;
  isDefaultCalendar: boolean;
  canEdit: boolean;
  owner?: {
    name: string;
    address: string;
  };
}

export interface MSGraphCalendarResponse {
  value: Array<{
    id: string;
    name: string;
    color: string;
    hexColor?: string;
    isDefaultCalendar: boolean;
    canEdit: boolean;
    owner?: {
      name: string;
      address: string;
    };
  }>;
  '@odata.nextLink'?: string;
}

// ============================================
// Request Types
// ============================================

export interface ListCalendarsRequest {
  action: 'list';
}

export interface CalendarSelectionInput {
  ms_calendar_id: string;
  calendar_name: string;
  calendar_color?: string;
  calendar_owner_email?: string;
  is_default?: boolean;
  is_monitored: boolean;
  auto_record_all: boolean;
}

export interface UpdateSelectionsRequest {
  action: 'update';
  connectionId: string;
  selections: CalendarSelectionInput[];
}

// ============================================
// Response Types
// ============================================

export interface CalendarWithSelection extends MSCalendar {
  isMonitored: boolean;
  autoRecordAll: boolean;
}

export interface SyncListResponse {
  success: true;
  data: {
    calendars: CalendarWithSelection[];
    connectionStatus: ConnectionStatus;
    connectionId: string;
  };
}

export interface SyncUpdateResponse {
  success: true;
  data: {
    updatedSelections: UserCalendarSelectionRow[];
    connectionStatus: ConnectionStatus;
  };
}

export interface SyncErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ============================================
// Token Types
// ============================================

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ============================================
// Microsoft Graph Event Types
// ============================================

export interface MSGraphEventDateTime {
  dateTime: string;
  timeZone: string;
}

export interface MSGraphLocation {
  displayName?: string;
  locationType?: string;
  uniqueId?: string;
  uniqueIdType?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    countryOrRegion?: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude?: number;
    longitude?: number;
  };
}

export interface MSGraphAttendee {
  type: 'required' | 'optional' | 'resource';
  status: {
    response: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
    time?: string;
  };
  emailAddress: {
    name?: string;
    address: string;
  };
}

export interface MSGraphOnlineMeeting {
  joinUrl?: string;
  conferenceId?: string;
  tollNumber?: string;
  tollFreeNumbers?: string[];
}

export interface MSGraphRecurrence {
  pattern: {
    type: 'daily' | 'weekly' | 'absoluteMonthly' | 'relativeMonthly' | 'absoluteYearly' | 'relativeYearly';
    interval: number;
    daysOfWeek?: string[];
    dayOfMonth?: number;
    month?: number;
    firstDayOfWeek?: string;
    index?: 'first' | 'second' | 'third' | 'fourth' | 'last';
  };
  range: {
    type: 'endDate' | 'noEnd' | 'numbered';
    startDate: string;
    endDate?: string;
    numberOfOccurrences?: number;
    recurrenceTimeZone?: string;
  };
}

export interface MSGraphEvent {
  id: string;
  subject: string;
  body?: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: MSGraphEventDateTime;
  end: MSGraphEventDateTime;
  location?: MSGraphLocation;
  locations?: MSGraphLocation[];
  onlineMeeting?: MSGraphOnlineMeeting;
  organizer?: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  attendees?: MSGraphAttendee[];
  isOnlineMeeting: boolean;
  onlineMeetingProvider?: 'unknown' | 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
  isAllDay: boolean;
  isCancelled: boolean;
  recurrence?: MSGraphRecurrence;
  seriesMasterId?: string;
  type: 'singleInstance' | 'occurrence' | 'exception' | 'seriesMaster';
  sensitivity: 'normal' | 'personal' | 'private' | 'confidential';
  showAs: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  iCalUId: string;
  webLink: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
}

export interface MSGraphEventResponse {
  value: MSGraphEvent[];
  '@odata.nextLink'?: string;
}

// ============================================
// Calendar Event Database Row Types
// ============================================

export interface CalendarEventRow {
  id?: string;
  calendar_selection_id: string;
  user_id: string;
  ms_event_id: string;
  ms_icaluid: string;
  subject: string;
  body_preview: string | null;
  body_content: string | null;
  body_content_type: string;
  start_datetime: string;
  end_datetime: string;
  start_timezone: string | null;
  end_timezone: string | null;
  is_all_day: boolean;
  is_cancelled: boolean;
  is_online_meeting: boolean;
  online_meeting_provider: string | null;
  online_meeting_url: string | null;
  meeting_platform: string | null;
  location_display_name: string | null;
  location_uri: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  attendees: Record<string, unknown>[];
  sensitivity: string;
  show_as: string;
  event_type: string;
  series_master_id: string | null;
  recurrence: Record<string, unknown> | null;
  web_link: string | null;
  ms_created_datetime: string;
  ms_last_modified_datetime: string;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Sync Events Request/Response Types
// ============================================

export interface SyncEventsRequest {
  action: 'sync_events';
  calendarSelectionId: string;
  daysAhead?: number;
}

export interface SyncEventsResponse {
  success: true;
  data: {
    syncedCount: number;
    updatedCount: number;
    deletedCount: number;
    calendarName: string;
  };
}

// ============================================
// Updated Request Types
// ============================================

export type SyncAction = 'list' | 'update' | 'sync_events' | 'batch_sync';

export type SyncRequest = ListCalendarsRequest | UpdateSelectionsRequest | SyncEventsRequest | BatchSyncRequest;

export type SyncResponse = SyncListResponse | SyncUpdateResponse | SyncEventsResponse | BatchSyncResponse | SyncErrorResponse;

// ============================================
// Batch Sync Types (for periodic cron jobs)
// ============================================

export interface BatchSyncRequest {
  action: 'batch_sync';
}

export interface BatchSyncResult {
  connectionId: string;
  userId: string;
  status: 'SUCCESS' | 'ERROR' | 'SKIPPED';
  calendarsSynced: number;
  eventsSynced: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errorMessage?: string;
  processingTimeMs: number;
}

export interface BatchSyncResponse {
  success: true;
  data: {
    totalConnections: number;
    synced: number;
    skipped: number;
    errors: number;
    results: BatchSyncResult[];
  };
}

// Connection with selections for batch processing
export interface ConnectionWithSelections extends UserCalendarConnectionRow {
  selections: UserCalendarSelectionRow[];
}
