/**
 * Markdown Formatter for Normalized Backlog Item Record
 *
 * Formats backlog item data into a structured Markdown document following the template
 * defined in docs/backlog-normalized-record.md
 *
 * @module get-backlog-normalized-record/markdown-formatter
 */

import {
  NormalizedBacklogItemData,
  BacklogItemFullDetail,
  BacklogItemFeature,
  BacklogItemTask
} from './types.ts';

/**
 * Formats a date string to pt-BR locale format (dd/MM/yyyy HH:mm)
 */
function formatDatePtBR(dateString: string | null): string {
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
 * Safely gets a string value or returns a default
 */
function safeString(value: string | null | undefined, defaultValue = '-'): string {
  return value?.trim() || defaultValue;
}

/**
 * Formats the backlog item title
 */
function formatTitle(backlogItem: BacklogItemFullDetail): string {
  return `# ${backlogItem.title}`;
}

/**
 * Formats the main info table
 */
function formatInfoTable(backlogItem: BacklogItemFullDetail): string {
  const createdInfo = backlogItem.created_by
    ? `${formatDatePtBR(backlogItem.created_at)} por ${backlogItem.created_by}`
    : formatDatePtBR(backlogItem.created_at);

  const businessValue = backlogItem.business_value !== null
    ? `${backlogItem.business_value}/10`
    : '-';

  const technicalComplexity = backlogItem.technical_complexity !== null
    ? `${backlogItem.technical_complexity}/10`
    : '-';

  return `| Campo | Valor |
|-------|-------|
| Status | ${safeString(backlogItem.status)} |
| Prioridade | ${safeString(backlogItem.priority)} |
| Story Points | ${backlogItem.story_points || 0} |
| Valor de Negócio | ${businessValue} |
| Complexidade Técnica | ${technicalComplexity} |
| Posição | ${backlogItem.position} |
| Criado em | ${createdInfo} |
| Atualizado em | ${formatDatePtBR(backlogItem.updated_at)} |`;
}

/**
 * Formats the description section
 */
function formatDescription(backlogItem: BacklogItemFullDetail): string {
  const description = backlogItem.description?.trim() || 'Sem descrição.';
  return `## Descrição
${description}`;
}

/**
 * Formats the acceptance criteria section
 */
function formatAcceptanceCriteria(backlogItem: BacklogItemFullDetail): string {
  const criteria = backlogItem.acceptance_criteria;
  if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
    return '';
  }

  const items = criteria.map((item) => {
    if (typeof item === 'string') {
      return `- [ ] ${item}`;
    }
    if (typeof item === 'object' && item !== null) {
      const itemObj = item as Record<string, unknown>;
      const text = itemObj.text || itemObj.description || itemObj.criteria || JSON.stringify(item);
      const completed = itemObj.completed || itemObj.done || false;
      const checkbox = completed ? '[x]' : '[ ]';
      return `- ${checkbox} ${text}`;
    }
    return `- [ ] ${JSON.stringify(item)}`;
  });

  return `### Critérios de Aceite
${items.join('\n')}`;
}

/**
 * Formats the tags section (returns empty if no tags)
 */
function formatTags(backlogItem: BacklogItemFullDetail): string {
  const tags = backlogItem.tags;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return `### Tags
${tags.join(', ')}`;
}

/**
 * Formats a single feature row for the features table
 */
function formatFeatureRow(feature: BacklogItemFeature): string {
  const progress = `${feature.progress_percentage || 0}%`;
  const storyPoints = feature.story_points !== null ? feature.story_points.toString() : '-';

  return `| ${safeString(feature.status)} | ${safeString(feature.title)} | ${safeString(feature.priority)} | ${storyPoints} | ${progress} |`;
}

/**
 * Formats the features section
 */
