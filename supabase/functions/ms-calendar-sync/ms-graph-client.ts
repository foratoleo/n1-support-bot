/**
 * MS Calendar Sync Edge Function - Microsoft Graph API Client
 *
 * Handles communication with Microsoft Graph API for calendar operations.
 * Supports optional service call tracking via MSGraphServiceTracker.
 */

import { MSCalendar, MSGraphCalendarResponse, MSGraphEvent, MSGraphEventResponse, TokenResponse } from './types.ts';
import { MSGraphServiceTracker, TrackingContext } from './ms-graph-service-tracker.ts';
import { MS_OAUTH_REFRESH_SCOPES_STRING } from '../_shared/ms-oauth-scopes.ts';

// ============================================
// Constants
// ============================================

const MS_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const MS_OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// ============================================
// Tracking Context Type
// ============================================

export interface MSGraphTrackingOptions {
  tracker: MSGraphServiceTracker;
  projectId: string;
  userId: string;
}

// ============================================
// Token Refresh
// ============================================

/**
 * Refresh access token using refresh token
 * @param refreshToken - The refresh token
 * @param clientId - Microsoft OAuth client ID
 * @param clientSecret - Microsoft OAuth client secret
 * @param trackingOptions - Optional tracking options for logging the API call
 * @returns New token response with access_token and refresh_token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  trackingOptions?: MSGraphTrackingOptions
): Promise<TokenResponse> {
  const startTime = Date.now();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    scope: MS_OAUTH_REFRESH_SCOPES_STRING,
  });

  const response = await fetch(MS_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = 'Failed to refresh access token';

    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error === 'invalid_grant') {
        // Log failed token refresh if tracking is enabled
        if (trackingOptions) {
          await trackingOptions.tracker.logTokenRefresh(
            trackingOptions.projectId,
            trackingOptions.userId,
            MS_OAUTH_TOKEN_URL,
            false,
            durationMs,
            'TOKEN_REVOKED: User has revoked access or token is invalid'
          );
        }
        throw new Error('TOKEN_REVOKED: User has revoked access or token is invalid');
      }
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message.startsWith('TOKEN_REVOKED')) {
        throw parseError;
      }
    }

    // Log failed token refresh if tracking is enabled
    if (trackingOptions) {
      await trackingOptions.tracker.logTokenRefresh(
        trackingOptions.projectId,
        trackingOptions.userId,
        MS_OAUTH_TOKEN_URL,
        false,
        durationMs,
        errorMessage
      );
    }

    console.error('[ms-graph-client] Token refresh error:', errorText);
    throw new Error(`TOKEN_REFRESH_ERROR: ${errorMessage}`);
  }

  // Log successful token refresh if tracking is enabled
  if (trackingOptions) {
    await trackingOptions.tracker.logTokenRefresh(
      trackingOptions.projectId,
      trackingOptions.userId,
      MS_OAUTH_TOKEN_URL,
      true,
      durationMs
    );
  }

  const tokenData = await response.json();

  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || refreshToken, // MS may not return new refresh token
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
    scope: tokenData.scope,
  };
}

// ============================================
// Calendar Operations
// ============================================

/**
 * List all calendars accessible by the user from Microsoft Graph
 * @param accessToken - Valid access token
 * @param trackingOptions - Optional tracking options for logging the API call
 * @returns Array of MS Calendar objects
 */
