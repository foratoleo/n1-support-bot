/**
 * Type definitions for the index-planning-docs Edge Function
 *
 * This module defines the request/response types and internal data structures
 * used for indexing planning documentation into the RAG system.
 *
 * @module index-planning-docs/types
 */

/**
 * Valid document categories for planning documentation.
 * Maps to subdirectories in docs/planning/
 */
export type PlanningDocCategory = 'route' | 'component' | 'hook' | 'api' | 'data-model';

/**
 * Request payload for the index-planning-docs Edge Function.
 */
export interface IndexPlanningDocsRequest {
  /** Force re-indexing of all documents even if they haven't changed */
  force_reindex?: boolean;
  /** Specific file paths to index (relative to docs/planning/). If omitted, indexes all files. */
  file_paths?: string[];
  /** Dry run mode - processes files but doesn't write to database */
  dry_run?: boolean;
}

/**
 * Response from the index-planning-docs Edge Function.
 */
export interface IndexPlanningDocsResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Number of documents processed */
  documents_processed: number;
  /** Number of chunks created */
  chunks_created: number;
  /** Number of embeddings generated */
  embeddings_generated: number;
  /** Processing time in milliseconds */
  processing_time_ms: number;
  /** Details about each processed file */
  processed_files?: ProcessedFileDetails[];
  /** Error message if failed */
  error?: string;
}

/**
 * Details about a processed documentation file.
 */
export interface ProcessedFileDetails {
  /** Relative file path from docs/planning/ */
  file_path: string;
  /** Document category */
  category: PlanningDocCategory;
  /** Number of chunks created */
  chunks: number;
  /** Number of embeddings generated */
  embeddings: number;
  /** Whether this was a new document or an update */
  is_new: boolean;
  /** Error if processing failed for this file */
  error?: string;
}

/**
 * Document record in planning_docs table.
 */
export interface PlanningDoc {
  id: string;
  title: string;
  content: string;
  category: PlanningDocCategory;
  file_path: string;
  metadata: PlanningDocMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * Metadata for planning documentation.
 */
export interface PlanningDocMetadata {
  /** Original file name without extension */
  file_name: string;
  /** File size in bytes */
  file_size: number;
  /** Word count of the document */
  word_count: number;
  /** Approximate token count */
  token_count: number;
  /** Whether the document has been chunked */
  is_chunked: boolean;
  /** Number of chunks created */
  chunk_count: number;
  /** Last modified timestamp of the source file */
  source_modified_at?: string;
  /** Checksum of the content for change detection */
  content_checksum: string;
}

/**
 * Embedding record in planning_embeddings table.
 */
export interface PlanningEmbedding {
  id: string;
  doc_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  metadata: ChunkEmbeddingMetadata;
  created_at: string;
}

/**
 * Metadata for chunk embeddings.
 */
export interface ChunkEmbeddingMetadata {
  /** Document title */
  title: string;
  /** Document category */
  category: PlanningDocCategory;
  /** Section heading if chunk is from a specific section */
  section?: string;
  /** File path for source reference */
  file_path: string;
  /** Token count for this chunk */
  token_count: number;
}

/**
 * Content chunk ready for embedding generation.
 */
export interface ContentChunk {
  /** The text content of this chunk */
  content: string;
  /** Chunk index within the document */
  chunk_index: number;
  /** Total chunks in the document */
  total_chunks: number;
  /** Section heading if from a specific section */
  section?: string;
  /** Approximate token count */
  token_count: number;
  /** Checksum for deduplication */
  checksum: string;
}

/**
 * Result of embedding generation for a chunk.
 */
export interface EmbeddingResult {
  chunk: ContentChunk;
  embedding: number[];
}

/**
 * File information from docs/planning/ directory.
 */
export interface PlanningFileInfo {
  /** Full file path */
  path: string;
  /** Relative path from docs/planning/ */
  relative_path: string;
  /** Category based on parent directory */
  category: PlanningDocCategory;
  /** File name without extension */
  name: string;
  /** File content */
  content: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  modified_at?: Date;
}