function formatFeatures(features: BacklogItemFeature[], featuresCount: number): string {
  if (features.length === 0 || featuresCount === 0) {
    return '';
  }

  const header = `## Features (${featuresCount})
| Status | Título | Prioridade | SP | Progresso |
|--------|--------|------------|----|-----------|`;

  const rows = features.map(formatFeatureRow);

  return `${header}
${rows.join('\n')}`;
}

/**
 * Formats the task summary section
 */
function formatTaskSummary(backlogItem: BacklogItemFullDetail): string {
  if (backlogItem.tasks_count === 0) {
    return '';
  }

  const progress = backlogItem.tasks_count > 0
    ? Math.round((backlogItem.tasks_done_count / backlogItem.tasks_count) * 100)
    : 0;

  return `## Resumo de Tarefas
| Métrica | Valor |
|---------|-------|
| Total de Tarefas | ${backlogItem.tasks_count} |
| Tarefas Concluídas | ${backlogItem.tasks_done_count} |
| Story Points Total | ${backlogItem.tasks_total_points} |
| Story Points Concluídos | ${backlogItem.tasks_done_points} |
| Progresso Geral | ${progress}% |`;
}

/**
 * Formats the tasks by status section
 */
function formatTasksByStatus(backlogItem: BacklogItemFullDetail): string {
  if (backlogItem.tasks_count === 0) {
    return '';
  }

  return `## Tarefas por Status
| Status | Quantidade |
|--------|------------|
| done | ${backlogItem.tasks_done_count} |
| in_progress | ${backlogItem.tasks_in_progress_count} |
| todo | ${backlogItem.tasks_todo_count} |
| blocked | ${backlogItem.tasks_blocked_count} |`;
}

/**
 * Formats a single task row for the tasks table
 */
function formatTaskRow(task: BacklogItemTask): string {
  const assignee = safeString(task.assignee_name, '-');
  const storyPoints = task.story_points !== null ? task.story_points.toString() : '-';

  return `| ${safeString(task.status)} | ${safeString(task.title)} | ${safeString(task.task_type)} | ${assignee} | ${storyPoints} | ${safeString(task.feature_title)} |`;
}

/**
 * Formats the detailed tasks section
 */
function formatTasks(tasks: BacklogItemTask[]): string {
  if (tasks.length === 0) {
    return '';
  }

  const header = `## Tarefas Detalhadas (${tasks.length})
| Status | Título | Tipo | Responsável | SP | Feature |
|--------|--------|------|-------------|----|---------|`;

  const rows = tasks.map(formatTaskRow);

  return `${header}
${rows.join('\n')}`;
}

/**
 * Formats the complete normalized backlog item record as Markdown
 */
export function formatBacklogItemAsMarkdown(data: NormalizedBacklogItemData): string {
  const { backlogItem, features, tasks } = data;

  const sections: string[] = [];

  // Title
  sections.push(formatTitle(backlogItem));

  // Main info table
  sections.push(formatInfoTable(backlogItem));

  // Description
  sections.push(formatDescription(backlogItem));

  // Acceptance Criteria (only if has criteria)
  const criteriaSection = formatAcceptanceCriteria(backlogItem);
  if (criteriaSection) {
    sections.push(criteriaSection);
  }

  // Tags (only if has tags)
  const tagsSection = formatTags(backlogItem);
  if (tagsSection) {
    sections.push(tagsSection);
  }

  // Features (only if has features)
  const featuresSection = formatFeatures(features, backlogItem.features_count);
  if (featuresSection) {
    sections.push(featuresSection);
  }

  // Task Summary (only if has tasks)
  const taskSummarySection = formatTaskSummary(backlogItem);
  if (taskSummarySection) {
    sections.push(taskSummarySection);
  }

  // Tasks by Status (only if has tasks)
  const tasksByStatusSection = formatTasksByStatus(backlogItem);
  if (tasksByStatusSection) {
    sections.push(tasksByStatusSection);
  }

  // Detailed Tasks (only if has tasks)
  const tasksSection = formatTasks(tasks);
  if (tasksSection) {
    sections.push(tasksSection);
  }

  return sections.join('\n\n');
}
