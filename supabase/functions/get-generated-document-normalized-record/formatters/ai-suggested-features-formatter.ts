/**
 * AI-Suggested Features Formatter for Normalized Generated Document Record
 *
 * Parses JSON content from AI-generated feature suggestions and formats
 * as readable Markdown for RAG indexing.
 *
 * @module get-generated-document-normalized-record/formatters/ai-suggested-features-formatter
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
  '> Este documento contem sugestoes de features geradas automaticamente pela IA. Os itens abaixo foram propostos com base na analise do conteudo fornecido e devem ser revisados antes da aprovacao.';

interface ReadyCriterion {
  id?: string;
  description?: string;
  completed?: boolean;
}

interface FeatureDependency {
  feature_id?: string;
  dependency_type?: string;
}

interface SuggestedFeature {
  title?: string;
  description?: string;
  priority?: string;
  delivered_value?: string;
  ready_criteria?: ReadyCriterion[];
  dependencies?: FeatureDependency[];
  notes?: string;
  story_points?: number | null;
  estimated_hours?: number | null;
  tags?: string[];
}

interface SuggestedFeaturesPayload {
  features?: SuggestedFeature[];
  summary?: string;
}

function formatReadyCriteria(criteria: ReadyCriterion[]): string {
  const items = criteria.map((rc) => {
    const checkbox = rc.completed ? '[x]' : '[ ]';
    return `- ${checkbox} ${rc.description || 'Sem descricao'}`;
  });
  return `**Criterios de Prontidao:**\n${items.join('\n')}`;
}

function formatSingleFeature(feature: SuggestedFeature, index: number): string {
  const lines: string[] = [];

  lines.push(`### ${index + 1}. ${feature.title || 'Sem titulo'}`);

  const meta: string[] = [];
  if (feature.priority) meta.push(`- **Prioridade**: ${feature.priority}`);

  const hasHours = feature.estimated_hours != null;
  const hasPoints = feature.story_points != null;
  if (hasHours || hasPoints) {
    const parts: string[] = [];
    if (hasHours) parts.push(`${feature.estimated_hours}h`);
    if (hasPoints) parts.push(`${feature.story_points} SP`);
    meta.push(`- **Estimativa**: ${parts.join(' / ')}`);
  }

  if (feature.tags?.length) meta.push(`- **Tags**: ${feature.tags.join(', ')}`);

  if (meta.length > 0) {
    lines.push(meta.join('\n'));
  }

  if (feature.description?.trim()) {
    lines.push('');
    lines.push(feature.description.trim());
  }

  if (feature.delivered_value?.trim()) {
    lines.push('');
    lines.push(`**Valor Entregue**: ${feature.delivered_value.trim()}`);
  }

  if (feature.ready_criteria?.length) {
    lines.push('');
    lines.push(formatReadyCriteria(feature.ready_criteria));
  }

  if (feature.notes?.trim()) {
    lines.push('');
    lines.push(`**Notas**: ${feature.notes.trim()}`);
  }

  return lines.join('\n');
}

export const aiSuggestedFeaturesFormatter: DocumentFormatter = {
  format(data: NormalizedGeneratedDocumentData): string {
    const { document, participants } = data;

    let payload: SuggestedFeaturesPayload;
    try {
      payload = JSON.parse(document.content);
    } catch {
      return defaultFormatter.format(data);
    }

    const features = payload.features;
    if (!Array.isArray(features)) {
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

    sections.push(`## Features Sugeridas (${features.length})`);

    const featureBlocks = features.map((f, i) => formatSingleFeature(f, i));
    sections.push(featureBlocks.join('\n\n---\n\n'));

    return sections.join('\n\n');
  }
};
