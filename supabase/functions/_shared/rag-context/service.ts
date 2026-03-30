/**
 * RagContextService — hybrid search and prompt enrichment for Edge Functions
 *
 * Generates a query embedding from the input content, executes the hybrid_search
 * RPC against the project's indexed knowledge base, and formats the results into
 * a structured Markdown block ready for injection into AI prompts.
 *
 * All public methods implement graceful degradation: any internal failure is caught
 * and logged, and the caller always receives a valid RagContextResult (with
 * used: false) instead of an unhandled exception propagating to the HTTP handler.
 *
 * @module _shared/rag-context/service
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { CHARS_PER_TOKEN, RAG_PROMPT_INSTRUCTION } from './config.ts';
import type {
  RagContextOptions,
  RagContextResult,
  RagSearchResult,
} from './types.ts';

// ---------------------------------------------------------------------------
// Internal interfaces
// ---------------------------------------------------------------------------

/** Raw row returned by the hybrid_search RPC (snake_case columns) */
interface HybridSearchRow {
  id: string;
  content_chunk: string;
  source_table: string;
  source_id: string;
  metadata: Record<string, unknown>;
  combined_score: number;
  semantic_score: number;
  keyword_score: number;
  content_type: string;
}

/** Minimal shape of the OpenAI embeddings API response we care about */
interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-ada-002';
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const CONTEXT_BLOCK_HEADER =
  '## Project Context (Indexed Knowledge Base)\n\n' +
  'The following documents were retrieved from the project knowledge base and may be relevant:';
const SNIPPET_MAX_CHARS = 600;

/** Label map from content_type to Markdown heading */
const CONTENT_TYPE_LABELS: Record<string, string> = {
  task: '### Existing Tasks',
  feature: '### Existing Features',
  'backlog-item': '### Epics and Backlog',
  prd: '### PRDs',
  'user-story': '### User Stories',
  'meeting-notes': '### Meeting Notes',
  'technical-specs': '### Technical Specifications',
  'test-cases': '### Test Cases',
  'meeting-transcript': '### Meeting Transcripts',
  'project-document': '### Project Documents',
  'knowledge-base': '### Company Knowledge Base',
  'style-guide': '### Style Guides (Padrões de Código)',
};

// ---------------------------------------------------------------------------
// RagContextService
// ---------------------------------------------------------------------------

/**
 * Service that enriches AI prompts with relevant project knowledge via RAG.
 *
 * Usage:
 * ```typescript
 * const svc = new RagContextService(supabase, openaiApiKey, '[create-tasks]');
 * const ragConfig = await loadRagContextConfig(supabase, '[create-tasks]');
 * const result = await svc.fetchContext(body.content, {
 *   projectId: body.project_id,
 *   creationType: 'tasks',
 *   config: ragConfig,
 * });
 * if (result.used) {
 *   userPrompt += '\n\n' + result.contextBlock + '\n\n' + result.ragInstruction;
 * }
 * ```
 */
export class RagContextService {
  private readonly supabase: SupabaseClient;
  private readonly openaiApiKey: string;
  private readonly logPrefix: string;

