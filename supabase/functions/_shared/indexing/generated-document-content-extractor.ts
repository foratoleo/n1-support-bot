/**
 * Generated document content extractor for normalized records
 *
 * Calls get-generated-document-normalized-record Edge Function internally to fetch
 * rich Markdown content with full document context including meeting, sprint,
 * linked features, related documents, and approval workflow data.
 *
 * @module generated-document-content-extractor
 */

import { createContentExtractor } from './content-extractor-factory.ts';

/**
 * Get normalized generated document content via internal Edge Function call.
 * Returns rich Markdown content with full document context.
 *
 * @param generatedDocumentId - The UUID of the generated document to fetch
 * @param projectId - The UUID of the project the document belongs to
 * @returns The normalized Markdown content or null if fetch fails
 *
 * @example
 * ```typescript
 * const content = await getGeneratedDocumentNormalizedContent(documentId, projectId);
 * if (content) {
 *   console.log('Normalized content length:', content.length);
 * }
 * ```
 */
export const getGeneratedDocumentNormalizedContent = createContentExtractor({
  entityName: 'generated-document',
  endpointName: 'get-generated-document-normalized-record',
  entityIdParam: 'generatedDocumentId',
});
