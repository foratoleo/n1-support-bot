/**
 * Markdown Formatter for Normalized Task Record
 *
 * Formats task data into a structured Markdown document following the template
 * defined in docs/task-normalized-record.md
 *
 * @module get-task-normalized-record/markdown-formatter
 */

import {
  NormalizedTaskData,
  TaskFullDetail,
  TaskCommentDetail,
  TaskAttachmentDetail,
  TaskSubtask
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
 * Formats a date string to short pt-BR format (dd/MM/yyyy)
 */
function formatDateShort(dateString: string | null): string {
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
 * Formats the task title with optional JIRA key
 */
function formatTitle(task: TaskFullDetail): string {
  const jiraKey = task.jira_issue_key ? `[${task.jira_issue_key}] ` : '';
  return `# ${jiraKey}${task.title}`;
}

/**
 * Formats the hierarchy path (Epic > Feature)
 */
function formatHierarchy(task: TaskFullDetail): string {
  if (!task.hierarchy_path) {
    return '';
  }
  return `**${task.hierarchy_path}**`;
}

/**
 * Formats the sprint info for the table
 */
function formatSprintInfo(task: TaskFullDetail): string {
  if (!task.sprint_name) {
    return '-';
  }

  const startDate = formatDateShort(task.sprint_start_date);
  const endDate = formatDateShort(task.sprint_end_date);

  return `${task.sprint_name} (${startDate} - ${endDate})`;
}

/**
 * Formats the overdue badge if applicable
 */
function formatOverdueBadge(task: TaskFullDetail): string {
  if (task.is_overdue) {
    return ' `[ATRASADA]`';
  }
  return '';
}

/**
 * Formats the main info table
 */
function formatInfoTable(task: TaskFullDetail): string {
  const createdInfo = task.created_by
    ? `${formatDatePtBR(task.created_at)} por ${task.created_by}`
    : formatDatePtBR(task.created_at);

  const statusWithBadge = `${safeString(task.status)}${formatOverdueBadge(task)}`;

  return `| Campo | Valor |
|-------|-------|
| Sprint | ${formatSprintInfo(task)} |
| Status | ${statusWithBadge} |
| Prioridade | ${safeString(task.priority)} |
| Tipo | ${safeString(task.task_type)} |
| Responsável | ${safeString(task.assignee_name)} |
| Criado em | ${createdInfo} |
| Atualizado em | ${formatDatePtBR(task.updated_at)} |`;
}

/**
 * Formats the description section
 */
function formatDescription(task: TaskFullDetail): string {
  const description = task.description?.trim() || 'Sem descrição.';
  return `## Descrição
${description}`;
}

/**
 * Formats the estimates table
 */
function formatEstimates(task: TaskFullDetail): string {
  const storyPoints = task.story_points || 0;
  const estimatedHours = task.estimated_hours || 0;
  const actualHours = task.actual_hours || 0;
  const progress = task.progress_percentage || 0;

  return `## Estimativas
| Story Points | Horas Estimadas | Horas Realizadas | Progresso |
|--------------|-----------------|------------------|-----------|
| ${storyPoints} | ${estimatedHours} | ${actualHours} | ${progress}% |`;
}

/**
 * Formats the tags section (returns empty if no tags)
 */
function formatTags(task: TaskFullDetail): string {
  const tags = task.tags;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return `### Tags
${tags.join(', ')}`;
}

/**
 * Formats the component area section (returns empty if not set)
 */
function formatComponentArea(task: TaskFullDetail): string {
  if (!task.component_area?.trim()) {
    return '';
  }
  return `### Área do Componente
${task.component_area.trim()}`;
}

/**
 * Formats the dependencies section (returns empty if no dependencies)
 */
function formatDependencies(task: TaskFullDetail): string {
  const rawDeps = task.dependencies;

  // Handle null, undefined, or non-array values
  if (!rawDeps || !Array.isArray(rawDeps) || rawDeps.length === 0) {
    return '';
  }

  const items = rawDeps.map((dep) => {
    if (typeof dep === 'string') {
      return `- ${dep}`;
    }
    if (typeof dep === 'object' && dep !== null) {
      const depObj = dep as Record<string, unknown>;
      return `- ${depObj.title || depObj.name || JSON.stringify(dep)}`;
    }
    return `- ${JSON.stringify(dep)}`;
  });

  return `### Dependências
${items.join('\n')}`;
}

/**
 * Formats a single subtask line
 */
function formatSubtaskLine(subtask: TaskSubtask): string {
  const isDone = subtask.status === 'done';
  const checkbox = isDone ? '[x]' : '[ ]';
  return `- ${checkbox} ${subtask.title} - ${subtask.status}`;
}

/**
 * Formats the subtasks section (returns empty if no subtasks)
 */
function formatSubtasks(subtasks: TaskSubtask[], count: number): string {
  if (subtasks.length === 0 || count === 0) {
    return '';
  }

  const items = subtasks.map(formatSubtaskLine);
  return `## Subtarefas (${count})
${items.join('\n')}`;
}

/**
 * Formats a single comment block
 */
function formatComment(comment: TaskCommentDetail): string {
  const date = formatDatePtBR(comment.created_at);
  const author = safeString(comment.author_name, 'Anônimo');
  return `### ${date} - ${author}
${comment.content}`;
}

/**
 * Formats the comments section (returns empty if no comments)
 */
function formatComments(comments: TaskCommentDetail[], count: number): string {
  if (comments.length === 0 || count === 0) {
    return '';
  }

  const items = comments.map(formatComment);
  return `## Comentários (${count})
${items.join('\n\n---\n\n')}`;
}

/**
 * Formats a single attachment line
 */
function formatAttachmentLine(attachment: TaskAttachmentDetail): string {
  const uploader = safeString(attachment.uploader_name, 'Desconhecido');
  return `- ${attachment.file_name} (${attachment.file_size_formatted}) - ${uploader}`;
}

/**
 * Formats the attachments section (returns empty if no attachments)
 */
function formatAttachments(attachments: TaskAttachmentDetail[], count: number): string {
  if (attachments.length === 0 || count === 0) {
    return '';
  }

  const items = attachments.map(formatAttachmentLine);
  return `## Anexos (${count})
${items.join('\n')}`;
}

/**
 * Formats the JIRA metadata section
 */
function formatJiraMetadata(task: TaskFullDetail): string {
  // Only show JIRA section if there's relevant JIRA data
  if (!task.jira_issue_key && !task.jira_sync_status) {
    return '';
  }

  return `## Metadados JIRA
| Campo | Valor |
|-------|-------|
| Issue Key | ${safeString(task.jira_issue_key)} |
| Sync Status | ${safeString(task.jira_sync_status)} |
| Last Synced | ${formatDatePtBR(task.jira_last_synced_at)} |`;
}

/**
 * Formats the feature context section
 * Shows only title and description for context
 */
function formatFeatureContext(task: TaskFullDetail): string {
  // Only show if there's feature data
  if (!task.feature_id || !task.feature_title) {
    return '';
  }

  const featureDescription = task.feature_description?.trim()
    ? `\n\n${task.feature_description.trim()}`
    : '\n\nSem descrição.';

  return `## Contexto da Feature
**${safeString(task.feature_title)}**${featureDescription}`;
}

/**
 * Formats the epic context section
 * Shows only title and description for context
 */
function formatEpicContext(task: TaskFullDetail): string {
  // Only show if there's epic data
  if (!task.epic_id || !task.epic_title) {
    return '';
  }

  const epicDescription = task.epic_description?.trim()
    ? `\n\n${task.epic_description.trim()}`
    : '\n\nSem descrição.';

  return `## Contexto do Epic
**${safeString(task.epic_title)}**${epicDescription}`;
}

/**
 * Formats the parent task section
 */
function formatParentTask(task: TaskFullDetail): string {
  // Only show if there's parent task data
  if (!task.parent_task_id || !task.parent_task_title) {
    return '';
  }

  return `## Tarefa Pai
| Campo | Valor |
|-------|-------|
| Título | ${safeString(task.parent_task_title)} |
| Status | ${safeString(task.parent_task_status)} |`;
}

/**
 * Formats the complete normalized task record as Markdown
 */
export function formatTaskAsMarkdown(data: NormalizedTaskData): string {
  const { task, comments, attachments, subtasks } = data;

  const sections: string[] = [];

  // Title
  sections.push(formatTitle(task));

  // Hierarchy (Epic > Feature)
  const hierarchy = formatHierarchy(task);
  if (hierarchy) {
    sections.push(hierarchy);
  }

  // Main info table
  sections.push(formatInfoTable(task));

  // Parent Task (if this is a subtask)
  const parentSection = formatParentTask(task);
  if (parentSection) {
    sections.push(parentSection);
  }

  // Description
  sections.push(formatDescription(task));

  // Estimates
  sections.push(formatEstimates(task));

  // Tags (only if has tags)
  const tagsSection = formatTags(task);
  if (tagsSection) {
    sections.push(tagsSection);
  }

  // Component Area (only if set)
  const componentSection = formatComponentArea(task);
  if (componentSection) {
    sections.push(componentSection);
  }

  // Dependencies (only if has dependencies)
  const depsSection = formatDependencies(task);
  if (depsSection) {
    sections.push(depsSection);
  }

  // Subtasks (only if has subtasks)
  const subtasksSection = formatSubtasks(subtasks, task.subtasks_count);
  if (subtasksSection) {
    sections.push(subtasksSection);
  }

  // Comments (only if has comments)
  const commentsSection = formatComments(comments, task.comments_count);
  if (commentsSection) {
    sections.push(commentsSection);
  }

  // Attachments (only if has attachments)
  const attachmentsSection = formatAttachments(attachments, task.attachments_count);
  if (attachmentsSection) {
    sections.push(attachmentsSection);
  }

  // JIRA Metadata (only if relevant)
  const jiraSection = formatJiraMetadata(task);
  if (jiraSection) {
    sections.push(jiraSection);
  }

  // Epic Context (moved to end, only title and description)
  const epicSection = formatEpicContext(task);
  if (epicSection) {
    sections.push(epicSection);
  }

  // Feature Context (moved to end, only title and description)
  const featureSection = formatFeatureContext(task);
  if (featureSection) {
    sections.push(featureSection);
  }

  return sections.join('\n\n');
}
