/**
 * Task content extractor for normalized records
 *
 * Calls get-task-normalized-record Edge Function internally to fetch
 * rich Markdown content with full task context including sprint, feature,
 * epic, comments, subtasks, and JIRA data.
 *
 * @module task-content-extractor
 */

import { createContentExtractor } from './content-extractor-factory.ts';

/**
 * Get normalized task content via internal Edge Function call.
 * Returns rich Markdown content with full task context.
 *
 * @param taskId - The UUID of the task to fetch
 * @param projectId - The UUID of the project the task belongs to
 * @returns The normalized Markdown content or null if fetch fails
 *
 * @example
 * ```typescript
 * const content = await getTaskNormalizedContent(taskId, projectId);
 * if (content) {
 *   console.log('Normalized content length:', content.length);
 * }
 * ```
 */
export const getTaskNormalizedContent = createContentExtractor({
  entityName: 'task',
  endpointName: 'get-task-normalized-record',
  entityIdParam: 'taskId',
});