export async function listCalendars(
  accessToken: string,
  trackingOptions?: MSGraphTrackingOptions
): Promise<MSCalendar[]> {
  const calendars: MSCalendar[] = [];
  let nextLink: string | undefined = `${MS_GRAPH_BASE_URL}/me/calendars?$select=id,name,color,hexColor,isDefaultCalendar,canEdit,owner`;
  let pageCount = 0;

  // Create tracked fetch if tracking is enabled
  const trackedFetch = trackingOptions
    ? trackingOptions.tracker.createTrackedFetch({
        projectId: trackingOptions.projectId,
        userId: trackingOptions.userId,
        operationType: 'query',
        endpointPath: '/me/calendars',
      })
    : null;

  while (nextLink) {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    let response: Response;
    let data: MSGraphCalendarResponse;

    if (trackedFetch) {
      // Use tracked fetch for first page only (to avoid duplicate tracking for pagination)
      if (pageCount === 0) {
        const result = await trackedFetch<MSGraphCalendarResponse>(nextLink, {
          method: 'GET',
          headers,
        });
        response = result.response;
        data = result.data;
      } else {
        // For subsequent pages, use regular fetch
        response = await fetch(nextLink, { method: 'GET', headers });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ms-graph-client] List calendars pagination error:', errorText);
          throw new Error(`MS_GRAPH_ERROR: Failed to list calendars - ${response.status}`);
        }
        data = await response.json();
      }
    } else {
      response = await fetch(nextLink, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ms-graph-client] List calendars error:', errorText);

        // Check for specific error codes
        if (response.status === 401) {
          throw new Error('MS_GRAPH_UNAUTHORIZED: Access token is invalid or expired');
        }
        if (response.status === 403) {
          throw new Error('MS_GRAPH_FORBIDDEN: Insufficient permissions to access calendars');
        }

        throw new Error(`MS_GRAPH_ERROR: Failed to list calendars - ${response.status}`);
      }

      data = await response.json();
    }

    // Map Graph response to our MSCalendar type
    for (const cal of data.value) {
      calendars.push({
        id: cal.id,
        name: cal.name,
        color: cal.hexColor || cal.color || '#0078D4', // Use hexColor if available, fallback to color name
        isDefaultCalendar: cal.isDefaultCalendar || false,
        canEdit: cal.canEdit || false,
        owner: cal.owner,
      });
    }

    // Handle pagination
    nextLink = data['@odata.nextLink'];
    pageCount++;
  }

  console.log(`[ms-graph-client] Retrieved ${calendars.length} calendars from Microsoft Graph`);
  return calendars;
}

/**
 * Get user profile information from Microsoft Graph
 * @param accessToken - Valid access token
 * @returns User principal name (email)
 */
export async function getUserProfile(accessToken: string): Promise<{ userPrincipalName: string }> {
  const response = await fetch(`${MS_GRAPH_BASE_URL}/me?$select=userPrincipalName`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ms-graph-client] Get user profile error:', errorText);
    throw new Error('MS_GRAPH_ERROR: Failed to get user profile');
  }

  const data = await response.json();
  return {
    userPrincipalName: data.userPrincipalName,
  };
}

// ============================================
// Event Operations
// ============================================

// Maximum retry attempts for rate limiting
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

