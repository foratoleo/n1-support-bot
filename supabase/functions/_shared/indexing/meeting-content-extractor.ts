/**
 * Meeting content extractor for normalized records
 *
 * Calls get-meeting-normalized-record Edge Function internally to fetch
 * rich Markdown content with full meeting context including participants,
 * sprint, URL, tags, and complete transcript text.
 *
 * @module meeting-content-extractor
 */

import { createContentExtractor } from './content-extractor-factory.ts';

/**
 * Get normalized meeting content via internal Edge Function call.
 * Returns rich Markdown content with full meeting context.
 *
 * @param meetingTranscriptId - The UUID of the meeting transcript to fetch
 * @param projectId - The UUID of the project the meeting belongs to
 * @returns The normalized Markdown content or null if fetch fails
 *
 * @example
 * ```typescript
 * const content = await getMeetingNormalizedContent(meetingTranscriptId, projectId);
 * if (content) {
 *   console.log('Normalized content length:', content.length);
 * }
 * ```
 */
export const getMeetingNormalizedContent = createContentExtractor({
  entityName: 'meeting',
  endpointName: 'get-meeting-normalized-record',
  entityIdParam: 'meetingTranscriptId',
});
