/**
 * Technical Specs Formatter for Normalized Generated Document Record
 *
 * Section order: titulo → metadados → qualidade → aprovacao → reuniao → sprint → features vinculadas → conteudo
 * Serves both 'technical-specs' and 'technical_specs' document types.
 *
 * @module get-generated-document-normalized-record/formatters/specs-formatter
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
  formatContent
} from './base-formatter.ts';

/**
 * Formatter for Technical Specifications documents.
 *
 * Also used for 'technical-specs' alias mapping in the factory.
 */
export const specsFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants, linkedFeatures } = data;

    const sections: string[] = [
      formatTitle(document),
      formatMetadataTable(document),
      formatQualitySection(document),
      formatApprovalSection(document),
      formatMeetingContext(document, participants),
      formatSprintContext(document),
      formatLinkedFeatures(linkedFeatures),
      formatContent(document)
    ].filter((s) => s.length > 0);

    return sections.join('\n\n');
  }
};
