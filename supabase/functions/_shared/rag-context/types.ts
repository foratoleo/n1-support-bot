/**
 * Shared type definitions for the RAG Context module
 *
 * This module provides interfaces and types used by all RAG context operations
 * within the Edge Functions. It enables context enrichment for AI document
 * generation by searching the indexed knowledge base.
 *
 * @module _shared/rag-context/types
 */

/**
 * Identifies the type of creation in progress.
 * Determines which content types will be searched for relevant context.
 */
export type CreationType = 'tasks' | 'features' | 'backlog_items';

/**
 * Configuration for the RAG context module, stored in platform_settings.
 * Loaded from section: 'rag', key: 'rag-context-config'.
 */
export interface RagContextConfig {
  /** Whether RAG context enrichment is enabled */
  enabled: boolean;
  /** Maximum number of search results to retrieve */
  max_results: number;
  /** Minimum similarity threshold for results (0.0 - 1.0) */
  similarity_threshold: number;
  /** Maximum token budget for the context block */
  max_context_tokens: number;
  /** Search scope - project only or project and company */
  scope: 'project_only' | 'project_and_company';
  /** Weight for semantic (embedding) search component (0.0 - 1.0) */
  semantic_weight: number;
  /** Weight for keyword (full-text) search component (0.0 - 1.0) */
  keyword_weight: number;
  /** Content types to search, grouped by creation type */
  content_types_by_creation: Record<CreationType, string[]>;
}

/**
 * Individual search result mapped from the hybrid_search RPC response.
 * Fields are in camelCase as per project convention.
 */
export interface RagSearchResult {
  /** Unique identifier of the embedding record */
  id: string;
  /** The text content chunk returned from the search */
  contentChunk: string;
  /** Source table the chunk originated from */
  sourceTable: string;
  /** ID of the source record */
  sourceId: string;
  /** Additional metadata stored with the embedding */
  metadata: Record<string, unknown>;
  /** Combined hybrid search score (semantic + keyword weighted) */
  combinedScore: number;
  /** Semantic similarity score component */
  semanticScore: number;
  /** Keyword relevance score component */
  keywordScore: number;
  /** Semantic content type of the document chunk */
  contentType?: string;
}

/**
 * Output from the RagContextService.fetchContext() method.
 * Contains the formatted context block ready for prompt injection.
 */
export interface RagContextResult {
  /** Markdown-formatted context block ready for injection into the user prompt. Empty string if no results. */
  contextBlock: string;
  /** Fixed instruction guiding the AI to use the RAG context. Empty string if no results. */
  ragInstruction: string;
  /** All search results that were included in the context block */
  results: RagSearchResult[];
  /** Whether RAG context was successfully retrieved and injected */
  used: boolean;
  /** Number of results included in the context block */
  resultsCount: number;
  /** Total duration of the RAG fetch operation in milliseconds */
  durationMs: number;
}

/**
 * Parameters passed to RagContextService.fetchContext().
 */
export interface RagContextOptions {
  /** Project ID for filtering search results (mandatory for isolation) */
  projectId: string;
  /** Type of creation operation - determines which content types are searched */
  creationType: CreationType;
  /** RAG configuration to use for this fetch operation */
  config: RagContextConfig;
}
