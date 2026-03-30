/**
 * Markdown Formatter for Normalized Meeting Record
 *
 * Formats meeting data into a structured Markdown document including
 * transcript, participants, sprint context, and metadata.
 *
 * @module get-meeting-normalized-record/markdown-formatter
 */

import {
  NormalizedMeetingData,
  MeetingTranscriptDetail,
  MeetingDetail,
  MeetingParticipant,
  SprintDetail
} from './types.ts';

/**
 * Parses a date string and returns its components, or null if invalid.
 */
function parseDateComponents(dateString: string | null): {
  day: string;
  month: string;
  year: number;
  hours: string;
  minutes: string;
} | null {
  if (!dateString) {
    return null;
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }

    return {
      day: date.getDate().toString().padStart(2, '0'),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      year: date.getFullYear(),
      hours: date.getHours().toString().padStart(2, '0'),
      minutes: date.getMinutes().toString().padStart(2, '0'),
    };
  } catch {
    return null;
  }
}

/**
 * Formats a date string to pt-BR locale format (dd/MM/yyyy HH:mm)
 */
function formatDatePtBR(dateString: string | null): string {
  const parts = parseDateComponents(dateString);
  if (!parts) {
    return '-';
  }
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hours}:${parts.minutes}`;
}

/**
 * Formats a date string to short pt-BR format (dd/MM/yyyy)
 */
function formatDateShort(dateString: string | null): string {
  const parts = parseDateComponents(dateString);
  if (!parts) {
    return '-';
  }
  return `${parts.day}/${parts.month}/${parts.year}`;
}

/**
 * Formats a time string (HH:mm:ss or HH:mm) to short format (HH:mm)
 */
function formatTime(timeString: string | null): string {
  if (!timeString) {
    return '-';
  }

  // If it's already in HH:mm format or HH:mm:ss, extract HH:mm
  const parts = timeString.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }

  return timeString;
}

/**
 * Safely gets a string value or returns a default
 */
function safeString(value: string | null | undefined, defaultValue = '-'): string {
  return value?.trim() || defaultValue;
}

/**
 * Formats the meeting title
 */
function formatTitle(data: NormalizedMeetingData): string {
  const title = data.transcript.title || data.meeting?.title || 'Reunião sem título';
  return `# ${title}`;
}

/**
 * Formats the main info table combining transcript and meeting data
 */
function formatInfoTable(data: NormalizedMeetingData): string {
  const { transcript, meeting } = data;

  const meetingDate = formatDateShort(meeting?.meeting_date || transcript.meeting_date);

  const rows: string[] = [
    '| Campo | Valor |',
    '|-------|-------|',
    `| Data | ${meetingDate} |`
  ];

  // Schedule (start_time - end_time) from meetings table
  if (meeting?.start_time || meeting?.end_time) {
    const startTime = formatTime(meeting.start_time);
    const endTime = formatTime(meeting.end_time);
    rows.push(`| Horário | ${startTime} - ${endTime} |`);
  }

  // Meeting type
  if (meeting?.meeting_type) {
    rows.push(`| Tipo | ${safeString(meeting.meeting_type)} |`);
  }

  // Meeting URL
  if (meeting?.meeting_url) {
    rows.push(`| URL | ${meeting.meeting_url} |`);
  }

  // Created by
  const createdBy = meeting?.created_by || transcript.created_by;
  if (createdBy) {
    rows.push(`| Criado por | ${createdBy} |`);
  }

  // Created at
  rows.push(`| Criado em | ${formatDatePtBR(transcript.created_at)} |`);

  return rows.join('\n');
}

/**
 * Formats the description section
 */
function formatDescription(data: NormalizedMeetingData): string {
  const description = data.transcript.description?.trim() || data.meeting?.description?.trim() || 'Sem descrição.';
  return `## Descrição
${description}`;
}

/**
 * Formats the participants section (returns empty if no participants)
 */
function formatParticipants(participants: MeetingParticipant[]): string {
  if (!participants || participants.length === 0) {
    return '';
  }

  const items = participants.map((p) => {
    const name = p.member_name || p.external_email || 'Participante desconhecido';
    const type = p.participant_type ? ` (${p.participant_type})` : '';
    return `- ${name}${type}`;
  });

  return `## Participantes (${participants.length})
${items.join('\n')}`;
}

/**
 * Formats the sprint section (returns empty if no sprint)
 */
function formatSprint(sprint: SprintDetail | null): string {
  if (!sprint) {
    return '';
  }

  const startDate = formatDateShort(sprint.start_date);
  const endDate = formatDateShort(sprint.end_date);

  return `## Sprint
| Campo | Valor |
|-------|-------|
| Nome | ${safeString(sprint.name)} |
| Período | ${startDate} - ${endDate} |
| Status | ${safeString(sprint.status)} |`;
}

/**
 * Formats the tags section (returns empty if no tags)
 */
function formatTags(transcript: MeetingTranscriptDetail): string {
  const tags = transcript.tags;
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return `## Tags
${tags.join(', ')}`;
}

/**
 * Formats the transcript text section (full text, no truncation)
 */
function formatTranscriptText(transcript: MeetingTranscriptDetail): string {
  const text = transcript.transcript_text?.trim();
  if (!text) {
    return `## Transcrição
Sem transcrição disponível.`;
  }

  return `## Transcrição
${text}`;
}

/**
 * Formats the complete normalized meeting record as Markdown
 */
export function formatMeetingAsMarkdown(data: NormalizedMeetingData): string {
  const sections: string[] = [];

  // Title
  sections.push(formatTitle(data));

  // Main info table
  sections.push(formatInfoTable(data));

  // Description
  sections.push(formatDescription(data));

  // Participants (only if present)
  const participantsSection = formatParticipants(data.participants);
  if (participantsSection) {
    sections.push(participantsSection);
  }

  // Sprint (only if present)
  const sprintSection = formatSprint(data.sprint);
  if (sprintSection) {
    sections.push(sprintSection);
  }

  // Tags (only if present)
  const tagsSection = formatTags(data.transcript);
  if (tagsSection) {
    sections.push(tagsSection);
  }

  // Transcript text (always included, full content)
  sections.push(formatTranscriptText(data.transcript));

  return sections.join('\n\n');
}