/**
 * List events from a specific calendar within a date range
 * @param accessToken - Valid access token
 * @param calendarId - Microsoft calendar ID
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (exclusive)
 * @param trackingOptions - Optional tracking options for logging the API call
 * @returns Array of MS Graph Event objects
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  startDate: Date,
  endDate: Date,
  trackingOptions?: MSGraphTrackingOptions
): Promise<MSGraphEvent[]> {
  const events: MSGraphEvent[] = [];

  // Build the $select fields as per requirements
  const selectFields = [
    'id',
    'subject',
    'body',
    'start',
    'end',
    'location',
    'onlineMeeting',
    'organizer',
    'attendees',
    'isOnlineMeeting',
    'onlineMeetingProvider',
    'isAllDay',
    'isCancelled',
    'recurrence',
    'seriesMasterId',
    'type',
    'sensitivity',
    'showAs',
    'iCalUId',
    'webLink',
    'createdDateTime',
    'lastModifiedDateTime',
  ].join(',');

  // Format dates for MS Graph API (ISO 8601)
  const startDateTime = startDate.toISOString();
  const endDateTime = endDate.toISOString();

  // Build the calendar view URL with date filter
  // Using calendarView endpoint to get expanded recurring events
  let nextLink: string | undefined =
    `${MS_GRAPH_BASE_URL}/me/calendars/${calendarId}/calendarView` +
    `?startDateTime=${encodeURIComponent(startDateTime)}` +
    `&endDateTime=${encodeURIComponent(endDateTime)}` +
    `&$select=${selectFields}` +
    `&$orderby=start/dateTime` +
    `&$top=50`; // Batch size

  let retryCount = 0;
  let pageCount = 0;

  // Create tracked fetch if tracking is enabled
  const trackedFetch = trackingOptions
    ? trackingOptions.tracker.createTrackedFetch({
        projectId: trackingOptions.projectId,
        userId: trackingOptions.userId,
        operationType: 'sync',
        endpointPath: `/me/calendars/${calendarId}/calendarView`,
      })
    : null;

  while (nextLink) {
    try {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'outlook.timezone="UTC"',
      };

      let response: Response;
      let data: MSGraphEventResponse;

      if (trackedFetch && pageCount === 0) {
        // Use tracked fetch for first page only
        const result = await trackedFetch<MSGraphEventResponse>(nextLink, {
          method: 'GET',
          headers,
        });
        response = result.response;
        data = result.data;
      } else {
        response = await fetch(nextLink, { method: 'GET', headers });

        if (!response.ok) {
          const errorText = await response.text();

          // Handle rate limiting (429)
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delayMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);

            if (retryCount < MAX_RETRIES) {
              console.log(
                `[ms-graph-client] Rate limited, waiting ${delayMs}ms before retry ${retryCount + 1}/${MAX_RETRIES}`
              );
              await sleep(delayMs);
              retryCount++;
              continue; // Retry the same request
            } else {
              console.error('[ms-graph-client] Max retries exceeded for rate limiting');
              throw new Error('MS_GRAPH_RATE_LIMITED: Too many requests, please try again later');
            }
          }

          // Handle unauthorized (401)
          if (response.status === 401) {
            console.error('[ms-graph-client] List events unauthorized:', errorText);
            throw new Error('MS_GRAPH_UNAUTHORIZED: Access token is invalid or expired');
          }

          // Handle forbidden (403)
          if (response.status === 403) {
            console.error('[ms-graph-client] List events forbidden:', errorText);
            throw new Error('MS_GRAPH_FORBIDDEN: Insufficient permissions to access calendar events');
          }

          // Handle not found (404) - calendar may have been deleted
          if (response.status === 404) {
            console.error('[ms-graph-client] Calendar not found:', errorText);
            throw new Error('MS_GRAPH_NOT_FOUND: Calendar not found or has been deleted');
          }

          console.error('[ms-graph-client] List events error:', errorText);
          throw new Error(`MS_GRAPH_ERROR: Failed to list events - ${response.status}`);
        }

        data = await response.json();
      }

      // Reset retry count on success
      retryCount = 0;

      // Add events to our collection
      for (const event of data.value) {
        events.push(event);
      }

      // Handle pagination
      nextLink = data['@odata.nextLink'];
      pageCount++;
    } catch (error) {
      // Re-throw if it's one of our custom errors
      if (error instanceof Error && error.message.startsWith('MS_GRAPH_')) {
        throw error;
      }

      // Network or other errors
      console.error('[ms-graph-client] Unexpected error fetching events:', error);
      throw new Error(`MS_GRAPH_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log(
    `[ms-graph-client] Retrieved ${events.length} events from calendar ${calendarId} ` +
      `(${startDate.toISOString()} to ${endDate.toISOString()})`
  );

  return events;
}

/**
 * Extract meeting URL from an MS Graph event
 * @param event - Microsoft Graph event object
 * @returns Object with meeting URL and detected platform
 */
export function extractMeetingUrl(event: MSGraphEvent): { url: string | null; platform: string } {
  // Priority 1: Check the onlineMeeting joinUrl field
  if (event.onlineMeeting?.joinUrl) {
    const platform = detectMeetingPlatform(event.onlineMeeting.joinUrl, event.onlineMeetingProvider);
    return { url: event.onlineMeeting.joinUrl, platform };
  }

  // Priority 2: Check the body content for meeting URLs
  if (event.body?.content) {
    const extracted = extractMeetingUrlFromText(event.body.content);
    if (extracted) {
      return extracted;
    }
  }

  // Priority 3: Check location for meeting URLs
  if (event.location?.displayName) {
    const extracted = extractMeetingUrlFromText(event.location.displayName);
    if (extracted) {
      return extracted;
    }
  }

  // No meeting URL found
  return { url: null, platform: 'none' };
}

