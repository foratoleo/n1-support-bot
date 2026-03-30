/**
 * MS Calendar Sync Edge Function - Database Service
 *
 * Handles all database operations for calendar connections and selections.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { encryptToken, decryptToken } from '../_shared/encryption.ts';
import { refreshAccessToken, extractMeetingUrl, MSGraphTrackingOptions } from './ms-graph-client.ts';
import { MSGraphServiceTracker } from './ms-graph-service-tracker.ts';
import {
  UserCalendarConnectionRow,
  UserCalendarSelectionRow,
  CalendarSelectionInput,
  CalendarEventRow,
  ConnectionStatus,
  ConnectionWithSelections,
  BatchSyncResult,
  MSGraphEvent,
} from './types.ts';

// ============================================
// Tracking Options Type
// ============================================

export interface ServiceTrackingOptions {
  supabase: SupabaseClient;
  projectId: string;
  userId: string;
}

// ============================================
// Environment Configuration
// ============================================

const MS_OAUTH_CLIENT_ID = Deno.env.get('MS_OAUTH_CLIENT_ID');
const MS_OAUTH_CLIENT_SECRET = Deno.env.get('MS_OAUTH_CLIENT_SECRET');

// Token refresh buffer (5 minutes before expiration)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================
// Token Management (Shared)
// ============================================

/**
 * Ensure we have a valid access token, refreshing if needed
 * @param supabase - Supabase client
 * @param connection - User calendar connection row
 * @param logPrefix - Optional prefix for log messages (default: 'ms-calendar-sync')
 * @param trackingOptions - Optional tracking options for logging the token refresh API call
 * @returns Object with access token, updated connection, and optional tracking options for subsequent calls
 */
