/**
 * Response Formatter for planning-assistant
 *
 * Formats combined RAG and data query results into natural language responses.
 *
 * @module planning-assistant/response-formatter
 */

import type {
  QueryIntent,
  RagChunk,
  DataQueryResult,
  ProjectDataItem,
} from './types.ts';

/**
 * Format a single RAG chunk into readable text
 */
function formatRagChunk(chunk: RagChunk, includeText: boolean = false): string {
  const parts: string[] = [];

  parts.push(`**${chunk.source.title}**`);
  parts.push(`(categoria: ${chunk.source.category})`);

  if (chunk.source.file_path) {
    parts.push(`[${chunk.source.file_path}]`);
  }

  if (includeText && chunk.chunk_text) {
    const textPreview = chunk.chunk_text.slice(0, 300);
    parts.push(`\n> ${textPreview}${chunk.chunk_text.length > 300 ? '...' : ''}`);
  }

  return parts.join(' ');
}

/**
 * Format RAG results into a section of the response
 */
function formatRagSection(chunks: RagChunk[], includeText: boolean = false): string {
  if (chunks.length === 0) {
    return '';
  }

  const sections: string[] = ['### Documentação Relevante\n'];

  // Group by category
  const byCategory = new Map<string, RagChunk[]>();
  for (const chunk of chunks) {
    const cat = chunk.source.category;
    const existing = byCategory.get(cat) || [];
    existing.push(chunk);
    byCategory.set(cat, existing);
  }

  for (const [category, categoryChunks] of byCategory) {
    sections.push(`**${category}**:`);
    for (const chunk of categoryChunks.slice(0, 3)) {
      sections.push(`- ${formatRagChunk(chunk, includeText)}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Format a single data item into readable text
 */
function formatDataItem(item: ProjectDataItem): string {
  const parts: string[] = [];

  parts.push(`**${item.title}**`);

  if (item.status) {
    parts.push(`[${item.status}]`);
  }

  if (item.priority) {
    parts.push(`(prioridade: ${item.priority})`);
  }

  if (item.description) {
    const descPreview = item.description.slice(0, 100);
    parts.push(`- ${descPreview}${item.description.length > 100 ? '...' : ''}`);
  }

  return parts.join(' ');
}

/**
 * Format data results into a section of the response
 */
function formatDataSection(results: DataQueryResult[]): string {
  if (results.length === 0) {
    return '';
  }

  const sections: string[] = ['### Dados do Projeto\n'];

  for (const result of results) {
    if (result.items.length === 0) {
      continue;
    }

    const categoryLabel = getCategoryLabel(result.category);
    sections.push(`**${categoryLabel}** (${result.count} encontrados):`);

    for (const item of result.items.slice(0, 5)) {
      sections.push(`- ${formatDataItem(item)}`);
    }

    sections.push('');
  }

  return sections.join('\n');
}

/**
 * Get human-readable label for a data category
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    features: 'Features',
    tasks: 'Tarefas',
    sprints: 'Sprints',
    backlog_items: 'Backlog/Épicos',
    team_members: 'Equipe',
    meetings: 'Reuniões',
  };

  return labels[category] || category;
}

/**
 * Build a natural language introduction based on intent
 */
function buildIntroduction(
  intent: QueryIntent,
  docUsed: boolean,
  dataUsed: boolean,
  docCount: number,
  dataCount: number
): string {
  const parts: string[] = [];

  switch (intent) {
    case 'documentation':
      if (docCount > 0) {
        parts.push(`Encontrei **${docCount}** resultado(s) na documentação que podem ajudar:`);
      } else {
        parts.push('Não encontrei resultados na documentação para sua consulta.');
      }
      break;

    case 'data':
      if (dataCount > 0) {
        parts.push(`Encontrei **${dataCount}** item(s) no projeto:`);
      } else {
        parts.push('Não encontrei dados no projeto para sua consulta.');
      }
      break;

    case 'combined':
      if (docUsed && dataUsed) {
        parts.push(`Encontrei resultados combinados:`);
        if (docCount > 0) parts.push(`- **${docCount}** na documentação`);
        if (dataCount > 0) parts.push(`- **${dataCount}** no projeto`);
        parts.push('\n');
      } else if (docUsed && docCount > 0) {
        parts.push(`Encontrei **${docCount}** resultado(s) na documentação:`);
      } else if (dataUsed && dataCount > 0) {
        parts.push(`Encontrei **${dataCount}** item(s) no projeto:`);
      } else {
        parts.push('Não encontrei resultados para sua consulta.');
      }
      break;

    default:
      if (docCount > 0 || dataCount > 0) {
        parts.push(`Encontrei os seguintes resultados:`);
      } else {
        parts.push('Não encontrei resultados para sua consulta.');
      }
  }

  return parts.join(' ');
}

/**
 * Build a suggestions section for next steps
 */
function buildSuggestions(
  intent: QueryIntent,
  docUsed: boolean,
  dataUsed: boolean
): string {
  const suggestions: string[] = [];

  if (!docUsed) {
    suggestions.push('- Pergunte sobre como implementar algo para ver documentação técnica');
  }

  if (!dataUsed) {
    suggestions.push('- Pergunte sobre status de tarefas ou features para ver dados do projeto');
  }

  if (suggestions.length > 0) {
    return '\n\n**Sugestões:**\n' + suggestions.join('\n');
  }

  return '';
}

/**
 * Main response formatting function
 *
 * Combines RAG and data results into a formatted natural language response.
 *
 * @param intent - Classified query intent
 * @param query - Original user query
 * @param ragChunks - RAG documentation results
 * @param dataResults - Project data results
 * @param includeRawData - Whether to include raw data in response
 * @returns Formatted response string
 */
export function formatResponse(
  intent: QueryIntent,
  query: string,
  ragChunks: RagChunk[],
  dataResults: DataQueryResult[],
  includeRawData: boolean = false
): string {
  const docCount = ragChunks.length;
  const dataCount = dataResults.reduce((sum, r) => sum + r.count, 0);
  const docUsed = docCount > 0;
  const dataUsed = dataResults.some((r) => r.count > 0);

  const parts: string[] = [];

  // Introduction
  parts.push(buildIntroduction(intent, docUsed, dataUsed, docCount, dataCount));

  // Documentation section
  if (docUsed) {
    parts.push('');
    parts.push(formatRagSection(ragChunks, includeRawData));
  }

  // Data section
  if (dataUsed) {
    parts.push('');
    parts.push(formatDataSection(dataResults));
  }

  // Suggestions
  if (docUsed || dataUsed) {
    parts.push(buildSuggestions(intent, docUsed, dataUsed));
  }

  return parts.join('\n').trim();
}

/**
 * Build a summary-only response (no detailed items)
 */
export function formatSummaryOnly(
  intent: QueryIntent,
  docCount: number,
  dataCount: number
): string {
  const parts: string[] = [];

  switch (intent) {
    case 'documentation':
      if (docCount > 0) {
        parts.push(`Encontrei **${docCount}** documento(s) relevante(s) na base de conhecimento.`);
      } else {
        parts.push('Não encontrei documentação relevante para sua consulta.');
      }
      break;

    case 'data':
      if (dataCount > 0) {
        parts.push(`Encontrei **${dataCount}** item(s) no projeto.`);
      } else {
        parts.push('Não encontrei dados correspondentes no projeto.');
      }
      break;

    case 'combined':
      if (docCount > 0 && dataCount > 0) {
        parts.push(`Encontrei **${docCount}** documento(s) e **${dataCount}** item(s) de dados.`);
      } else if (docCount > 0) {
        parts.push(`Encontrei **${docCount}** documento(s) relevante(s).`);
      } else if (dataCount > 0) {
        parts.push(`Encontrei **${dataCount}** item(s) no projeto.`);
      } else {
        parts.push('Não encontrei resultados para sua consulta.');
      }
      break;

    default:
      parts.push(`Resultados: ${docCount} documentação, ${dataCount} dados.`);
  }

  return parts.join('');
}

/**
 * Format error response
 */
export function formatError(error: string, query: string): string {
  return `## Desculpe, houve um erro ao processar sua consulta

**Consulta:** "${query}"

**Erro:** ${error}

Por favor, tente novamente ou reformule sua pergunta.`;
}
