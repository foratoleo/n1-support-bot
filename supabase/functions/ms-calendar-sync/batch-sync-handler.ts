/**
 * MS Calendar Sync Edge Function - Batch Sync Handler
 *
 * Handles automatic periodic sync of calendar events for all active connections.
 * Called by pg_cron scheduled job every 15 minutes.
 * Logs all Microsoft Graph API calls to external_service_calls for traceability.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { listEvents } from './ms-graph-client.ts';
import {
  getActiveConnectionsForSync,
  updateLastSyncAt,
  upsertCalendarEvents,
  markEventsDeleted,
  logBatchSyncExecution,
  ensureValidToken,
  mapMSGraphEventToRow,
  ServiceTrackingOptions,
} from './database-service.ts';
import {
  BatchSyncResponse,
  BatchSyncResult,
  ConnectionWithSelections,
} from './types.ts';

// ============================================
// Constants
// ============================================

const CRON_JOB_NAME = 'calendar-sync-periodic';
const DEFAULT_DAYS_AHEAD = 7;

// ============================================
// Helper Functions
// ============================================

/**
 * Get the user's first project for tracking purposes
 * Returns null if user has no projects (tracking will be skipped)
 *
 * Flow: auth.users.id -> auth.users.email -> team_members.email ->
 *       project_team_members.member_id -> project_knowledge_base.id
 */
async function getUserProjectId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  // First get user's email from auth.users
  const { data: userData, error: userError } = await supabase
    .auth.admin.getUserById(userId);

  if (userError || !userData?.user?.email) {
    console.log(`[batch-sync] Could not get email for user ${userId}, skipping tracking`);
    return null;
  }

  const userEmail = userData.user.email;

  // Find team_member by email, then get their projects
  const { data, error } = await supabase
    .from('project_team_members')
    .select(`
      project_id,
      team_members!inner(email)
    `)
    .eq('team_members.email', userEmail)
    .is('deleted_at', null)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    console.log(`[batch-sync] No project found for user ${userId} (${userEmail}), skipping tracking`);
    return null;
  }

  return data.project_id;
}

// ============================================
// Sync Logic
// ============================================

/**
 * Sync a single connection's monitored calendars
 */
async function syncConnection(
  supabase: SupabaseClient,
  connection: ConnectionWithSelections
): Promise<BatchSyncResult> {
  const startTime = Date.now();
  const monitoredSelections = connection.selections;

  // Skip if no monitored calendars
  if (monitoredSelections.length === 0) {
    return {
      connectionId: connection.id,
      userId: connection.user_id,
      status: 'SKIPPED',
      calendarsSynced: 0,
      eventsSynced: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Get the user's project for tracking (optional - tracking is skipped if no project)
    const projectId = await getUserProjectId(supabase, connection.user_id);

    // Set up tracking options if project is available
    const trackingOptions: ServiceTrackingOptions | undefined = projectId
      ? {
          supabase,
          projectId,
          userId: connection.user_id,
        }
      : undefined;

    // Ensure valid token (with tracking if available)
    const { accessToken, msGraphTrackingOptions } = await ensureValidToken(
      supabase,
      connection,
      'batch-sync',
      trackingOptions
    );

    let totalSynced = 0;
    let totalUpdated = 0;
    let totalDeleted = 0;

    // Calculate date range (7 days ahead)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + DEFAULT_DAYS_AHEAD);

    // Sync each monitored calendar
    for (const selection of monitoredSelections) {
      try {
        console.log(
          `[batch-sync] Syncing calendar "${selection.calendar_name}" for user ${connection.user_id}`
        );

        // Fetch events from MS Graph (with tracking if available)
        const events = await listEvents(
          accessToken,
          selection.ms_calendar_id,
          startDate,
          endDate,
          msGraphTrackingOptions
        );

        // Map events to database format
        const eventRows = events.map((event) =>
          mapMSGraphEventToRow(event, selection.id, connection.user_id)
        );

        // Upsert events
        const { syncedCount, updatedCount } = await upsertCalendarEvents(supabase, eventRows);

        // Mark deleted events
        const deletedCount = await markEventsDeleted(
          supabase,
          selection.id,
          events.map((e) => e.id)
        );

        totalSynced += syncedCount;
        totalUpdated += updatedCount;
        totalDeleted += deletedCount;

        console.log(
          `[batch-sync] Synced "${selection.calendar_name}": ${syncedCount} new, ${updatedCount} updated, ${deletedCount} deleted`
        );
      } catch (calendarError) {
        console.error(
          `[batch-sync] Error syncing calendar "${selection.calendar_name}":`,
          calendarError
        );
        // Continue with other calendars
      }
    }

    // Update last sync timestamp
    await updateLastSyncAt(supabase, connection.id);

    return {
      connectionId: connection.id,
      userId: connection.user_id,
      status: 'SUCCESS',
      calendarsSynced: monitoredSelections.length,
      eventsSynced: totalSynced,
      eventsUpdated: totalUpdated,
      eventsDeleted: totalDeleted,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connectionId: connection.id,
      userId: connection.user_id,
      status: 'ERROR',
      calendarsSynced: 0,
      eventsSynced: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================
// Main Handler
// ============================================

/**
 * Handle batch sync action for all active calendar connections
 */
export async function handleBatchSyncAction(
  supabase: SupabaseClient
): Promise<BatchSyncResponse> {
  console.log('[batch-sync] Starting batch sync for all active connections');

  // Get all active connections with monitored calendars
  const connections = await getActiveConnectionsForSync(supabase);

  console.log(`[batch-sync] Found ${connections.length} connections to sync`);

  const results: BatchSyncResult[] = [];

  // Process each connection
  for (const connection of connections) {
    const result = await syncConnection(supabase, connection);
    results.push(result);

    // Log execution to database
    await logBatchSyncExecution(supabase, CRON_JOB_NAME, result);
  }

  // Calculate summary
  const synced = results.filter((r) => r.status === 'SUCCESS').length;
  const skipped = results.filter((r) => r.status === 'SKIPPED').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;

  console.log(
    `[batch-sync] Batch sync complete: ${synced} synced, ${skipped} skipped, ${errors} errors`
  );

  return {
    success: true,
    data: {
      totalConnections: connections.length,
      synced,
      skipped,
      errors,
      results,
    },
  };
}