  constructor(supabase: SupabaseClient, openaiApiKey: string, logPrefix: string) {
    this.supabase = supabase;
    this.openaiApiKey = openaiApiKey;
    this.logPrefix = logPrefix;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Retrieve relevant project context for the given content and inject options.
   *
   * Returns a result with `used: false` (and an empty `contextBlock`) when:
   * - RAG is disabled via config
   * - The hybrid_search returns no matching results
   * - Any internal error occurs (graceful degradation)
   *
   * @param content   - The input text to generate a query embedding from
   * @param options   - Project ID, creation type, and resolved RAG config
   * @returns         Formatted context block and operational metadata
   */
  async fetchContext(
    content: string,
    options: RagContextOptions,
  ): Promise<RagContextResult> {
    const empty: RagContextResult = {
      contextBlock: '',
      ragInstruction: '',
      results: [],
      used: false,
      resultsCount: 0,
      durationMs: 0,
    };

    if (!options.config.enabled) {
      console.log(`${this.logPrefix} RAG context disabled via config — skipping`);
      return empty;
    }

    const startTime = Date.now();

    try {
      const contentTypes =
        options.config.content_types_by_creation[options.creationType] ?? [];

      const embedding = await this.generateQueryEmbedding(content);
      const rawResults = await this.executeHybridSearch(
        embedding,
        content,
        options.projectId,
        contentTypes,
        options.config,
      );

      if (rawResults.length === 0) {
        console.log(
          `${this.logPrefix} RAG hybrid_search returned 0 matching results`,
        );
        return { ...empty, durationMs: Date.now() - startTime };
      }

      const truncated = this.truncateToTokenLimit(
        rawResults,
        options.config.max_context_tokens,
      );
      const contextBlock = this.formatContextBlock(truncated);
      const durationMs = Date.now() - startTime;

      return {
        contextBlock,
        ragInstruction: RAG_PROMPT_INSTRUCTION,
        results: truncated,
        used: true,
        resultsCount: truncated.length,
        durationMs,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `${this.logPrefix} RAG fetchContext failed — graceful degradation: ${message}`,
      );
      return { ...empty, durationMs: Date.now() - startTime };
    }
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  /**
   * Generate a query embedding for the given text via the OpenAI embeddings API.
   *
   * @param text - The raw input text to embed
   * @returns    A 1536-dimension float array (text-embedding-ada-002)
   * @throws     Error if the API call fails — caught by fetchContext try/catch
   */
  private async generateQueryEmbedding(text: string): Promise<number[]> {
    const MAX_EMBEDDING_INPUT_CHARS = 30_000;
    let sanitizedText = text.replace(/\n/g, ' ');

    if (sanitizedText.length > MAX_EMBEDDING_INPUT_CHARS) {
      console.warn(
        `${this.logPrefix} Embedding input truncated from ${sanitizedText.length} to ${MAX_EMBEDDING_INPUT_CHARS} chars`,
      );
      sanitizedText = sanitizedText.slice(0, MAX_EMBEDDING_INPUT_CHARS);
    }

    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: sanitizedText,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenAI embeddings API error (${response.status}): ${errorBody}`,
      );
    }

    const json: OpenAIEmbeddingResponse = await response.json();
    return json.data[0].embedding;
  }

  /**
   * Execute hybrid_search RPC with server-side content type filtering.
   * Passes filter_content_types directly to the RPC, eliminating the need for
   * client-side filtering and over-fetching.
   *
   * @param embedding     - Query embedding vector
   * @param queryText     - Original query text (for keyword search component)
   * @param projectId     - Mandatory project isolation filter
   * @param contentTypes  - Content types to filter server-side via the RPC
   * @param config        - Resolved RAG config (thresholds, weights, limits)
   * @returns             Filtered and sorted search results in camelCase
   * @throws              Error if the Supabase RPC call fails
   */
  private async executeHybridSearch(
    embedding: number[],
    queryText: string,
    projectId: string,
    contentTypes: string[],
    config: RagContextOptions['config'],
  ): Promise<RagSearchResult[]> {
    const { data, error } = await this.supabase.rpc('hybrid_search', {
      query_embedding: JSON.stringify(embedding),
      query_text: queryText,
      match_threshold: config.similarity_threshold,
      match_count: config.max_results,
      filter_project_id: projectId,
      filter_content_types: contentTypes.length > 0 ? contentTypes : null,
      semantic_weight: config.semantic_weight,
      keyword_weight: config.keyword_weight,
    });

    if (error) {
      throw new Error(`hybrid_search RPC error: ${error.message}`);
    }

    const rows = (data as HybridSearchRow[]) ?? [];

    const results = rows.map(
      (row): RagSearchResult => ({
        id: row.id,
        contentChunk: row.content_chunk,
        sourceTable: row.source_table,
        sourceId: row.source_id,
        metadata: row.metadata ?? {},
        combinedScore: row.combined_score,
        semanticScore: row.semantic_score,
        keywordScore: row.keyword_score,
        contentType: row.content_type,
      }),
    );

    // Sort descending by combined score (RPC may already sort, but enforce here)
    results.sort((a, b) => b.combinedScore - a.combinedScore);

    return results;
  }

  /**
   * Truncate the sorted results list to fit within the token budget.
   *
   * Chunks are kept whole — a chunk that would exceed the remaining budget is
   * discarded entirely rather than split.
   *
   * @param results   - Score-sorted search results
   * @param maxTokens - Maximum token budget for the context block
   * @returns         Subset of results that fits within the budget
   */
  private truncateToTokenLimit(
    results: RagSearchResult[],
    maxTokens: number,
  ): RagSearchResult[] {
    let accumulated = 0;
    const included: RagSearchResult[] = [];

    for (const result of results) {
      const chunkTokens = Math.ceil(result.contentChunk.length / CHARS_PER_TOKEN);
      if (accumulated + chunkTokens > maxTokens) {
        break;
      }
      accumulated += chunkTokens;
      included.push(result);
    }

    return included;
  }

  /**
   * Format the RAG results into a structured Markdown block for prompt injection.
   *
   * Groups results by content_type under labeled headings and renders each item
   * as a bullet with title, relevance score, and a short content snippet.
   *
   * @param results - Truncated, score-sorted search results
   * @returns       Formatted Markdown string (empty string if results is empty)
   */
  private formatContextBlock(results: RagSearchResult[]): string {
    if (results.length === 0) return '';

    // Group by content type while preserving score order within each group
    const grouped = new Map<string, RagSearchResult[]>();
    for (const result of results) {
      const key = result.contentType ?? 'unknown';
      const existing = grouped.get(key) ?? [];
      existing.push(result);
      grouped.set(key, existing);
    }

    const sections: string[] = [];

    for (const [contentType, typeResults] of grouped) {
      const heading = CONTENT_TYPE_LABELS[contentType] ?? `### ${contentType}`;
      const items = typeResults.map((r) => {
        const titleRaw =
          typeof r.metadata.title === 'string' && r.metadata.title.trim()
            ? r.metadata.title.trim()
            : `[${r.sourceTable}/${r.sourceId.slice(0, 8)}]`;

        const snippet = r.contentChunk.slice(0, SNIPPET_MAX_CHARS).replace(
          /\n+/g,
          ' ',
        );

        return (
          `- **${titleRaw}** (relevance: ${r.combinedScore.toFixed(2)})\n` +
          `  > ${snippet}`
        );
      });

      sections.push(`${heading}\n\n${items.join('\n\n')}`);
    }

    return `${CONTEXT_BLOCK_HEADER}\n\n${sections.join('\n\n')}`;
  }
}
