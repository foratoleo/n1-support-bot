/**
 * Test Results Formatter for Normalized Generated Document Record
 *
 * Section order: titulo → metadados → qualidade → aprovacao → reuniao → sprint → conteudo
 * Serves both 'accessibility-test-result' and 'performance-test-result' document types.
 *
 * @module get-generated-document-normalized-record/formatters/results-formatter
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
 * Formatter for test result documents (accessibility and performance).
 *
 * Test results are execution snapshots — they do not include linked features
 * or related documents to keep the record focused on the test outcome.
 */
export const resultsFormatter: DocumentFormatter = {
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
