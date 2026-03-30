/**
 * Type definitions for the planning-rag-query Edge Function
 *
 * This module defines the request/response types and internal data structures
 * used for querying the planning documentation RAG system.
 *
 * @module planning-rag-query/types
 */

/**
 * Valid document categories for planning documentation.
 * Maps to subdirectories in docs/planning/
 */
export type PlanningDocCategory = 'route' | 'component' | 'hook' | 'api' | 'data-model';

/**
 * Request payload for the planning-rag-query Edge Function.
 */
export interface PlanningRagQueryRequest {
  /** The text query to search for */
  query: string;
  /** Maximum number of results to return. Default: 5 */
  limit?: number;
  /** Minimum similarity threshold (0-1). Default: 0.5 */
  similarity_threshold?: number;
  /** Filter by specific document categories */
  categories?: PlanningDocCategory[];
  /** Include full chunk text in response. Default: true */
  include_content?: boolean;
}

/**
 * Response from the planning-rag-query Edge Function.
 */
export interface PlanningRagQueryResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Query processing time in milliseconds */
  processing_time_ms: number;
  /** The original query text */
  query: string;
  /** Query embedding dimensions */
  embedding_dimensions: number;
  /** Total number of results found */
  total_results: number;
  /** The search results */
  results: QueryResult[];
  /** Error message if failed */
  error?: string;
}

/**
 * A single search result from the RAG query.
 */
export interface QueryResult {
  /** Unique identifier for this result */
  id: string;
  /** Document ID reference */
  doc_id: string;
  /** Chunk index within the document */
  chunk_index: number;
  /** Similarity score (0-1, higher is more similar) */
  similarity: number;
  /** The text content of the chunk (if include_content is true) */
  chunk_text?: string;
  /** Source metadata */
  source: ResultSource;
}

/**
 * Source metadata for a search result.
 */
export interface ResultSource {
  /** Document title */
  title: string;
  /** Document category */
  category: PlanningDocCategory;
  /** File path of the source document */
  file_path: string;
  /** Section heading if chunk is from a specific section */
  section?: string;
  /** Token count for this chunk */
  token_count: number;
}

/**
 * Internal representation of a database query result.
 */
export interface DatabaseQueryResult {
  id: string;
  doc_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[] | string;
  metadata: ResultSource;
  similarity?: number;
}

/**
 * Configuration for the RAG query.
 */
export interface QueryConfig {
  /** Default limit for results */
  defaultLimit: number;
  /** Default similarity threshold */
  defaultSimilarityThreshold: number;
  /** Maximum allowed limit */
  maxLimit: number;
  /** Embedding model to use */
  embeddingModel: string;
  /** Embedding dimensions */
  embeddingDimensions: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_QUERY_CONFIG: QueryConfig = {
  defaultLimit: 5,
  defaultSimilarityThreshold: 0.5,
  maxLimit: 20,
  embeddingModel: 'text-embedding-ada-002',
  embeddingDimensions: 1536,
};
