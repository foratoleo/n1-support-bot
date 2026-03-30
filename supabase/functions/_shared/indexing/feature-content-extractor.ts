/**
 * Feature content extractor for normalized records
 *
 * Calls get-feature-normalized-record Edge Function internally to fetch
 * rich Markdown content with full feature context including epic, tasks,
 * sprints, meetings, documents, and attachments.
 *
 * @module feature-content-extractor
 */

import { createContentExtractor } from './content-extractor-factory.ts';

/**
 * Get normalized feature content via internal Edge Function call.
 * Returns rich Markdown content with full feature context.
 *
 * @param featureId - The UUID of the feature to fetch
 * @param projectId - The UUID of the project the feature belongs to
 * @returns The normalized Markdown content or null if fetch fails
 *
 * @example
 * ```typescript
 * const content = await getFeatureNormalizedContent(featureId, projectId);
 * if (content) {
 *   console.log('Normalized content length:', content.length);
 * }
 * ```
 */
export const getFeatureNormalizedContent = createContentExtractor({
  entityName: 'feature',
  endpointName: 'get-feature-normalized-record',
  entityIdParam: 'featureId',
});
