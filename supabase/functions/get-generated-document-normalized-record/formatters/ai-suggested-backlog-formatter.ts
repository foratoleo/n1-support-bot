/**
 * AI-Suggested Backlog Items Formatter for Normalized Generated Document Record
 *
 * Parses JSON content from AI-generated backlog item suggestions and formats
 * as readable Markdown for RAG indexing.
 *
 * @module get-generated-document-normalized-record/formatters/ai-suggested-backlog-formatter
 */

import {
  DocumentFormatter,
  NormalizedGeneratedDocumentData
} from '../types.ts';

import {
  formatTitle,
  formatMetadataTable,
  formatApprovalSection,
  formatMeetingContext,
  formatSprintContext
} from './base-formatter.ts';

import { defaultFormatter } from './default-formatter.ts';

const AI_SUGGESTION_BANNER =
  '> Este documento contem sugestoes de itens de backlog geradas automaticamente pela IA. Os itens abaixo foram propostos com base na analise do conteudo fornecido e devem ser revisados antes da aprovacao.';

interface AcceptanceCriterion {
  id?: string;
  description?: string;
  completed?: boolean;
}

interface SuggestedBacklogItem {
  title?: string;
  description?: string;
  priority?: string;
  story_points?: number;
  business_value?: number;
  technical_complexity?: number;
  tags?: string[];
  acceptance_criteria?: AcceptanceCriterion[];
}

interface SuggestedBacklogPayload {
  backlog_items?: SuggestedBacklogItem[];
}

function formatAcceptanceCriteria(criteria: AcceptanceCriterion[]): string {
  const items = criteria.map((ac) => {
    const checkbox = ac.completed ? '[x]' : '[ ]';
    return `- ${checkbox} ${ac.description || 'Sem descricao'}`;
  });
  return `**Criterios de Aceite:**\n${items.join('\n')}`;
}

function formatSingleBacklogItem(item: SuggestedBacklogItem, index: number): string {
  const lines: string[] = [];

  lines.push(`### ${index + 1}. ${item.title || 'Sem titulo'}`);

  const meta: string[] = [];
  if (item.priority) meta.push(`- **Prioridade**: ${item.priority}`);
  if (item.story_points != null) meta.push(`- **Story Points**: ${item.story_points}`);
  if (item.business_value != null) meta.push(`- **Valor de Negocio**: ${item.business_value}/10`);
  if (item.technical_complexity != null) meta.push(`- **Complexidade Tecnica**: ${item.technical_complexity}/10`);
  if (item.tags?.length) meta.push(`- **Tags**: ${item.tags.join(', ')}`);

  if (meta.length > 0) {
    lines.push(meta.join('\n'));
  }

  if (item.description?.trim()) {
    lines.push('');
    lines.push(item.description.trim());
  }

  if (item.acceptance_criteria?.length) {
    lines.push('');
    lines.push(formatAcceptanceCriteria(item.acceptance_criteria));
  }

  return lines.join('\n');
}

export const aiSuggestedBacklogFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants } = data;

    let payload: SuggestedBacklogPayload;
    try {
      payload = JSON.parse(document.content);
    } catch {
      return defaultFormatter.format(data);
    }

    const items = payload.backlog_items;
    if (!Array.isArray(items)) {
      return defaultFormatter.format(data);
    }

    const sections: string[] = [
      formatTitle(document),
      formatMetadataTable(document),
      AI_SUGGESTION_BANNER
    ];

    const approvalSection = formatApprovalSection(document);
    if (approvalSection) sections.push(approvalSection);

    const meetingSection = formatMeetingContext(document, participants);
    if (meetingSection) sections.push(meetingSection);

    const sprintSection = formatSprintContext(document);
    if (sprintSection) sections.push(sprintSection);

    sections.push(`## Itens de Backlog Sugeridos (${items.length})`);

    const itemBlocks = items.map((item, i) => formatSingleBacklogItem(item, i));
    sections.push(itemBlocks.join('\n\n---\n\n'));

    return sections.join('\n\n');
  }
};
