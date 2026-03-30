/**
 * Markdown Formatter for Normalized Feature Record
 *
 * Formats feature data into a structured Markdown document following the template
 * defined in docs/feature-normalized-record.md
 *
 * @module get-feature-normalized-record/markdown-formatter
 */

import {
  NormalizedFeatureData,
  FeatureFullDetail,
  FeatureTask,
  FeatureSprintDetail,
  FeatureMeetingDetail,
  FeatureDocumentDetail,
  FeatureAttachmentDetail
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
 * Formats the feature title
 */
function formatTitle(feature: FeatureFullDetail): string {
  return `# ${feature.title}`;
}

/**
 * Formats the epic context header (bold text under title)
 */
function formatEpicHeader(feature: FeatureFullDetail): string {
  if (!feature.epic_title) {
    return '';
  }
  return `**[${feature.epic_title}]**`;
}

/**
 * Formats the main info table
 */
function formatInfoTable(feature: FeatureFullDetail): string {
  const createdInfo = feature.created_by
    ? `${formatDatePtBR(feature.created_at)} por ${feature.created_by}`
    : formatDatePtBR(feature.created_at);

  return `| Campo | Valor |
|-------|-------|
| Status | ${safeString(feature.status)} |
| Prioridade | ${safeString(feature.priority)} |
| Story Points | ${feature.story_points ?? 0} |
| Horas Estimadas | ${feature.estimated_hours ?? 0} |
| Posição | ${feature.position ?? 0} |
| Criado em | ${createdInfo} |
| Atualizado em | ${formatDatePtBR(feature.updated_at)} |`;
}

/**
 * Formats the description section
 */
function formatDescription(feature: FeatureFullDetail): string {
  const description = feature.description?.trim() || 'Sem descrição.';
  return `## Descrição
${description}`;
}

/**
 * Formats the delivered value section (returns empty if no value)
 */
function formatDeliveredValue(feature: FeatureFullDetail): string {
  if (!feature.delivered_value?.trim()) {
    return '';
  }
  return `## Valor Entregue
${feature.delivered_value.trim()}`;
}

/**
 * Formats the ready criteria section as checkboxes
 */
function formatReadyCriteria(feature: FeatureFullDetail): string {
  const criteria = feature.ready_criteria;

  if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
    return '';
  }

  const items = criteria.map((item) => {
    if (typeof item === 'string') {
      return `- [ ] ${item}`;
    }
    if (typeof item === 'object' && item !== null) {
      const itemObj = item as Record<string, unknown>;
      const checked = itemObj.done || itemObj.completed ? '[x]' : '[ ]';
      const text = itemObj.text || itemObj.title || itemObj.description || JSON.stringify(item);
      return `- ${checked} ${text}`;
    }
    return `- [ ] ${JSON.stringify(item)}`;
  });

  return `## Critérios de Aceite
${items.join('\n')}`;
}

/**
 * Formats the dependencies section
 */
function formatDependencies(feature: FeatureFullDetail): string {
  const deps = feature.dependencies;

  if (!deps || !Array.isArray(deps) || deps.length === 0) {
    return '';
  }

  const items = deps.map((dep) => {
    if (typeof dep === 'string') {
      return `- ${dep}`;
    }
    if (typeof dep === 'object' && dep !== null) {
      const depObj = dep as Record<string, unknown>;
      return `- ${depObj.title || depObj.name || depObj.description || JSON.stringify(dep)}`;
    }
    return `- ${JSON.stringify(dep)}`;
  });

  return `## Dependências
${items.join('\n')}`;
}

/**
 * Formats the tags section (returns empty if no tags)
 */
function formatTags(feature: FeatureFullDetail): string {
  const tags = feature.tags;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return `### Tags
${tags.join(', ')}`;
}

/**
 * Formats the notes section (returns empty if no notes)
 */
function formatNotes(feature: FeatureFullDetail): string {
  if (!feature.notes?.trim()) {
    return '';
  }
  return `### Notas
${feature.notes.trim()}`;
}

/**
 * Formats a single task row for the tasks table
 */
function formatTaskRow(task: FeatureTask): string {
  const assignee = safeString(task.assignee_name);
  const sp = task.story_points ?? 0;
  return `| ${task.status} | ${task.title} | ${task.task_type} | ${assignee} | ${sp} |`;
}

/**
 * Formats the tasks section
 */
function formatTasks(tasks: FeatureTask[], count: number): string {
  if (tasks.length === 0 || count === 0) {
    return '';
  }

  const rows = tasks.map(formatTaskRow);
  return `## Tarefas (${count})
| Status | Título | Tipo | Responsável | SP |
|--------|--------|------|-------------|----|
${rows.join('\n')}`;
}

/**
 * Formats a single sprint line
 */
function formatSprintLine(sprint: FeatureSprintDetail): string {
  const startDate = formatDateShort(sprint.sprint_start_date);
  const endDate = formatDateShort(sprint.sprint_end_date);
  return `- ${sprint.sprint_name} (${startDate} - ${endDate}) - ${sprint.sprint_status}`;
}

/**
 * Formats the sprints section
 */
function formatSprints(sprints: FeatureSprintDetail[], count: number): string {
  if (sprints.length === 0 || count === 0) {
    return '';
  }

  const items = sprints.map(formatSprintLine);
  return `## Sprints Associadas (${count})
${items.join('\n')}`;
}

/**
 * Formats a single meeting line
 */
