/**
 * Backlog item content extractor for normalized records
 *
 * Calls get-backlog-normalized-record Edge Function internally to fetch
 * rich Markdown content with full backlog item context including features,
 * tasks, and progress metrics.
 *
 * @module backlog-content-extractor
 */

import { createContentExtractor } from './content-extractor-factory.ts';

/**
 * Get normalized backlog item content via internal Edge Function call.
 * Returns rich Markdown content with full backlog item context.
 *
 * @param backlogItemId - The UUID of the backlog item to fetch
 * @param projectId - The UUID of the project the backlog item belongs to
 * @returns The normalized Markdown content or null if fetch fails
 *
 * @example
 * ```typescript
 * const content = await getBacklogNormalizedContent(backlogItemId, projectId);
 * if (content) {
 *   console.log('Normalized content length:', content.length);
 * }
 * ```
 */
export const getBacklogNormalizedContent = createContentExtractor({
  entityName: 'backlog item',
  endpointName: 'get-backlog-normalized-record',
  entityIdParam: 'backlogItemId',
});