/**
 * Detect the meeting platform from URL and provider hint
 */
function detectMeetingPlatform(url: string, provider?: string): string {
  // Use provider hint if available
  if (provider) {
    switch (provider) {
      case 'teamsForBusiness':
        return 'microsoft_teams';
      case 'skypeForBusiness':
      case 'skypeForConsumer':
        return 'skype';
    }
  }

  // Detect from URL patterns
  const urlLower = url.toLowerCase();

  if (urlLower.includes('teams.microsoft.com') || urlLower.includes('teams.live.com')) {
    return 'microsoft_teams';
  }

  if (urlLower.includes('zoom.us') || urlLower.includes('zoom.com')) {
    return 'zoom';
  }

  if (urlLower.includes('meet.google.com')) {
    return 'google_meet';
  }

  if (urlLower.includes('webex.com')) {
    return 'webex';
  }

  if (urlLower.includes('gotomeeting.com') || urlLower.includes('gotomeet.me')) {
    return 'goto_meeting';
  }

  if (urlLower.includes('join.skype.com') || urlLower.includes('skype.com')) {
    return 'skype';
  }

  if (urlLower.includes('chime.aws')) {
    return 'amazon_chime';
  }

  if (urlLower.includes('bluejeans.com')) {
    return 'bluejeans';
  }

  return 'other';
}

/**
 * Extract meeting URL from text content (HTML or plain text)
 */
