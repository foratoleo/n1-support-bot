/**
 * Meeting Notes Formatter for Normalized Generated Document Record
 *
 * Section order: titulo → metadados → qualidade → aprovacao → reuniao com participantes → sprint → documentos relacionados → conteudo
 *
 * @module get-generated-document-normalized-record/formatters/meeting-notes-formatter
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
  formatRelatedDocuments,
  formatContent
} from './base-formatter.ts';

/**
 * Formatter for Meeting Notes (Ata de Reuniao) documents.
 *
 * Includes full participant list in the meeting context section.
 * Does not render linked features (meeting notes are not feature-scoped).
 */
export const meetingNotesFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants, relatedDocuments } = data;

    const sections: string[] = [
      formatTitle(document),
      formatMetadataTable(document),
      formatQualitySection(document),
      formatApprovalSection(document),
      formatMeetingContext(document, participants),
      formatSprintContext(document),
      formatRelatedDocuments(relatedDocuments),
      formatContent(document)
    ].filter((s) => s.length > 0);

    return sections.join('\n\n');
  }
};
