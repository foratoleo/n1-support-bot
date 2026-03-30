/**
 * MS Calendar Sync Edge Function
 *
 * Handles calendar listing, selection management, and event synchronization
 * for Microsoft Calendar integration.
 *
 * Actions:
 * - 'list': List available calendars from Microsoft Graph with selection status
 * - 'update': Update calendar monitoring selections
 * - 'sync_events': Synchronize calendar events from Microsoft Graph to local database
 * - 'batch_sync': Sync all active connections (for cron jobs, requires service role)
 *
 * @module ms-calendar-sync
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import { listCalendars, listEvents } from './ms-graph-client.ts';
import {
  getConnection,
  getConnectionById,
  updateLastSyncAt,
  getCalendarSelections,
  upsertCalendarSelections,
  getCalendarSelection,
  upsertCalendarEvents,
  markEventsDeleted,
  ensureValidToken,
  mapMSGraphEventToRow,
  ServiceTrackingOptions,
} from './database-service.ts';
import { handleBatchSyncAction } from './batch-sync-handler.ts';
import {
  SyncRequest,
  SyncResponse,
  CalendarWithSelection,
  UserCalendarSelectionRow,
  CalendarEventRow,
  UpdateSelectionsRequest,
  SyncEventsRequest,
  CalendarSelectionInput,
} from './types.ts';

// ============================================
// Response Helpers
// ============================================

function createCorsResponse(): Response {
  return new Response('ok', {
    headers: {
      ...corsHeaders,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}

function createSuccessResponse<T>(data: T, requestId: string, processingTimeMs: number): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      requestId,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Processing-Time-Ms': processingTimeMs.toString(),
      },
    }
  );
}

function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode: number,
  processingTimeMs?: number
): Response {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'Content-Type': 'application/json',
  };

  if (processingTimeMs !== undefined) {
    headers['X-Processing-Time-Ms'] = processingTimeMs.toString();
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code,
      requestId,
      timestamp: new Date().toISOString(),
    }),
    { status: statusCode, headers }
  );
}

// ============================================
// Supabase Client Factory
// ============================================

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

// ============================================
// Authentication Helper
// ============================================

async function authenticateUser(
  req: Request,
  supabase: SupabaseClient
): Promise<{ userId: string } | { error: string }> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return { error: 'No authorization header provided' };
  }

  const token = authHeader.replace('Bearer ', '');

  // Use service role client to verify the JWT token directly
  // This avoids needing SUPABASE_ANON_KEY which isn't auto-available in Edge Functions
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('[ms-calendar-sync] Auth validation failed:', error?.message);
    return { error: 'Invalid or expired token' };
  }

  return { userId: user.id };
}

// ============================================
// Tracking Helper
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
    console.log(`[ms-calendar-sync] Could not get email for user ${userId}, skipping tracking`);
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
    console.log(`[ms-calendar-sync] No project found for user ${userId} (${userEmail}), skipping tracking`);
    return null;
  }

  return data.project_id;
}

// ============================================
// Action Handlers
// ============================================

async function handleListAction(
  supabase: SupabaseClient,
  userId: string
): Promise<SyncResponse> {
  // Get user's calendar connection
  const connection = await getConnection(supabase, userId);

  if (!connection) {
    return {
      success: false,
      error: 'No calendar connection found. Please connect your Microsoft calendar first.',
      code: 'NO_CONNECTION',
    };
  }

  // Check connection status
  if (connection.connection_status === 'revoked') {
    return {
      success: false,
      error: 'Calendar access has been revoked. Please reconnect.',
      code: 'CONNECTION_REVOKED',
    };
  }

  // Get project ID for tracking (optional - tracking is skipped if no project)
  const projectId = await getUserProjectId(supabase, userId);

  // Set up tracking options if project is available
  const trackingOptions: ServiceTrackingOptions | undefined = projectId
    ? { supabase, projectId, userId }
    : undefined;

  // Ensure we have a valid access token (with tracking if available)
  const { accessToken, connection: updatedConnection, msGraphTrackingOptions } = await ensureValidToken(
    supabase,
    connection,
    'ms-calendar-sync',
    trackingOptions
  );

  // Fetch calendars from Microsoft Graph (with tracking if available)
  const msCalendars = await listCalendars(accessToken, msGraphTrackingOptions);

  // Get existing selections
  const existingSelections = await getCalendarSelections(supabase, connection.id);

  // Create a map for quick lookup
  const selectionMap = new Map<string, UserCalendarSelectionRow>();
  for (const selection of existingSelections) {
    selectionMap.set(selection.ms_calendar_id, selection);
  }

  // Merge calendars with selection status
  const calendarsWithSelection: CalendarWithSelection[] = msCalendars.map((cal) => {
    const selection = selectionMap.get(cal.id);
    return {
      ...cal,
      isMonitored: selection?.is_monitored ?? false,
      autoRecordAll: selection?.auto_record_all ?? false,
    };
  });

  // Update last sync timestamp
  await updateLastSyncAt(supabase, connection.id);

  return {
    success: true,
    data: {
      calendars: calendarsWithSelection,
      connectionStatus: updatedConnection.connection_status,
      connectionId: connection.id,
    },
  };
}

async function handleUpdateAction(
  supabase: SupabaseClient,
  userId: string,
  connectionId: string,
  selections: CalendarSelectionInput[]
): Promise<SyncResponse> {
  // Validate connection ownership
  const connection = await getConnectionById(supabase, connectionId);

  if (!connection) {
    return {
      success: false,
      error: 'Connection not found',
      code: 'CONNECTION_NOT_FOUND',
    };
  }

  if (connection.user_id !== userId) {
    return {
      success: false,
      error: 'You do not have permission to modify this connection',
      code: 'PERMISSION_DENIED',
    };
  }

  // Check connection status
  if (connection.connection_status === 'revoked') {
    return {
      success: false,
      error: 'Calendar access has been revoked. Please reconnect.',
      code: 'CONNECTION_REVOKED',
    };
  }

  // Upsert the selections
  const updatedSelections = await upsertCalendarSelections(
    supabase,
    connectionId,
    userId,
    selections
  );

  return {
    success: true,
    data: {
      updatedSelections,
      connectionStatus: connection.connection_status,
    },
  };
}

// Default days ahead for event sync
const DEFAULT_DAYS_AHEAD = 7;

async function handleSyncEventsAction(
  supabase: SupabaseClient,
  userId: string,
  calendarSelectionId: string,
  daysAhead: number = DEFAULT_DAYS_AHEAD
): Promise<SyncResponse> {
  // Get calendar selection with connection info
  const selectionData = await getCalendarSelection(supabase, calendarSelectionId);

  if (!selectionData) {
    return {
      success: false,
      error: 'Calendar selection not found',
      code: 'SELECTION_NOT_FOUND',
    };
  }

  // Validate ownership
  if (selectionData.user_id !== userId) {
    return {
      success: false,
      error: 'You do not have permission to sync this calendar',
      code: 'PERMISSION_DENIED',
    };
  }

  const connection = selectionData.connection;

  // Check connection status
  if (connection.connection_status === 'revoked') {
    return {
      success: false,
      error: 'Calendar access has been revoked. Please reconnect.',
      code: 'CONNECTION_REVOKED',
    };
  }

  // Get project ID for tracking (optional - tracking is skipped if no project)
  const projectId = await getUserProjectId(supabase, userId);

  // Set up tracking options if project is available
  const trackingOptions: ServiceTrackingOptions | undefined = projectId
    ? { supabase, projectId, userId }
    : undefined;

  // Ensure we have a valid access token (with tracking if available)
  const { accessToken, msGraphTrackingOptions } = await ensureValidToken(
    supabase,
    connection,
    'ms-calendar-sync',
    trackingOptions
  );

  // Calculate date range
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + daysAhead);

  console.log(
    `[ms-calendar-sync] Syncing events for calendar "${selectionData.calendar_name}" ` +
      `(${startDate.toISOString()} to ${endDate.toISOString()})`
  );

  // Fetch events from Microsoft Graph (with tracking if available)
  const msEvents = await listEvents(
    accessToken,
    selectionData.ms_calendar_id,
    startDate,
    endDate,
    msGraphTrackingOptions
  );

  // Map MS Graph events to database rows
  const eventRows: CalendarEventRow[] = msEvents.map((event) =>
    mapMSGraphEventToRow(event, calendarSelectionId, userId)
  );

  // Upsert events to database
  const { syncedCount, updatedCount } = await upsertCalendarEvents(supabase, eventRows);

  // Mark events that are no longer in MS Calendar as deleted
  const keepEventIds = msEvents.map((e) => e.id);
  const deletedCount = await markEventsDeleted(supabase, calendarSelectionId, keepEventIds);

  // Update last sync timestamp on the connection
  await updateLastSyncAt(supabase, connection.id);

  console.log(
    `[ms-calendar-sync] Sync complete for "${selectionData.calendar_name}": ` +
      `${syncedCount} new, ${updatedCount} updated, ${deletedCount} deleted`
  );

  return {
    success: true,
    data: {
      syncedCount,
      updatedCount,
      deletedCount,
      calendarName: selectionData.calendar_name,
    },
  };
}

// ============================================
// Main Handler
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Only POST is supported
    if (req.method !== 'POST') {
      return createErrorResponse(
        'METHOD_NOT_ALLOWED',
        'Only POST method is supported',
        requestId,
        405
      );
    }

    // Parse request body
    let body: SyncRequest;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        requestId,
        400
      );
    }

    // Validate action
    if (!body.action || !['list', 'update', 'sync_events', 'batch_sync'].includes(body.action)) {
      return createErrorResponse(
        'INVALID_ACTION',
        'Action must be "list", "update", "sync_events", or "batch_sync"',
        requestId,
        400
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Handle batch_sync action (for cron jobs, uses service role)
    if (body.action === 'batch_sync') {
      // Validate service role key for batch operations
      const authHeader = req.headers.get('Authorization');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
        return createErrorResponse(
          'UNAUTHORIZED',
          'Service role key required for batch_sync action',
          requestId,
          401
        );
      }

      const response = await handleBatchSyncAction(supabase);
      const processingTimeMs = Date.now() - startTime;
      return createSuccessResponse(response.data, requestId, processingTimeMs);
    }

    // Authenticate user (for non-batch actions)
    const authResult = await authenticateUser(req, supabase);

    if ('error' in authResult) {
      return createErrorResponse('UNAUTHORIZED', authResult.error, requestId, 401);
    }

    const { userId } = authResult;

    // Handle action
    let response: SyncResponse;

    if (body.action === 'list') {
      response = await handleListAction(supabase, userId);
    } else if (body.action === 'update') {
      // Cast to UpdateSelectionsRequest for type safety
      const updateBody = body as UpdateSelectionsRequest;

      // Validate update request
      if (!updateBody.connectionId) {
        return createErrorResponse(
          'INVALID_REQUEST',
          'connectionId is required for update action',
          requestId,
          400
        );
      }

      if (!Array.isArray(updateBody.selections)) {
        return createErrorResponse(
          'INVALID_REQUEST',
          'selections array is required for update action',
          requestId,
          400
        );
      }

      response = await handleUpdateAction(supabase, userId, updateBody.connectionId, updateBody.selections);
    } else if (body.action === 'sync_events') {
      // Cast to SyncEventsRequest for type safety
      const syncBody = body as SyncEventsRequest;

      // Validate sync_events request
      if (!syncBody.calendarSelectionId) {
        return createErrorResponse(
          'INVALID_REQUEST',
          'calendarSelectionId is required for sync_events action',
          requestId,
          400
        );
      }

      const daysAhead = typeof syncBody.daysAhead === 'number'
        ? syncBody.daysAhead
        : DEFAULT_DAYS_AHEAD;

      response = await handleSyncEventsAction(supabase, userId, syncBody.calendarSelectionId, daysAhead);
    } else {
      return createErrorResponse('INVALID_ACTION', 'Unknown action', requestId, 400);
    }

    const processingTimeMs = Date.now() - startTime;

    // Return response
    if (response.success) {
      return createSuccessResponse(response.data, requestId, processingTimeMs);
    } else {
      const statusCode =
        response.code === 'NO_CONNECTION' ||
        response.code === 'CONNECTION_NOT_FOUND' ||
        response.code === 'SELECTION_NOT_FOUND'
          ? 404
          : response.code === 'PERMISSION_DENIED'
          ? 403
          : response.code === 'CONNECTION_REVOKED'
          ? 401
          : 400;

      return createErrorResponse(response.code, response.error, requestId, statusCode, processingTimeMs);
    }
  } catch (error) {
    console.error('[ms-calendar-sync] Unhandled error:', error);
    const processingTimeMs = Date.now() - startTime;

    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    // Check for specific error types
    if (errorMessage.startsWith('TOKEN_REVOKED')) {
      return createErrorResponse('TOKEN_REVOKED', errorMessage, requestId, 401, processingTimeMs);
    }

    if (errorMessage.startsWith('MS_GRAPH_UNAUTHORIZED')) {
      return createErrorResponse(
        'MS_GRAPH_UNAUTHORIZED',
        'Microsoft Graph API authorization failed',
        requestId,
        401,
        processingTimeMs
      );
    }

    if (errorMessage.startsWith('MS_GRAPH_FORBIDDEN')) {
      return createErrorResponse(
        'MS_GRAPH_FORBIDDEN',
        'Insufficient permissions to access Microsoft Graph resource',
        requestId,
        403,
        processingTimeMs
      );
    }

    if (errorMessage.startsWith('MS_GRAPH_NOT_FOUND')) {
      return createErrorResponse(
        'MS_GRAPH_NOT_FOUND',
        'Microsoft Graph resource not found',
        requestId,
        404,
        processingTimeMs
      );
    }

    if (errorMessage.startsWith('MS_GRAPH_RATE_LIMITED')) {
      return createErrorResponse(
        'MS_GRAPH_RATE_LIMITED',
        'Microsoft Graph API rate limit exceeded. Please try again later.',
        requestId,
        429,
        processingTimeMs
      );
    }

    return createErrorResponse('INTERNAL_ERROR', errorMessage, requestId, 500, processingTimeMs);
  }
});
