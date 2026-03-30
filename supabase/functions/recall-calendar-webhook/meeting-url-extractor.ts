/**
 * Meeting URL Extractor for Calendar Events
 *
 * Extracts meeting URLs from Recall.ai calendar event data
 * and identifies the meeting platform (Teams, Zoom, Meet, Webex)
 *
 * @see supabase/functions/_shared/recall-bot-types.ts for parseMeetingUrl reference
 */

import type { RecallCalendarEvent, MeetingUrlExtraction, MeetingPlatform } from "./types.ts";

/**
 * URL patterns for meeting platform detection
 */
const PLATFORM_PATTERNS: Record<MeetingPlatform, RegExp[]> = {
  teams: [
    /teams\.microsoft\.com/i,
    /teams\.live\.com/i,
  ],
  zoom: [
    /zoom\.us/i,
    /zoom\.com/i,
  ],
  google_meet: [
    /meet\.google\.com/i,
  ],
  webex: [
    /webex\.com/i,
  ],
  unknown: [],
};

/**
 * Detect meeting platform from URL
 *
 * @param url - Meeting URL to analyze
 * @returns Detected platform or 'unknown'
 */
function detectPlatform(url: string): MeetingPlatform {
  const urlLower = url.toLowerCase();

  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (platform === 'unknown') continue;

    for (const pattern of patterns) {
      if (pattern.test(urlLower)) {
        return platform as MeetingPlatform;
      }
    }
  }

  return 'unknown';
}

/**
 * Extract URL from text content (location, description, etc.)
 *
 * @param text - Text that may contain a meeting URL
 * @returns Extracted URL or null
 */
function extractUrlFromText(text: string | undefined | null): string | null {
  if (!text) return null;

  // Match URLs for known meeting platforms
  const urlPattern = /https?:\/\/(?:teams\.microsoft\.com|teams\.live\.com|zoom\.us|zoom\.com|meet\.google\.com|[a-z0-9-]+\.webex\.com)\/[^\s<>"{}|\\^`[\]]+/gi;

  const match = text.match(urlPattern);
  return match ? match[0] : null;
}

/**
 * Validate if URL is a proper meeting URL
 *
 * @param url - URL to validate
 * @returns True if URL is a valid meeting link
 */
function isValidMeetingUrl(url: string | undefined | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const platform = detectPlatform(url);
    return platform !== 'unknown' && parsed.protocol.startsWith('http');
  } catch {
    return false;
  }
}

/**
 * Extract meeting URL from Recall.ai calendar event
 *
 * Checks multiple locations in order of priority:
 * 1. online_meeting.conference_url (primary)
 * 2. online_meeting.join_url (fallback)
 * 3. location field (may contain URL)
 * 4. description field (may contain URL)
 *
 * @param event - Recall.ai calendar event object
 * @returns Object with extracted URL and detected platform
 */
export function extractMeetingUrl(event: RecallCalendarEvent): MeetingUrlExtraction {
  // Priority 1: Check online_meeting.conference_url
  if (event.online_meeting?.conference_url && isValidMeetingUrl(event.online_meeting.conference_url)) {
    const url = event.online_meeting.conference_url;
    return {
      url,
      platform: detectPlatform(url),
    };
  }

  // Priority 2: Check online_meeting.join_url
  if (event.online_meeting?.join_url && isValidMeetingUrl(event.online_meeting.join_url)) {
    const url = event.online_meeting.join_url;
    return {
      url,
      platform: detectPlatform(url),
    };
  }

  // Priority 3: Check location field for embedded URL
  const locationUrl = extractUrlFromText(event.location);
  if (locationUrl && isValidMeetingUrl(locationUrl)) {
    return {
      url: locationUrl,
      platform: detectPlatform(locationUrl),
    };
  }

  // Priority 4: Check description/body for embedded URL
  const descriptionUrl = extractUrlFromText(event.description);
  if (descriptionUrl && isValidMeetingUrl(descriptionUrl)) {
    return {
      url: descriptionUrl,
      platform: detectPlatform(descriptionUrl),
    };
  }

  // No meeting URL found
  return {
    url: null,
    platform: 'unknown',
  };
}

/**
 * Check if event has a meeting URL
 *
 * @param event - Recall.ai calendar event object
 * @returns True if event contains a valid meeting URL
 */
export function hasMeetingUrl(event: RecallCalendarEvent): boolean {
  const { url } = extractMeetingUrl(event);
  return url !== null;
}
