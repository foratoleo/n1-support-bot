/**
 * Default Formatter for Normalized Generated Document Record
 *
 * Fallback formatter used when no type-specific formatter is found.
 * Renders all available sections: title, metadata, quality, approval,
 * meeting context, sprint context, and full content.
 *
 * @module get-generated-document-normalized-record/formatters/default-formatter
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
 * Default document formatter — serves as fallback for unmapped document types.
 */
export const defaultFormatter: DocumentFormatter = {
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
