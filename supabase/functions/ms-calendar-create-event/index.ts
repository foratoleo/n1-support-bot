/**
 * MS Calendar Create Event Edge Function
 *
 * Creates calendar events in Microsoft Calendar when meetings are created.
 * Uses the MS Graph API to create events with proper authentication and tracking.
 *
 * @module ms-calendar-create-event
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import {
  createEvent,
  CreateCalendarEventRequest,
  CreateCalendarEventResponse,
} from '../ms-calendar-sync/ms-graph-client.ts';
import {
  getConnection,
  ensureValidToken,
  ServiceTrackingOptions,
} from '../ms-calendar-sync/database-service.ts';

// ============================================
// Request/Response Types
// ============================================

interface CreateEventRequestBody {
  /** Event subject/title */
  subject: string;
  /** Event body content (optional) */
  body?: string;
  /** Event body content type (default: 'text') */
  bodyContentType?: 'text' | 'html';
  /** Start datetime in ISO 8601 format */
  startDateTime: string;
  /** End datetime in ISO 8601 format */
  endDateTime: string;
  /** Timezone for start/end (e.g., 'America/Sao_Paulo', 'UTC') */
  timeZone: string;
  /** Physical location (optional) */
  location?: string;
  /** Attendee email addresses (optional) */
  attendeeEmails?: string[];
  /** Meeting URL to include in body (optional) */
  meetingUrl?: string;
  /** Whether to request online meeting (Teams) */
  isOnlineMeeting?: boolean;
  /** Specific calendar ID (optional, uses default calendar if not provided) */
  calendarId?: string;
}

interface CreateEventSuccessResponse {
  success: true;
  data: {
    eventId: string;
    webLink: string;
    onlineMeetingUrl?: string;
  };
  requestId: string;
}

interface CreateEventErrorResponse {
  success: false;
  error: string;
  code: string;
  requestId: string;
  timestamp: string;
}

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

function createSuccessResponse(
  data: CreateEventSuccessResponse['data'],
  requestId: string,
  processingTimeMs: number
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      requestId,
    }),
    {
      status: 201,
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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('[ms-calendar-create-event] Auth validation failed:', error?.message);
    return { error: 'Invalid or expired token' };
  }

  return { userId: user.id };
}

// ============================================
// Tracking Helper
// ============================================

/**
 * Get the user's first project for tracking purposes
 */
async function getUserProjectId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: userData, error: userError } = await supabase
    .auth.admin.getUserById(userId);

  if (userError || !userData?.user?.email) {
    console.log(`[ms-calendar-create-event] Could not get email for user ${userId}, skipping tracking`);
    return null;
  }

  const userEmail = userData.user.email;

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
    console.log(`[ms-calendar-create-event] No project found for user ${userId} (${userEmail}), skipping tracking`);
    return null;
  }

  return data.project_id;
}

// ============================================
// Request Validation
// ============================================

