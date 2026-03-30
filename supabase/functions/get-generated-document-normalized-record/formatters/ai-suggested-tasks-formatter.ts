/**
 * AI-Suggested Tasks Formatter for Normalized Generated Document Record
 *
 * Parses JSON content from AI-generated task suggestions and formats
 * as readable Markdown for RAG indexing.
 *
 * @module get-generated-document-normalized-record/formatters/ai-suggested-tasks-formatter
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
  '> Este documento contem sugestoes de tarefas geradas automaticamente pela IA. Os itens abaixo foram propostos com base na analise do conteudo fornecido e devem ser revisados antes da aprovacao.';

interface SuggestedTask {
  title?: string;
  description?: string;
  task_type?: string;
  priority?: string;
  estimated_hours?: number;
  story_points?: number;
  component_area?: string;
  tags?: string[];
  dependencies?: string[];
}

interface SuggestedTasksPayload {
  tasks?: SuggestedTask[];
  summary?: string;
}

function formatSingleTask(task: SuggestedTask, index: number): string {
  const lines: string[] = [];

  lines.push(`### ${index + 1}. ${task.title || 'Sem titulo'}`);

  const meta: string[] = [];
  if (task.task_type) meta.push(`- **Tipo**: ${task.task_type}`);
  if (task.priority) meta.push(`- **Prioridade**: ${task.priority}`);

  const hasHours = task.estimated_hours != null;
  const hasPoints = task.story_points != null;
  if (hasHours || hasPoints) {
    const parts: string[] = [];
    if (hasHours) parts.push(`${task.estimated_hours}h`);
    if (hasPoints) parts.push(`${task.story_points} SP`);
    meta.push(`- **Estimativa**: ${parts.join(' / ')}`);
  }

  if (task.component_area) meta.push(`- **Area**: ${task.component_area}`);
  if (task.tags?.length) meta.push(`- **Tags**: ${task.tags.join(', ')}`);

  if (meta.length > 0) {
    lines.push(meta.join('\n'));
  }

  if (task.description?.trim()) {
    lines.push('');
    lines.push(task.description.trim());
  }

  if (task.dependencies?.length) {
    lines.push('');
    lines.push(`**Dependencias**: ${task.dependencies.join(', ')}`);
  }

  return lines.join('\n');
}

export const aiSuggestedTasksFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants } = data;

    let payload: SuggestedTasksPayload;
    try {
      payload = JSON.parse(document.content);
    } catch {
      return defaultFormatter.format(data);
    }

    const tasks = payload.tasks;
    if (!Array.isArray(tasks)) {
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

    if (payload.summary?.trim()) {
      sections.push(`## Resumo\n\n${payload.summary.trim()}`);
    }

    sections.push(`## Tarefas Sugeridas (${tasks.length})`);

    const taskBlocks = tasks.map((t, i) => formatSingleTask(t, i));
    sections.push(taskBlocks.join('\n\n---\n\n'));

    return sections.join('\n\n');
  }
};
