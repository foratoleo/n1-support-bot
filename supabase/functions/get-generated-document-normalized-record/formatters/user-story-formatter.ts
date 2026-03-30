/**
 * User Story Formatter for Normalized Generated Document Record
 *
 * Section order: titulo → metadados → qualidade → aprovacao → reuniao → sprint → features vinculadas → documentos relacionados → conteudo
 *
 * @module get-generated-document-normalized-record/formatters/user-story-formatter
 */

import {
  DocumentFormatter,
  NormalizedGeneratedDocumentData
} from '../types.ts';

import {
  formatTitle,
  formatMetadataTable,
  formatQualitySection,
  formatApprovalSection,
  formatMeetingContext,
  formatSprintContext,
  formatLinkedFeatures,
  formatRelatedDocuments,
  formatContent
} from './base-formatter.ts';

/**
 * Formatter for User Story documents.
 */
export const userStoryFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants, linkedFeatures, relatedDocuments } = data;

    const sections: string[] = [
      formatTitle(document),
      formatMetadataTable(document),
      formatQualitySection(document),
      formatApprovalSection(document),
      formatMeetingContext(document, participants),
      formatSprintContext(document),
      formatLinkedFeatures(linkedFeatures),
      formatRelatedDocuments(relatedDocuments),
      formatContent(document)
    ].filter((s) => s.length > 0);

    return sections.join('\n\n');
  }
};