function validateRequestBody(
  body: unknown
): { valid: true; data: CreateEventRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const request = body as Record<string, unknown>;

  // Validate required fields
  if (!request.subject || typeof request.subject !== 'string') {
    return { valid: false, error: 'subject is required and must be a string' };
  }

  if (!request.startDateTime || typeof request.startDateTime !== 'string') {
    return { valid: false, error: 'startDateTime is required and must be an ISO 8601 string' };
  }

  if (!request.endDateTime || typeof request.endDateTime !== 'string') {
    return { valid: false, error: 'endDateTime is required and must be an ISO 8601 string' };
  }

  if (!request.timeZone || typeof request.timeZone !== 'string') {
    return { valid: false, error: 'timeZone is required and must be a string (e.g., "America/Sao_Paulo")' };
  }

  // Validate dates are valid
  const startDate = new Date(request.startDateTime as string);
  const endDate = new Date(request.endDateTime as string);

  if (isNaN(startDate.getTime())) {
    return { valid: false, error: 'startDateTime is not a valid ISO 8601 date' };
  }

  if (isNaN(endDate.getTime())) {
    return { valid: false, error: 'endDateTime is not a valid ISO 8601 date' };
  }

  if (endDate <= startDate) {
    return { valid: false, error: 'endDateTime must be after startDateTime' };
  }

  // Validate optional fields
  if (request.body !== undefined && typeof request.body !== 'string') {
    return { valid: false, error: 'body must be a string if provided' };
  }

  if (request.bodyContentType !== undefined && !['text', 'html'].includes(request.bodyContentType as string)) {
    return { valid: false, error: 'bodyContentType must be "text" or "html"' };
  }

  if (request.location !== undefined && typeof request.location !== 'string') {
    return { valid: false, error: 'location must be a string if provided' };
  }

  if (request.attendeeEmails !== undefined) {
    if (!Array.isArray(request.attendeeEmails)) {
      return { valid: false, error: 'attendeeEmails must be an array of strings' };
    }
    for (const email of request.attendeeEmails) {
      if (typeof email !== 'string' || !email.includes('@')) {
        return { valid: false, error: 'All attendeeEmails must be valid email strings' };
      }
    }
  }

  if (request.meetingUrl !== undefined && typeof request.meetingUrl !== 'string') {
    return { valid: false, error: 'meetingUrl must be a string if provided' };
  }

  if (request.isOnlineMeeting !== undefined && typeof request.isOnlineMeeting !== 'boolean') {
    return { valid: false, error: 'isOnlineMeeting must be a boolean if provided' };
  }

  if (request.calendarId !== undefined && typeof request.calendarId !== 'string') {
    return { valid: false, error: 'calendarId must be a string if provided' };
  }

  return {
    valid: true,
    data: {
      subject: request.subject as string,
      body: request.body as string | undefined,
      bodyContentType: request.bodyContentType as 'text' | 'html' | undefined,
      startDateTime: request.startDateTime as string,
      endDateTime: request.endDateTime as string,
      timeZone: request.timeZone as string,
      location: request.location as string | undefined,
      attendeeEmails: request.attendeeEmails as string[] | undefined,
      meetingUrl: request.meetingUrl as string | undefined,
      isOnlineMeeting: request.isOnlineMeeting as boolean | undefined,
      calendarId: request.calendarId as string | undefined,
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
    let body: unknown;
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

    // Validate request body
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        validation.error,
        requestId,
        400
      );
    }

    const eventData = validation.data;

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Authenticate user
    const authResult = await authenticateUser(req, supabase);

    if ('error' in authResult) {
      return createErrorResponse('UNAUTHORIZED', authResult.error, requestId, 401);
    }

    const { userId } = authResult;

    // Get user's calendar connection
    const connection = await getConnection(supabase, userId);

    if (!connection) {
      return createErrorResponse(
        'NO_CONNECTION',
        'No calendar connection found. Please connect your Microsoft calendar first.',
        requestId,
        404
      );
    }

    // Check connection status
    if (connection.connection_status === 'revoked') {
      return createErrorResponse(
        'CONNECTION_REVOKED',
        'Calendar access has been revoked. Please reconnect.',
        requestId,
        401
      );
    }

    // Get project ID for tracking (optional)
    const projectId = await getUserProjectId(supabase, userId);

    // Set up tracking options if project is available
    const trackingOptions: ServiceTrackingOptions | undefined = projectId
      ? { supabase, projectId, userId }
      : undefined;

    // Ensure we have a valid access token
    const { accessToken, msGraphTrackingOptions } = await ensureValidToken(
      supabase,
      connection,
      'ms-calendar-create-event',
      trackingOptions
    );

    // Build create event request
    const createEventRequest: CreateCalendarEventRequest = {
      subject: eventData.subject,
      body: eventData.body,
      bodyContentType: eventData.bodyContentType,
      startDateTime: eventData.startDateTime,
      endDateTime: eventData.endDateTime,
      timeZone: eventData.timeZone,
      location: eventData.location,
      attendeeEmails: eventData.attendeeEmails,
      meetingUrl: eventData.meetingUrl,
      isOnlineMeeting: eventData.isOnlineMeeting,
    };

    // Use specified calendar or default ('primary')
    const calendarId = eventData.calendarId || 'primary';

    // Create the event
    const result: CreateCalendarEventResponse = await createEvent(
      accessToken,
      calendarId,
      createEventRequest,
      msGraphTrackingOptions
    );

    const processingTimeMs = Date.now() - startTime;

    console.log(
      `[ms-calendar-create-event] Created event "${eventData.subject}" for user ${userId} in ${processingTimeMs}ms`
    );

    return createSuccessResponse(
      {
        eventId: result.eventId,
        webLink: result.webLink,
        onlineMeetingUrl: result.onlineMeetingUrl,
      },
      requestId,
      processingTimeMs
    );
  } catch (error) {
    console.error('[ms-calendar-create-event] Unhandled error:', error);
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
        'Insufficient permissions to create calendar events. Calendars.ReadWrite scope required.',
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
