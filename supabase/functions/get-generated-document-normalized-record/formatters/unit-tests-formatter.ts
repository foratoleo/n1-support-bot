/**
 * Unit Tests Formatter for Normalized Generated Document Record
 *
 * Section order: titulo → metadados → qualidade → aprovacao → reuniao → sprint → conteudo
 *
 * @module get-generated-document-normalized-record/formatters/unit-tests-formatter
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
  formatContent
} from './base-formatter.ts';

/**
 * Formatter for Unit Tests documents.
 *
 * Does not render linked features or related documents —
 * unit tests are implementation-scoped, not feature-scoped.
 */
export const unitTestsFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants } = data;

    const sections: string[] = [
      formatTitle(document),
      formatMetadataTable(document),
      formatQualitySection(document),
      formatApprovalSection(document),
      formatMeetingContext(document, participants),
      formatSprintContext(document),
      formatContent(document)
    ].filter((s) => s.length > 0);

    return sections.join('\n\n');
  }
};