function formatMeetingLine(meeting: FeatureMeetingDetail): string {
  const date = formatDateShort(meeting.meeting_date);
  const title = safeString(meeting.meeting_title, 'Sem título');
  return `- ${date} - ${title}`;
}

/**
 * Formats the meetings section
 */
function formatMeetings(meetings: FeatureMeetingDetail[], count: number): string {
  if (meetings.length === 0 || count === 0) {
    return '';
  }

  const items = meetings.map(formatMeetingLine);
  return `## Reuniões Relacionadas (${count})
${items.join('\n')}`;
}

/**
 * Formats a single document line
 */
function formatDocumentLine(doc: FeatureDocumentDetail): string {
  const title = safeString(doc.document_title, 'Sem título');
  const type = doc.document_type === 'generated' ? 'generated' : 'project';
  return `- ${title} (${type})`;
}

/**
 * Formats the documents section
 */
function formatDocuments(documents: FeatureDocumentDetail[], count: number): string {
  if (documents.length === 0 || count === 0) {
    return '';
  }

  const items = documents.map(formatDocumentLine);
  return `## Documentos (${count})
${items.join('\n')}`;
}

/**
 * Formats a single attachment line
 */
function formatAttachmentLine(attachment: FeatureAttachmentDetail): string {
  const uploader = safeString(attachment.uploaded_by_name, 'Desconhecido');
  const size = attachment.file_size_formatted || '-';
  return `- ${attachment.file_name} (${size}) - ${uploader}`;
}

/**
 * Formats the attachments section
 */
function formatAttachments(attachments: FeatureAttachmentDetail[], count: number): string {
  if (attachments.length === 0 || count === 0) {
    return '';
  }

  const items = attachments.map(formatAttachmentLine);
  return `## Anexos (${count})
${items.join('\n')}`;
}

/**
 * Formats the epic context section
 */
function formatEpicContext(feature: FeatureFullDetail): string {
  if (!feature.epic_id || !feature.epic_title) {
    return '';
  }

  const sections: string[] = [];

  // Title
  sections.push(`## Contexto do Epic`);
  sections.push(`**${feature.epic_title}**`);

  // Description
  if (feature.epic_description?.trim()) {
    sections.push('');
    sections.push(feature.epic_description.trim());
  } else {
    sections.push('');
    sections.push('Sem descrição.');
  }

  // Acceptance criteria
  const criteria = feature.epic_acceptance_criteria;
  if (criteria && Array.isArray(criteria) && criteria.length > 0) {
    sections.push('');
    sections.push('Critérios de Aceite:');
    criteria.forEach((item) => {
      if (typeof item === 'string') {
        sections.push(`- [ ] ${item}`);
      } else if (typeof item === 'object' && item !== null) {
        const itemObj = item as Record<string, unknown>;
        const completed = itemObj.completed === true;
        const checkbox = completed ? '[x]' : '[ ]';
        const text = itemObj.description || itemObj.text || itemObj.title || JSON.stringify(item);
        sections.push(`- ${checkbox} ${text}`);
      }
    });
  }

  return sections.join('\n');
}

/**
 * Formats the complete normalized feature record as Markdown
 */
export function formatFeatureAsMarkdown(data: NormalizedFeatureData): string {
  const { feature, tasks, sprints, meetings, documents, attachments } = data;

  const sections: string[] = [];

  // Title
  sections.push(formatTitle(feature));

  // Epic header
  const epicHeader = formatEpicHeader(feature);
  if (epicHeader) {
    sections.push(epicHeader);
  }

  // Main info table
  sections.push(formatInfoTable(feature));

  // Description
  sections.push(formatDescription(feature));

  // Delivered Value (only if present)
  const deliveredValueSection = formatDeliveredValue(feature);
  if (deliveredValueSection) {
    sections.push(deliveredValueSection);
  }

  // Ready Criteria (only if present)
  const criteriaSection = formatReadyCriteria(feature);
  if (criteriaSection) {
    sections.push(criteriaSection);
  }

  // Dependencies (only if present)
  const depsSection = formatDependencies(feature);
  if (depsSection) {
    sections.push(depsSection);
  }

  // Tags (only if has tags)
  const tagsSection = formatTags(feature);
  if (tagsSection) {
    sections.push(tagsSection);
  }

  // Notes (only if has notes)
  const notesSection = formatNotes(feature);
  if (notesSection) {
    sections.push(notesSection);
  }

  // Tasks (only if has tasks)
  const tasksSection = formatTasks(tasks, feature.tasks_count);
  if (tasksSection) {
    sections.push(tasksSection);
  }

  // Sprints (only if has sprints)
  const sprintsSection = formatSprints(sprints, feature.sprints_count);
  if (sprintsSection) {
    sections.push(sprintsSection);
  }

  // Meetings (only if has meetings)
  const meetingsSection = formatMeetings(meetings, feature.meetings_count);
  if (meetingsSection) {
    sections.push(meetingsSection);
  }

  // Documents (only if has documents)
  const documentsSection = formatDocuments(documents, feature.documents_count);
  if (documentsSection) {
    sections.push(documentsSection);
  }

  // Attachments (only if has attachments)
  const attachmentsSection = formatAttachments(attachments, feature.attachments_count);
  if (attachmentsSection) {
    sections.push(attachmentsSection);
  }

  // Epic Context (at the end)
  const epicContextSection = formatEpicContext(feature);
  if (epicContextSection) {
    sections.push(epicContextSection);
  }

  return sections.join('\n\n');
}