export async function ensureValidToken(
  supabase: SupabaseClient,
  connection: UserCalendarConnectionRow,
  logPrefix: string = 'ms-calendar-sync',
  trackingOptions?: ServiceTrackingOptions
): Promise<{
  accessToken: string;
  connection: UserCalendarConnectionRow;
  msGraphTrackingOptions?: MSGraphTrackingOptions;
}> {
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;
  const minutesUntilExpiry = Math.round(timeUntilExpiry / (1000 * 60));

  // Log token status check
  console.log(`[${logPrefix}] ┌─── TOKEN VALIDATION ───────────────────────`);
  console.log(`[${logPrefix}] │ Connection: ${connection.id}`);
  console.log(`[${logPrefix}] │ User: ${connection.ms_user_principal_name || connection.user_id}`);
  console.log(`[${logPrefix}] │ Token expires at: ${connection.token_expires_at}`);
  console.log(`[${logPrefix}] │ Time until expiry: ${minutesUntilExpiry} minutes`);
  console.log(`[${logPrefix}] │ Buffer threshold: ${TOKEN_REFRESH_BUFFER_MS / (1000 * 60)} minutes`);

  // Create MS Graph tracking options if tracking is enabled
  let msGraphTrackingOptions: MSGraphTrackingOptions | undefined;
  if (trackingOptions) {
    const tracker = new MSGraphServiceTracker(trackingOptions.supabase);
    msGraphTrackingOptions = {
      tracker,
      projectId: trackingOptions.projectId,
      userId: trackingOptions.userId,
    };
  }

  if (now < expiresAt - TOKEN_REFRESH_BUFFER_MS) {
    // Token is still valid
    console.log(`[${logPrefix}] │ Status: ✓ TOKEN VALID (no refresh needed)`);
    console.log(`[${logPrefix}] └──────────────────────────────────────────────`);
    const accessToken = await decryptToken(connection.access_token_encrypted);
    return { accessToken, connection, msGraphTrackingOptions };
  }

  console.log(`[${logPrefix}] │ Status: ⚠ TOKEN EXPIRED/EXPIRING - Refresh required`);
  console.log(`[${logPrefix}] │`);
  console.log(`[${logPrefix}] │ >>> INITIATING TOKEN REFRESH <<<`);

  if (!MS_OAUTH_CLIENT_ID || !MS_OAUTH_CLIENT_SECRET) {
    console.log(`[${logPrefix}] │ ✗ ERROR: MS_OAUTH credentials not configured`);
    console.log(`[${logPrefix}] └──────────────────────────────────────────────`);
    throw new Error('MS_OAUTH credentials not configured');
  }

  console.log(`[${logPrefix}] │ Decrypting refresh token...`);
  const refreshToken = await decryptToken(connection.refresh_token_encrypted);
  console.log(`[${logPrefix}] │ ✓ Refresh token decrypted (${refreshToken.length} chars)`);

  try {
    console.log(`[${logPrefix}] │ Calling Microsoft OAuth endpoint...`);
    const tokenResponse = await refreshAccessToken(
      refreshToken,
      MS_OAUTH_CLIENT_ID,
      MS_OAUTH_CLIENT_SECRET,
      msGraphTrackingOptions
    );

    console.log(`[${logPrefix}] │ ✓ Microsoft returned new tokens!`);
    console.log(`[${logPrefix}] │   - Access token: ${tokenResponse.access_token.length} chars`);
    console.log(`[${logPrefix}] │   - Refresh token: ${tokenResponse.refresh_token.length} chars`);
    console.log(`[${logPrefix}] │   - Expires in: ${tokenResponse.expires_in} seconds`);

    const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    console.log(`[${logPrefix}] │   - New expiry: ${newExpiresAt.toISOString()}`);

    console.log(`[${logPrefix}] │ Encrypting and saving tokens...`);
    const encryptedAccessToken = await encryptToken(tokenResponse.access_token);
    const encryptedRefreshToken = await encryptToken(tokenResponse.refresh_token);

    await updateTokens(
      supabase,
      connection.id,
      encryptedAccessToken,
      encryptedRefreshToken,
      newExpiresAt
    );

    console.log(`[${logPrefix}] │ ✓ Tokens saved to database`);
    console.log(`[${logPrefix}] │`);
    console.log(`[${logPrefix}] │ >>> TOKEN REFRESH SUCCESSFUL <<<`);
    console.log(`[${logPrefix}] └──────────────────────────────────────────────`);

    return {
      accessToken: tokenResponse.access_token,
      connection: {
        ...connection,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: newExpiresAt.toISOString(),
        connection_status: 'connected',
      },
      msGraphTrackingOptions,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('TOKEN_REVOKED')) {
      console.log(`[${logPrefix}] │ ✗ TOKEN REVOKED by user or admin`);
      console.log(`[${logPrefix}] │ Marking connection as revoked...`);
      await updateConnectionStatus(
        supabase,
        connection.id,
        'revoked',
        'User has revoked access or token is invalid. Please reconnect.'
      );
      console.log(`[${logPrefix}] │`);
      console.log(`[${logPrefix}] │ >>> USER ACTION REQUIRED: Reconnect calendar <<<`);
      console.log(`[${logPrefix}] └──────────────────────────────────────────────`);
      throw new Error('TOKEN_REVOKED: Calendar access has been revoked. Please reconnect.');
    }

    console.log(`[${logPrefix}] │ ✗ TOKEN REFRESH FAILED`);
    console.log(`[${logPrefix}] │ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    console.log(`[${logPrefix}] │ Marking connection as error...`);
    await updateConnectionStatus(
      supabase,
      connection.id,
      'error',
      error instanceof Error ? error.message : 'Token refresh failed'
    );
    console.log(`[${logPrefix}] └──────────────────────────────────────────────`);
    throw error;
  }
}

// ============================================
// Event Mapping (Shared)
// ============================================

/**
 * Map MS Graph Event to database row format
 * @param event - MS Graph event object
 * @param selectionId - Calendar selection UUID
 * @param userId - User UUID
 * @returns CalendarEventRow ready for database insertion
 */
export function mapMSGraphEventToRow(
  event: MSGraphEvent,
  selectionId: string,
  userId: string
): CalendarEventRow {
  // Extract meeting URL and platform
  const { url: meetingUrl, platform: meetingPlatform } = extractMeetingUrl(event);

  // Extract body preview (strip HTML and limit length)
  let bodyPreview: string | null = null;
  if (event.body?.content) {
    bodyPreview = event.body.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    if (bodyPreview.length === 0) {
      bodyPreview = null;
    }
  }

  // Map attendees to jsonb array format
  const attendees = (event.attendees || []).map((att) => ({
    type: att.type,
    status: att.status,
    emailAddress: att.emailAddress,
  }));

  return {
    calendar_selection_id: selectionId,
    user_id: userId,
    ms_event_id: event.id,
    ms_icaluid: event.iCalUId,
    subject: event.subject || '(No subject)',
    body_preview: bodyPreview,
    body_content: event.body?.content || null,
    body_content_type: event.body?.contentType || 'text',
    start_datetime: event.start.dateTime,
    end_datetime: event.end.dateTime,
    start_timezone: event.start.timeZone || null,
    end_timezone: event.end.timeZone || null,
    is_all_day: event.isAllDay,
    is_cancelled: event.isCancelled,
    is_online_meeting: event.isOnlineMeeting,
    online_meeting_provider: event.onlineMeetingProvider || null,
    online_meeting_url: meetingUrl,
    meeting_platform: meetingPlatform !== 'none' ? meetingPlatform : null,
    location_display_name: event.location?.displayName || null,
    location_uri: event.location?.uniqueId || null,
    organizer_name: event.organizer?.emailAddress?.name || null,
    organizer_email: event.organizer?.emailAddress?.address || null,
    attendees: attendees,
    sensitivity: event.sensitivity,
    show_as: event.showAs,
    event_type: event.type,
    series_master_id: event.seriesMasterId || null,
    recurrence: event.recurrence || null,
    web_link: event.webLink || null,
    ms_created_datetime: event.createdDateTime,
    ms_last_modified_datetime: event.lastModifiedDateTime,
  };
}

// ============================================
// Connection Operations
// ============================================

/**
 * Get user's calendar connection by user_id
 * @param supabase - Supabase client
 * @param userId - User UUID
 * @returns Connection row or null if not found
 */
export async function getConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<UserCalendarConnectionRow | null> {
  const { data, error } = await supabase
    .from('user_calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    console.error('[database-service] Get connection error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  return data as UserCalendarConnectionRow;
}

/**
 * Get calendar connection by connection_id
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 * @returns Connection row or null if not found
 */
export async function getConnectionById(
  supabase: SupabaseClient,
  connectionId: string
): Promise<UserCalendarConnectionRow | null> {
  const { data, error } = await supabase
    .from('user_calendar_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[database-service] Get connection by ID error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  return data as UserCalendarConnectionRow;
}

/**
 * Update connection tokens after refresh
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 * @param accessToken - New encrypted access token
 * @param refreshToken - New encrypted refresh token
 * @param expiresAt - New token expiration date
 */
export async function updateTokens(
  supabase: SupabaseClient,
  connectionId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  const { error } = await supabase
    .from('user_calendar_connections')
    .update({
      access_token_encrypted: accessToken,
      refresh_token_encrypted: refreshToken,
      token_expires_at: expiresAt.toISOString(),
      connection_status: 'connected' as ConnectionStatus,
      last_error: null,
    })
    .eq('id', connectionId);

  if (error) {
    console.error('[database-service] Update tokens error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  console.log(`[database-service] Updated tokens for connection ${connectionId}`);
}

/**
 * Update connection status (e.g., when token is revoked)
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 * @param status - New connection status
 * @param errorMessage - Optional error message
 */
export async function updateConnectionStatus(
  supabase: SupabaseClient,
  connectionId: string,
  status: ConnectionStatus,
  errorMessage?: string
): Promise<void> {
  const { error } = await supabase
    .from('user_calendar_connections')
    .update({
      connection_status: status,
      last_error: errorMessage || null,
    })
    .eq('id', connectionId);

  if (error) {
    console.error('[database-service] Update connection status error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  console.log(`[database-service] Updated connection ${connectionId} status to ${status}`);
}

/**
 * Update last_sync_at timestamp
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 */
export async function updateLastSyncAt(
  supabase: SupabaseClient,
  connectionId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_calendar_connections')
    .update({
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', connectionId);

  if (error) {
    console.error('[database-service] Update last_sync_at error:', error);
    // Non-critical, don't throw
  }
}

// ============================================
// Selection Operations
// ============================================

/**
 * Get all calendar selections for a connection
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 * @returns Array of calendar selection rows
 */
export async function getCalendarSelections(
  supabase: SupabaseClient,
  connectionId: string
): Promise<UserCalendarSelectionRow[]> {
  const { data, error } = await supabase
    .from('user_calendar_selections')
    .select('*')
    .eq('connection_id', connectionId)
    .order('is_default', { ascending: false })
    .order('calendar_name', { ascending: true });

  if (error) {
    console.error('[database-service] Get calendar selections error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  return (data || []) as UserCalendarSelectionRow[];
}

/**
 * Upsert calendar selections (insert or update)
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 * @param userId - User UUID
 * @param selections - Array of calendar selection inputs
 * @returns Updated selection rows
 */
export async function upsertCalendarSelections(
  supabase: SupabaseClient,
  connectionId: string,
  userId: string,
  selections: CalendarSelectionInput[]
): Promise<UserCalendarSelectionRow[]> {
  // Prepare upsert data
  const upsertData = selections.map((selection) => ({
    connection_id: connectionId,
    user_id: userId,
    ms_calendar_id: selection.ms_calendar_id,
    calendar_name: selection.calendar_name,
    calendar_color: selection.calendar_color || null,
    calendar_owner_email: selection.calendar_owner_email || null,
    is_default: selection.is_default || false,
    is_monitored: selection.is_monitored,
    auto_record_all: selection.auto_record_all,
  }));

  const { data, error } = await supabase
    .from('user_calendar_selections')
    .upsert(upsertData, {
      onConflict: 'connection_id,ms_calendar_id',
      ignoreDuplicates: false,
    })
    .select();

  if (error) {
    console.error('[database-service] Upsert calendar selections error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  console.log(`[database-service] Upserted ${selections.length} calendar selections`);
  return (data || []) as UserCalendarSelectionRow[];
}

/**
 * Delete calendar selections that are no longer in the user's Microsoft account
 * @param supabase - Supabase client
 * @param connectionId - Connection UUID
 * @param keepCalendarIds - Array of MS calendar IDs to keep
 */
export async function deleteStaleSelections(
  supabase: SupabaseClient,
  connectionId: string,
  keepCalendarIds: string[]
): Promise<void> {
  if (keepCalendarIds.length === 0) {
    // Delete all selections for this connection
    const { error } = await supabase
      .from('user_calendar_selections')
      .delete()
      .eq('connection_id', connectionId);

    if (error) {
      console.error('[database-service] Delete all selections error:', error);
    }
    return;
  }

  // Delete selections not in the keep list
  // First, get all selections for this connection
  const { data: allSelections, error: fetchError } = await supabase
    .from('user_calendar_selections')
    .select('id, ms_calendar_id')
    .eq('connection_id', connectionId);

  if (fetchError) {
    console.error('[database-service] Error fetching selections for cleanup:', fetchError);
    return;
  }

  if (!allSelections || allSelections.length === 0) {
    return;
  }

  // Filter to find IDs to delete (those not in keepCalendarIds)
  const keepSet = new Set(keepCalendarIds);
  const idsToDelete = allSelections
    .filter((s) => !keepSet.has(s.ms_calendar_id))
    .map((s) => s.id);

  if (idsToDelete.length === 0) {
    return;
  }

  // Delete by primary key IDs (safe from SQL injection)
  const { error } = await supabase
    .from('user_calendar_selections')
    .delete()
    .in('id', idsToDelete);

  if (error) {
    console.error('[database-service] Delete stale selections error:', error);
    // Non-critical, don't throw
  }
}

// ============================================
// Calendar Selection Query Operations
// ============================================

/**
 * Get a single calendar selection by ID with ownership validation
 * @param supabase - Supabase client
 * @param selectionId - Calendar selection UUID
 * @returns Selection row with connection info or null if not found
 */
export async function getCalendarSelection(
  supabase: SupabaseClient,
  selectionId: string
): Promise<(UserCalendarSelectionRow & { connection: UserCalendarConnectionRow }) | null> {
  const { data, error } = await supabase
    .from('user_calendar_selections')
    .select(`
      *,
      connection:user_calendar_connections(*)
    `)
    .eq('id', selectionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('[database-service] Get calendar selection error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  return data as UserCalendarSelectionRow & { connection: UserCalendarConnectionRow };
}

// ============================================
// Calendar Event Operations
// ============================================

// Maximum batch size for upsert operations
const EVENT_BATCH_SIZE = 50;

/**
 * Upsert calendar events in batches
 * @param supabase - Supabase client
 * @param events - Array of calendar event rows to upsert
 * @returns Object with counts of synced and updated events
 */
export async function upsertCalendarEvents(
  supabase: SupabaseClient,
  events: CalendarEventRow[]
): Promise<{ syncedCount: number; updatedCount: number }> {
  if (events.length === 0) {
    return { syncedCount: 0, updatedCount: 0 };
  }

  let totalSynced = 0;
  let totalUpdated = 0;

  // Process in batches
  for (let i = 0; i < events.length; i += EVENT_BATCH_SIZE) {
    const batch = events.slice(i, i + EVENT_BATCH_SIZE);

    // Check which events already exist
    const msEventIds = batch.map((e) => e.ms_event_id);
    const { data: existing, error: checkError } = await supabase
      .from('calendar_events')
      .select('ms_event_id')
      .in('ms_event_id', msEventIds);

    if (checkError) {
      console.error('[database-service] Check existing events error:', checkError);
      throw new Error(`DATABASE_ERROR: ${checkError.message}`);
    }

    const existingSet = new Set((existing || []).map((e) => e.ms_event_id));
    const newCount = batch.filter((e) => !existingSet.has(e.ms_event_id)).length;
    const updateCount = batch.length - newCount;

    // Add updated_at timestamp and clear deleted_at on sync
    const batchWithTimestamp = batch.map((event) => ({
      ...event,
      updated_at: new Date().toISOString(),
      deleted_at: null, // Clear deleted_at on sync (restore if was soft-deleted)
    }));

    const { error } = await supabase.from('calendar_events').upsert(batchWithTimestamp, {
      onConflict: 'calendar_selection_id,ms_event_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error('[database-service] Upsert calendar events error:', error);
      throw new Error(`DATABASE_ERROR: ${error.message}`);
    }

    totalSynced += newCount;
    totalUpdated += updateCount;
  }

  console.log(
    `[database-service] Upserted ${events.length} events (${totalSynced} new, ${totalUpdated} updated)`
  );

  return { syncedCount: totalSynced, updatedCount: totalUpdated };
}

/**
 * Soft delete events that are no longer present in Microsoft Calendar
 * Uses deleted_at column for soft delete pattern
 * @param supabase - Supabase client
 * @param selectionId - Calendar selection UUID
 * @param keepEventIds - Array of MS event IDs to keep (not delete)
 * @returns Count of events marked as deleted
 */
export async function markEventsDeleted(
  supabase: SupabaseClient,
  selectionId: string,
  keepEventIds: string[]
): Promise<number> {
  // Get all non-deleted events for this selection
  const { data: allEvents, error: fetchError } = await supabase
    .from('calendar_events')
    .select('id, ms_event_id')
    .eq('calendar_selection_id', selectionId)
    .is('deleted_at', null);

  if (fetchError) {
    console.error('[database-service] Error fetching events for cleanup:', fetchError);
    throw new Error(`DATABASE_ERROR: ${fetchError.message}`);
  }

  if (!allEvents || allEvents.length === 0) {
    return 0;
  }

  // Find events to mark as deleted
  const keepSet = new Set(keepEventIds);
  const idsToDelete = allEvents
    .filter((e) => !keepSet.has(e.ms_event_id))
    .map((e) => e.id);

  if (idsToDelete.length === 0) {
    return 0;
  }

  // Soft delete in batches
  const deletedAt = new Date().toISOString();
  let deletedCount = 0;

  for (let i = 0; i < idsToDelete.length; i += EVENT_BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + EVENT_BATCH_SIZE);

    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: deletedAt })
      .in('id', batch);

    if (error) {
      console.error('[database-service] Mark events deleted error:', error);
      // Continue with other batches
    } else {
      deletedCount += batch.length;
    }
  }

  console.log(`[database-service] Marked ${deletedCount} events as deleted for selection ${selectionId}`);

  return deletedCount;
}

/**
 * Get existing events for a selection (non-deleted only)
 * @param supabase - Supabase client
 * @param selectionId - Calendar selection UUID
 * @returns Array of event rows
 */
export async function getCalendarEvents(
  supabase: SupabaseClient,
  selectionId: string
): Promise<CalendarEventRow[]> {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('calendar_selection_id', selectionId)
    .is('deleted_at', null)
    .order('start_datetime', { ascending: true });

  if (error) {
    console.error('[database-service] Get calendar events error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  return (data || []) as CalendarEventRow[];
}

// ============================================
// Batch Sync Operations (for cron jobs)
// ============================================

/**
 * Get all active calendar connections with monitored selections for batch sync
 * @param supabase - Supabase client
 * @returns Array of connections with their monitored selections
 */
export async function getActiveConnectionsForSync(
  supabase: SupabaseClient
): Promise<ConnectionWithSelections[]> {
  const { data, error } = await supabase
    .from('user_calendar_connections')
    .select(`
      *,
      selections:user_calendar_selections(*)
    `)
    .eq('provider', 'microsoft')
    .in('connection_status', ['connected', 'expired']);

  if (error) {
    console.error('[database-service] Get active connections error:', error);
    throw new Error(`DATABASE_ERROR: ${error.message}`);
  }

  // Filter to only include connections with at least one monitored calendar
  const connectionsWithMonitored = (data || [])
    .map((conn) => ({
      ...conn,
      selections: (conn.selections || []).filter(
        (s: UserCalendarSelectionRow) => s.is_monitored === true
      ),
    }))
    .filter((conn) => conn.selections.length > 0);

  console.log(
    `[database-service] Found ${connectionsWithMonitored.length} active connections with monitored calendars`
  );

  return connectionsWithMonitored as ConnectionWithSelections[];
}

/**
 * Log batch sync execution result to calendar_cron_execution_log table
 * @param supabase - Supabase client
 * @param cronJobName - Name of the cron job
 * @param result - Batch sync result
 */
export async function logBatchSyncExecution(
  supabase: SupabaseClient,
  cronJobName: string,
  result: BatchSyncResult
): Promise<void> {
  const { error } = await supabase.from('calendar_cron_execution_log').insert({
    cron_job_name: cronJobName,
    user_id: result.userId,
    connection_id: result.connectionId,
    sync_status: result.status,
    events_synced: result.eventsSynced,
    events_updated: result.eventsUpdated,
    events_deleted: result.eventsDeleted,
    processing_time_ms: result.processingTimeMs,
    error_message: result.errorMessage || null,
  });

  if (error) {
    // Non-critical, log but don't throw
    console.error('[database-service] Log batch sync execution error:', error);
  }
}
