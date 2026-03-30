/**
 * Shared type definitions for RAG indexing operations
 *
 * These types are used across both index-single-document and process-indexing-queue
 * Edge Functions for consistent document chunking and embedding generation.
 *
 * Content size expectations by source table:
 * - backlog_items: 3-15KB (normalized records with features, tasks, progress metrics)
 * - company_knowledge_base: 1-30KB (article content with title, category, and tags)
 * - dev_tasks: 2-10KB (normalized records with sprint, feature, epic, comments, subtasks, JIRA data)
 * - features: 5-20KB (normalized records with epic, tasks, sprints, meetings, documents, attachments)
 * - generated_documents: 5-50KB (full document content)
 * - meeting_transcripts: 10-100KB (full transcript text)
 * - project_documents: 1-50KB (document content)
 * - style_guides: 1-20KB (coding standards, naming conventions, component structure rules)
 *
 * For dev_tasks, normalized records are fetched via get-task-normalized-record Edge Function,
 * providing rich Markdown context instead of just title+description (~100-500 bytes).
 *
 * For backlog_items, normalized records are fetched via get-backlog-normalized-record Edge Function,
 * providing rich Markdown context with features, tasks, and progress metrics.
 *
 * For features, normalized records are fetched via get-feature-normalized-record Edge Function,
 * providing rich Markdown context with epic, tasks, sprints, meetings, documents, and attachments.
 *
 * For style_guides, content is fetched directly from the style_guides table (name, category,
 * tags, description, content). Style guides are global (no project_id) and use the sentinel
 * UUID '00000000-0000-0000-0000-000000000000', identical to company_knowledge_base.
 *
 * @module _shared/indexing/types
 */

/**
 * Valid source tables that can be indexed for RAG.
 * Includes both project-scoped tables and global tables (company_knowledge_base, style_guides).
 */
export type SourceTable =
  | 'backlog_items'
  | 'company_knowledge_base'
  | 'dev_tasks'
  | 'features'
  | 'generated_documents'
  | 'meeting_transcripts'
  | 'project_documents'
  | 'style_guides';

/**
 * Metadata attached to each content chunk during the RAG indexing process.
 *
 * ChunkMetadata provides essential context about the origin, position, and structure
 * of each text chunk. This metadata is stored alongside embeddings in the
 * document_embeddings table and used during retrieval to:
 *
 * 1. **Trace chunks back to source documents** - sourceTable and sourceId identify
 *    the original record, enabling linking search results to their sources.
 *
 * 2. **Reconstruct document structure** - chunkIndex and totalChunks allow ordering
 *    chunks and understanding their relative position within the source.
 *
 * 3. **Preserve semantic boundaries** - section and heading fields maintain document
 *    structure from Markdown-formatted content (PRDs, user stories, normalized records).
 *
 * 4. **Enable filtered searches** - Metadata fields can be used to filter search
 *    results by document type, section, or other criteria.
 *
 * @example
 * ```typescript
 * const metadata: ChunkMetadata = {
 *   sourceTable: 'dev_tasks',
 *   sourceId: '550e8400-e29b-41d4-a716-446655440000',
 *   chunkIndex: 0,
 *   totalChunks: 3,
 *   title: 'Implement user authentication',
 *   section: 'Task Details',
 *   heading: 'Task Details'
 * };
 * ```
 */
export interface ChunkMetadata {
  /** Source table name - identifies which database table the content originated from */
  sourceTable: SourceTable;
  /** Source record ID (UUID) - unique identifier of the original record */
  sourceId: string;
  /** Zero-based chunk index - position of this chunk within the chunked document */
  chunkIndex: number;
  /** Total number of chunks for this source - enables understanding chunk context */
  totalChunks?: number;
  /** Document title (if available) - human-readable identifier for display */
  title?: string;
  /** Section heading (for structured documents) - preserves Markdown heading structure */
  heading?: string;
  /** Section name (for structured documents) - semantic section identifier */
  section?: string;
  /** Additional custom metadata - extensible for source-specific fields */
  [key: string]: unknown;
}

