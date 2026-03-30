/**
 * Base Formatter Helpers for Normalized Generated Document Record
 *
 * Provides reusable section builder functions shared across all document type formatters.
 *
 * @module get-generated-document-normalized-record/formatters/base-formatter
 */

import {
  GeneratedDocumentFullDetail,
  MeetingParticipantDetail,
  LinkedFeature,
  RelatedDocument
} from '../types.ts';

/**
 * Formats a date string to pt-BR locale format (dd/MM/yyyy HH:mm)
 */
export function formatDatePtBR(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '-';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '-';
  }
}

/**
 * Formats a date string to short pt-BR format (dd/MM/yyyy)
 */
export function formatDateShort(dateString: string | null): string {
  if (!dateString) {
    return '-';
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '-';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

/**
 * Safely gets a string value or returns a default
 */
function safeString(value: string | null | undefined, defaultValue = '-'): string {
  return value?.trim() || defaultValue;
}

/**
 * Maps document_type codes to human-readable labels
 */
function getTypeLabel(documentType: string | null): string {
  const labels: Record<string, string> = {
    'prd': 'PRD',
    'user-story': 'User Story',
    'user_story': 'User Story',
    'meeting-notes': 'Ata de Reuniao',
    'meeting_notes': 'Ata de Reuniao',
    'technical-specs': 'Especificacao Tecnica',
    'technical_specs': 'Especificacao Tecnica',
    'test-cases': 'Casos de Teste',
    'test_cases': 'Casos de Teste',
    'unit-tests': 'Testes Unitarios',
    'unit_tests': 'Testes Unitarios',
    'accessibility-test-result': 'Resultado de Teste de Acessibilidade',
    'accessibility_test_result': 'Resultado de Teste de Acessibilidade',
    'performance-test-result': 'Resultado de Teste de Performance',
    'performance_test_result': 'Resultado de Teste de Performance',
    'tasks': 'Sugestoes de Tarefas (IA)',
    'product-backlog-items': 'Sugestoes de Backlog (IA)',
    'product_backlog_items': 'Sugestoes de Backlog (IA)',
    'features': 'Sugestoes de Features (IA)'
  };
  return labels[documentType ?? ''] ?? (documentType ?? 'Documento');
}

/**
 * Formats the document title with type label
 *
 * Format: # [TIPO_LABEL] nome
 */
export function formatTitle(doc: GeneratedDocumentFullDetail): string {
  const typeLabel = getTypeLabel(doc.document_type);
  const name = safeString(doc.document_name, 'Sem titulo');
  return `# [${typeLabel}] ${name}`;
}

/**
 * Formats the main metadata table
 *
 * Includes: Status, Versao, Formato, Criado em, Atualizado em
 */
export function formatMetadataTable(doc: GeneratedDocumentFullDetail): string {
  return `Criado em ${formatDatePtBR(doc.created_at)} / Atualizado em ${formatDatePtBR(doc.updated_at)}`;
}

/**
 * Formats the quality metrics section
 *
 * Returns empty string if all quality fields are null.
 */
export function formatQualitySection(doc: GeneratedDocumentFullDetail): string {
  const hasQuality =
    doc.word_count !== null ||
    doc.section_count !== null ||
    doc.estimated_reading_time !== null ||
    doc.quality_score !== null;

  if (!hasQuality) {
    return '';
  }

  const wordCount = doc.word_count ?? '-';
  const sectionCount = doc.section_count ?? '-';
  const readingTime =
    doc.estimated_reading_time !== null ? `${doc.estimated_reading_time} min` : '-';
  const qualityScore =
    doc.quality_score !== null ? `${doc.quality_score}` : '-';

  return `## Qualidade
| Palavras | Secoes | Tempo de Leitura | Score de Qualidade |
|----------|--------|------------------|--------------------|
| ${wordCount} | ${sectionCount} | ${readingTime} | ${qualityScore} |`;
}

/**
 * Formats the approval workflow section
 *
 * Returns empty string if document has never been submitted for approval.
 */
export function formatApprovalSection(doc: GeneratedDocumentFullDetail): string {
  if (!doc.submitted_for_approval_at) {
    return '';
  }

  const rows: string[] = [
    `| Submetido por | ${safeString(doc.submitted_by)} |`,
    `| Submetido em | ${formatDatePtBR(doc.submitted_for_approval_at)} |`
  ];

  if (doc.approved_at) {
    rows.push(`| Aprovado por | ${safeString(doc.approved_by)} |`);
    rows.push(`| Aprovado em | ${formatDatePtBR(doc.approved_at)} |`);
  }

  if (doc.rejected_at) {
    rows.push(`| Rejeitado por | ${safeString(doc.rejected_by)} |`);
    rows.push(`| Rejeitado em | ${formatDatePtBR(doc.rejected_at)} |`);
    if (doc.rejection_reason) {
      rows.push(`| Motivo | ${doc.rejection_reason.trim()} |`);
    }
  }

  if (doc.approval_notes) {
    rows.push(`| Notas | ${doc.approval_notes.trim()} |`);
  }

  return `## Aprovacao
| Campo | Valor |
|-------|-------|
${rows.join('\n')}`;
}

/**
 * Formats the meeting context section
 *
 * Returns empty string if document has no meeting_transcript_id.
 */
export function formatMeetingContext(
  doc: GeneratedDocumentFullDetail,
  participants: MeetingParticipantDetail[]
): string {
  if (!doc.meeting_transcript_id) {
    return '';
  }

  const title = safeString(doc.meeting_title, 'Sem titulo');
  const date = formatDateShort(doc.meeting_date);

  const lines: string[] = [
    `## Reuniao de Origem`,
    `**${title}** — ${date}`
  ];

  if (participants.length > 0) {
    lines.push('');
    lines.push('**Participantes:**');
    for (const p of participants) {
      const name = p.member_name || p.external_email || 'Participante';
      lines.push(`- ${name} (${p.participant_type})`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats the sprint context section
 *
 * Returns empty string if document has no sprint_id.
 */
export function formatSprintContext(doc: GeneratedDocumentFullDetail): string {
  if (!doc.sprint_id) {
    return '';
  }

  const sprintName = safeString(doc.sprint_name);
  const startDate = formatDateShort(doc.sprint_start_date);
  const endDate = formatDateShort(doc.sprint_end_date);
  const period = `${startDate} - ${endDate}`;
  const status = safeString(doc.sprint_status);

  return `## Sprint
| Campo | Valor |
|-------|-------|
| Nome | ${sprintName} |
| Periodo | ${period} |
| Status | ${status} |`;
}

/**
 * Formats the linked features section
 *
 * Returns empty string if features array is empty.
 */
export function formatLinkedFeatures(features: LinkedFeature[]): string {
  if (features.length === 0) {
    return '';
  }

  const items = features.map(
    (f) => `- ${f.feature_title} (${f.feature_status}, ${f.feature_priority})`
  );

  return `## Features Vinculadas
${items.join('\n')}`;
}

/**
 * Formats the related documents section
 *
 * Returns empty string if docs array is empty.
 */
export function formatRelatedDocuments(docs: RelatedDocument[]): string {
  if (docs.length === 0) {
    return '';
  }

  const items = docs.map((d) => {
    const name = safeString(d.document_name, 'Sem titulo');
    const type = getTypeLabel(d.document_type);
    return `- ${name} (${type}) — ${d.status}`;
  });

  return `## Documentos Relacionados
${items.join('\n')}`;
}

/**
 * Formats the document content section
 *
 * Always present — wraps doc.content under a heading.
 */
export function formatContent(doc: GeneratedDocumentFullDetail): string {
  return `## Conteudo\n\n${doc.content}`;
}