function extractMeetingUrlFromText(text: string): { url: string; platform: string } | null {
  // Common meeting URL patterns
  const patterns = [
    // Microsoft Teams
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>]+/gi,
    /https:\/\/teams\.live\.com\/meet\/[^\s"'<>]+/gi,
    // Zoom
    /https:\/\/[\w.-]*zoom\.us\/j\/\d+[^\s"'<>]*/gi,
    /https:\/\/[\w.-]*zoom\.com\/j\/\d+[^\s"'<>]*/gi,
    // Google Meet
    /https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}[^\s"'<>]*/gi,
    // Webex
    /https:\/\/[\w.-]*webex\.com\/[\w.-]+\/j\.php\?[^\s"'<>]+/gi,
    /https:\/\/[\w.-]*webex\.com\/meet\/[^\s"'<>]+/gi,
    // GoToMeeting
    /https:\/\/[\w.-]*gotomeeting\.com\/join\/\d+[^\s"'<>]*/gi,
    /https:\/\/[\w.-]*gotomeet\.me\/[^\s"'<>]+/gi,
    // Skype
    /https:\/\/join\.skype\.com\/[^\s"'<>]+/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const url = matches[0];
      const platform = detectMeetingPlatform(url);
      return { url, platform };
    }
  }

  return null;
}

/**
 * Sleep helper for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Create Event Types
// ============================================

export interface CreateCalendarEventRequest {
  /** Event subject/title */
  subject: string;
  /** Event body content (optional) */
  body?: string;
  /** Event body content type */
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
}

export interface CreateCalendarEventResponse {
  /** Created event ID from MS Graph */
  eventId: string;
  /** Web link to view the event */
  webLink: string;
  /** Online meeting join URL (if created) */
  onlineMeetingUrl?: string;
  /** Whether the operation was successful */
  success: boolean;
}

// ============================================
// Create Event Operation
// ============================================

/**
 * Create a new calendar event in Microsoft Calendar
 * @param accessToken - Valid access token with Calendars.ReadWrite scope
 * @param calendarId - Microsoft calendar ID (use 'primary' for default calendar)
 * @param eventData - Event details to create
 * @param trackingOptions - Optional tracking options for logging the API call
 * @returns Created event response with eventId and webLink
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  eventData: CreateCalendarEventRequest,
  trackingOptions?: MSGraphTrackingOptions
): Promise<CreateCalendarEventResponse> {
  // Build the MS Graph event body
  const msGraphEventBody: Record<string, unknown> = {
    subject: eventData.subject,
    start: {
      dateTime: eventData.startDateTime,
      timeZone: eventData.timeZone,
    },
    end: {
      dateTime: eventData.endDateTime,
      timeZone: eventData.timeZone,
    },
  };

  // Add body content if provided
  if (eventData.body || eventData.meetingUrl) {
    let bodyContent = eventData.body || '';

    // Append meeting URL to body if provided
    if (eventData.meetingUrl) {
      const separator = bodyContent ? '\n\n' : '';
      const meetingUrlHtml = eventData.bodyContentType === 'html'
        ? `${separator}<p><strong>Meeting Link:</strong> <a href="${eventData.meetingUrl}">${eventData.meetingUrl}</a></p>`
        : `${separator}Meeting Link: ${eventData.meetingUrl}`;
      bodyContent += meetingUrlHtml;
    }

    msGraphEventBody.body = {
      contentType: eventData.bodyContentType || 'text',
      content: bodyContent,
    };
  }

  // Add location if provided
  if (eventData.location) {
    msGraphEventBody.location = {
      displayName: eventData.location,
    };
  }

  // Add attendees if provided
  if (eventData.attendeeEmails && eventData.attendeeEmails.length > 0) {
    msGraphEventBody.attendees = eventData.attendeeEmails.map((email) => ({
      emailAddress: {
        address: email,
      },
      type: 'required',
    }));
  }

  // Request online meeting (Teams) if specified
  if (eventData.isOnlineMeeting) {
    msGraphEventBody.isOnlineMeeting = true;
    msGraphEventBody.onlineMeetingProvider = 'teamsForBusiness';
  }

  // Determine endpoint - use specific calendar or default
  const calendarPath = calendarId === 'primary' ? '' : `/calendars/${calendarId}`;
  const url = `${MS_GRAPH_BASE_URL}/me${calendarPath}/events`;

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const requestBody = JSON.stringify(msGraphEventBody);

  // Create tracked fetch if tracking is enabled
  const trackedFetch = trackingOptions
    ? trackingOptions.tracker.createTrackedFetch({
        projectId: trackingOptions.projectId,
        userId: trackingOptions.userId,
        operationType: 'generate',
        endpointPath: `/me${calendarPath}/events`,
      })
    : null;

  try {
    let response: Response;
    let data: MSGraphEvent;

    if (trackedFetch) {
      const result = await trackedFetch<MSGraphEvent>(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });
      response = result.response;
      data = result.data;
    } else {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ms-graph-client] Create event error:', errorText);

        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('MS_GRAPH_UNAUTHORIZED: Access token is invalid or expired');
        }
        if (response.status === 403) {
          throw new Error('MS_GRAPH_FORBIDDEN: Insufficient permissions to create calendar events. Calendars.ReadWrite scope required.');
        }
        if (response.status === 404) {
          throw new Error('MS_GRAPH_NOT_FOUND: Calendar not found or has been deleted');
        }
        if (response.status === 429) {
          throw new Error('MS_GRAPH_RATE_LIMITED: Too many requests. Please try again later.');
        }

        throw new Error(`MS_GRAPH_ERROR: Failed to create event - ${response.status}`);
      }

      data = await response.json();
    }

    console.log(`[ms-graph-client] Created event "${data.subject}" with ID ${data.id}`);

    return {
      eventId: data.id,
      webLink: data.webLink,
      onlineMeetingUrl: data.onlineMeeting?.joinUrl,
      success: true,
    };
  } catch (error) {
    // Re-throw if it's one of our custom errors
    if (error instanceof Error && error.message.startsWith('MS_GRAPH_')) {
      throw error;
    }

    // Network or other errors
    console.error('[ms-graph-client] Unexpected error creating event:', error);
    throw new Error(`MS_GRAPH_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