/**
 * A single content chunk ready for embedding generation
 *
 * Chunk sizes are controlled by chunking configuration:
 * - maxTokens: 800 (default)
 * - overlapTokens: 150 (default)
 * - minTokens: 50 (default)
 *
 * For dev_tasks with normalized records (2-10KB / ~500-2500 tokens),
 * section-aware chunking splits content by Markdown headings to preserve
 * semantic structure (Task Details, Context, Comments, etc.).
 */
export interface ContentChunk {
  /** The text content of this chunk (up to ~maxTokens worth of content) */
  content: string;
  /** Metadata about the chunk's origin and position */
  metadata: ChunkMetadata;
  /** Approximate token count for this chunk (~chars/4 estimation in Edge Functions) */
  tokenCount: number;
  /** Checksum hash for deduplication */
  checksum: string;
}

/**
 * Result of embedding generation for a single chunk
 */
export interface EmbeddingResult {
  /** The original chunk that was embedded */
  chunk: ContentChunk;
  /** The embedding vector (1536 dimensions for text-embedding-ada-002) */
  embedding: number[];
  /** Token count consumed by the embedding API */
  tokenCount: number;
}

/**
 * Request payload for index-single-document Edge Function.
 * Valid source_table values: backlog_items, company_knowledge_base, dev_tasks, features,
 * generated_documents, meeting_transcripts, project_documents, style_guides.
 * Global tables (company_knowledge_base, style_guides) use the sentinel project_id
 * '00000000-0000-0000-0000-000000000000'.
 */
export interface IndexDocumentRequest {
  /** Source table name */
  source_table: SourceTable;
  /** Source record ID */
  source_id: string;
  /** Project ID for filtering */
  project_id: string;
  /** Database event type (INSERT, UPDATE, DELETE) */
  event_type: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Optional queue item ID for status tracking */
  queue_item_id?: string;
}

/**
 * Response from index-single-document Edge Function
 */
export interface IndexDocumentResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** Number of chunks processed and stored */
  chunks_processed?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Database row structure for document_embeddings table insert
 */
export interface EmbeddingInsertRow {
  /** The text content chunk */
  content_chunk: string;
  /** Source table name */
  source_table: string;
  /** Source record ID */
  source_id: string;
  /** Chunk index within the source */
  chunk_index: number;
  /** Embedding vector as JSON string */
  embedding: string;
  /** Project ID for filtering */
  project_id: string;
  /** Additional metadata as JSONB */
  metadata: ChunkMetadata;
  /** Content checksum for deduplication */
  checksum: string;
  /** Token count for cost tracking */
  token_count: number;
  /** Semantic content type identifier (e.g. 'task', 'feature', 'knowledge-base') */
  content_type: string;
}

/**
 * Maps a source table and its chunk metadata to a semantic content type string.
 * For generated_documents, extracts the document type from metadata.
 *
 * @param sourceTable - The source table name (e.g. 'dev_tasks', 'features')
 * @param metadata    - Chunk metadata containing optional documentType for generated_documents
 * @returns A semantic content type identifier (e.g. 'task', 'feature', 'knowledge-base')
 */
export function resolveContentType(
  sourceTable: SourceTable,
  metadata: Record<string, unknown>,
): string {
  switch (sourceTable) {
    case 'dev_tasks':
      return 'task';
    case 'features':
      return 'feature';
    case 'backlog_items':
      return 'backlog-item';
    case 'meeting_transcripts':
      return 'meeting-transcript';
    case 'project_documents':
      return 'project-document';
    case 'company_knowledge_base':
      return 'knowledge-base';
    case 'style_guides':
      return 'style-guide';
    case 'generated_documents': {
      const docType = metadata.documentType;
      return typeof docType === 'string' && docType.trim().length > 0
        ? docType.trim()
        : 'unknown';
    }
    default:
      return 'unknown';
  }
}

/**
 * Indexing queue item structure from indexing_queue table
 */
export interface IndexingQueueItem {
  /** Queue item ID */
  id: string;
  /** Source table name */
  source_table: string;
  /** Source record ID */
  source_id: string;
  /** Database event type */
  event_type: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Project ID */
  project_id: string;
  /** Queue item status */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** Retry count */
  retry_count: number;
  /** Error message if failed */
  error_message?: string;
  /** Timestamp when item was created */
  created_at: string;
  /** Timestamp when processing started */
  processing_started_at?: string;
  /** Timestamp when processing completed */
  completed_at?: string;
}
