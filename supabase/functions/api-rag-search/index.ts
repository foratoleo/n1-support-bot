/**
 * API RAG Search Edge Function
 *
 * REST API endpoint that accepts natural language queries and returns
 * enriched search results with metadata. Supports semantic, keyword, and
 * hybrid search modes.
 *
 * @module api-rag-search
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import {
  ApiRagSearchRequest,
  ApiRagSearchResponse,
  SearchResult,
  PaginationMetadata,
  SourceTable,
  validateRequest,
  LIMIT_MIN,
  LIMIT_MAX,
  OFFSET_MIN,
} from './types.ts';
import {
  generateQueryEmbedding,
  isEmbeddingError,
  EmbeddingError,
} from './embeddings.ts';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMIT = 10;
const DEFAULT_SEARCH_MODE = 'semantic';
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const EMBEDDING_TIMEOUT_MS = 10000;

// ============================================================================
// Error Codes
// ============================================================================

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INTERNAL_ERROR';

interface ErrorInfo {
  code: ErrorCode;
  statusCode: number;
  message: string;
  retryable: boolean;
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    statusCode: 400,
    message: 'Request validation failed',
    retryable: false,
  },
  CONFIGURATION_ERROR: {
    code: 'CONFIGURATION_ERROR',
    statusCode: 500,
    message: 'Server configuration error',
    retryable: false,
  },
  TIMEOUT_ERROR: {
    code: 'TIMEOUT_ERROR',
    statusCode: 504,
    message: 'Request timed out',
    retryable: true,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    message: 'Internal server error',
    retryable: false,
  },
};

// ============================================================================
// Request ID Generation
// ============================================================================

function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `rag-search-${timestamp}-${random}`;
}

// ============================================================================
// Response Builders
// ============================================================================

function buildSuccessResponse(
  results: SearchResult[],
  pagination: PaginationMetadata,
  processingTimeMs: number,
  requestId: string
): Response {
  const response: ApiRagSearchResponse = {
    success: true,
    results,
    pagination,
    processingTimeMs,
  };

  return new Response(JSON.stringify({ ...response, requestId }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Processing-Time-Ms': processingTimeMs.toString(),
    },
  });
}

function buildErrorResponse(
  errorCode: ErrorCode,
  message: string,
  requestId: string,
  processingTimeMs: number,
  retryable: boolean = false,
  details?: unknown
): Response {
  const errorInfo = ERROR_MAP[errorCode];

  const response: ApiRagSearchResponse = {
    success: false,
    results: [],
    pagination: {
      totalCount: 0,
      currentPage: 1,
      pageSize: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    processingTimeMs,
    error: {
      code: errorInfo.code,
      message: message || errorInfo.message,
      retryable,
      requestId,
    },
  };

  if (details !== undefined) {
    console.error(`[api-rag-search] Error details for ${requestId}:`, details);
  }

  return new Response(JSON.stringify(response), {
    status: errorInfo.statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Processing-Time-Ms': processingTimeMs.toString(),
    },
  });
}

// ============================================================================
// Result Mapping
// ============================================================================

interface RPCSearchResult {
  id: string;
  content_chunk: string;
  source_table: string;
  source_id: string;
  metadata: Record<string, unknown>;
  similarity?: number;
  combined_score?: number;
  semantic_score?: number;
  keyword_score?: number;
}

function mapToSearchResult(rpcResult: RPCSearchResult): SearchResult {
  // Determine the link based on source_table and source_id
  const link = buildLink(rpcResult.source_table, rpcResult.source_id);

  // Determine title from metadata or source
  const title = buildTitle(rpcResult);

  // Determine type from source_table
  const type = mapSourceType(rpcResult.source_table);

  // Calculate relevance score (use similarity or combined_score)
  const relevanceScore = rpcResult.combined_score ?? rpcResult.similarity ?? 0;

  // Build snippet from content_chunk (truncate to ~200 chars)
  const snippet = buildSnippet(rpcResult.content_chunk);

  // Get project_id from metadata or default
  const projectId = (rpcResult.metadata?.project_id as string) ?? '';

  return {
    id: rpcResult.id,
    title,
    type,
    relevanceScore,
    snippet,
    link,
    sourceTable: rpcResult.source_table as SourceTable,
    sourceId: rpcResult.source_id,
    projectId,
  };
}

function buildLink(sourceTable: string, sourceId: string): string {
  // Map source tables to frontend routes
  switch (sourceTable) {
    case 'features':
      return `/features/${sourceId}`;
    case 'backlog_items':
      return `/backlog/${sourceId}`;
    case 'generated_documents':
      return `/documents/${sourceId}`;
    case 'meeting_transcripts':
      return `/meetings/${sourceId}`;
    case 'sprints':
      return `/sprints/${sourceId}`;
    default:
      return `/search/${sourceId}`;
  }
}

function buildTitle(rpcResult: RPCSearchResult): string {
  const metadata = rpcResult.metadata ?? {};

  // Try to get title from metadata
  if (metadata.title && typeof metadata.title === 'string') {
    return metadata.title;
  }
  if (metadata.name && typeof metadata.name === 'string') {
    return metadata.name;
  }

  // Fall back to source info
  const tableLabel = rpcResult.source_table.replace(/_/g, ' ');
  return `${tableLabel} (${rpcResult.source_id.slice(0, 8)})`;
}

function mapSourceType(sourceTable: string): string {
  const typeMap: Record<string, string> = {
    features: 'feature',
    backlog_items: 'backlog-item',
    generated_documents: 'document',
    meeting_transcripts: 'transcript',
    sprints: 'sprint',
  };
  return typeMap[sourceTable] ?? 'unknown';
}

function buildSnippet(contentChunk: string, maxLength: number = 200): string {
  if (contentChunk.length <= maxLength) {
    return contentChunk;
  }

  // Find a good break point (space or period)
  let breakPoint = contentChunk.lastIndexOf('.', maxLength);
  if (breakPoint < maxLength * 0.5) {
    breakPoint = contentChunk.lastIndexOf(' ', maxLength);
  }

  if (breakPoint > 0) {
    return contentChunk.slice(0, breakPoint + 1) + '...';
  }

  return contentChunk.slice(0, maxLength - 3) + '...';
}

// ============================================================================
// Search Execution
// ============================================================================

interface SearchContext {
  supabase: ReturnType<typeof createClient>;
  embedding: number[];
  request: ApiRagSearchRequest;
  requestId: string;
}

async function executeSemanticSearch(ctx: SearchContext): Promise<RPCSearchResult[]> {
  const { supabase, embedding, request } = ctx;
  const limit = request.limit ?? DEFAULT_LIMIT;
  const offset = request.offset ?? 0;

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: DEFAULT_SIMILARITY_THRESHOLD,
    match_count: limit + offset, // Get extra for offset handling
    filter_project_id: request.projectId ?? null,
    filter_source_table: request.sourceTable ?? null,
  });

  if (error) {
    throw new Error(`Semantic search RPC failed: ${error.message}`);
  }

  // Apply offset in application layer
  return (data ?? []).slice(offset);
}

async function executeKeywordSearch(ctx: SearchContext): Promise<RPCSearchResult[]> {
  const { supabase, request } = ctx;
  const limit = request.limit ?? DEFAULT_LIMIT;
  const offset = request.offset ?? 0;

  // Use Supabase text search on document_embeddings
  let query = supabase
    .from('document_embeddings')
    .select('id, content_chunk, source_table, source_id, metadata', { count: 'exact' })
    .textSearch('content_chunk', request.query, {
      type: 'websearch',
      config: 'english',
    });

  // Apply filters
  if (request.projectId) {
    query = query.eq('project_id', request.projectId);
  }
  if (request.sourceTable) {
    query = query.eq('source_table', request.sourceTable);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Keyword search failed: ${error.message}`);
  }

  // Map to RPC result format (keyword search doesn't have similarity scores)
  return (data ?? []).map((item, index) => ({
    id: item.id,
    content_chunk: item.content_chunk,
    source_table: item.source_table,
    source_id: item.source_id,
    metadata: item.metadata,
    similarity: 1 - index * 0.01, // Approximate ranking
  }));
}

async function executeHybridSearch(ctx: SearchContext): Promise<RPCSearchResult[]> {
  const { supabase, embedding, request } = ctx;
  const limit = request.limit ?? DEFAULT_LIMIT;
  const offset = request.offset ?? 0;

  const { data, error } = await supabase.rpc('hybrid_search', {
    query_embedding: embedding,
    query_text: request.query,
    match_threshold: DEFAULT_SIMILARITY_THRESHOLD,
    match_count: limit + offset, // Get extra for offset handling
    filter_project_id: request.projectId ?? null,
    filter_content_types: request.contentTypes ?? null,
    semantic_weight: 0.7,
    keyword_weight: 0.3,
  });

  if (error) {
    throw new Error(`Hybrid search RPC failed: ${error.message}`);
  }

  // Apply offset in application layer
  return (data ?? []).slice(offset);
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req: Request) => {
  const startTime = performance.now();
  const requestId = generateRequestId();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    const processingTimeMs = Math.round(performance.now() - startTime);
    return buildErrorResponse(
      'VALIDATION_ERROR',
      `Method ${req.method} not allowed. Use POST.`,
      requestId,
      processingTimeMs,
      false
    );
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const validation = validateRequest(body);

    if (!validation.valid || !validation.request) {
      const processingTimeMs = Math.round(performance.now() - startTime);
      return buildErrorResponse(
        'VALIDATION_ERROR',
        validation.error ?? 'Invalid request',
        requestId,
        processingTimeMs,
        false
      );
    }

    const request: ApiRagSearchRequest = validation.request;
    const searchMode = request.searchMode ?? DEFAULT_SEARCH_MODE;
    const limit = request.limit ?? DEFAULT_LIMIT;
    const offset = request.offset ?? 0;

    // Get OpenAI API key
    const apiKey = Deno.env.get('VITE_OPENAI_API_KEY');
    if (!apiKey) {
      const processingTimeMs = Math.round(performance.now() - startTime);
      return buildErrorResponse(
        'CONFIGURATION_ERROR',
        'OpenAI API key not configured',
        requestId,
        processingTimeMs,
        false
      );
    }

    // Generate query embedding with timeout protection
    let embedding: number[];
    try {
      embedding = await generateQueryEmbedding(request.query, apiKey, {
        timeoutMs: EMBEDDING_TIMEOUT_MS,
      });
    } catch (error) {
      const processingTimeMs = Math.round(performance.now() - startTime);

      if (isEmbeddingError(error)) {
        const embeddingError = error as EmbeddingError;

        if (embeddingError.type === 'TIMEOUT') {
          console.error(
            `[api-rag-search] Embedding timeout for ${requestId}: ${embeddingError.message}`
          );
          return buildErrorResponse(
            'TIMEOUT_ERROR',
            embeddingError.message,
            requestId,
            processingTimeMs,
            true // Timeout is retryable
          );
        }

        console.error(
          `[api-rag-search] Embedding error for ${requestId}: ${embeddingError.type} - ${embeddingError.message}`
        );
        return buildErrorResponse(
          'INTERNAL_ERROR',
          embeddingError.message,
          requestId,
          processingTimeMs,
          embeddingError.retryable
        );
      }

      throw error; // Re-throw unexpected errors
    }

    // Create Supabase client
    const supabase = createSupabaseClient();

    // Build search context
    const searchContext: SearchContext = {
      supabase,
      embedding,
      request,
      requestId,
    };

    // Execute search based on mode
    let rpcResults: RPCSearchResult[];
    try {
      switch (searchMode) {
        case 'semantic':
          rpcResults = await executeSemanticSearch(searchContext);
          break;
        case 'keyword':
          rpcResults = await executeKeywordSearch(searchContext);
          break;
        case 'hybrid':
          rpcResults = await executeHybridSearch(searchContext);
          break;
        default:
          // TypeScript exhaustive check
          const _exhaustive: never = searchMode;
          throw new Error(`Unknown search mode: ${_exhaustive}`);
      }
    } catch (error) {
      const processingTimeMs = Math.round(performance.now() - startTime);
      const message = error instanceof Error ? error.message : String(error);

      console.error(
        `[api-rag-search] Database error for ${requestId}: ${message}`
      );

      return buildErrorResponse(
        'INTERNAL_ERROR',
        `Search execution failed: ${message}`,
        requestId,
        processingTimeMs,
        true, // Database errors may be transient
        { error: message }
      );
    }

    // Map results to enriched format
    const results: SearchResult[] = rpcResults.map(mapToSearchResult);

    // Calculate pagination metadata
    const totalCount = results.length; // Note: RPC doesn't return total count
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const pagination: PaginationMetadata = {
      totalCount,
      currentPage,
      pageSize: limit,
      totalPages,
      hasNextPage: results.length === limit,
      hasPreviousPage: offset > 0,
    };

    const processingTimeMs = Math.round(performance.now() - startTime);

    // Log structured result for observability
    const truncatedQuery = request.query.slice(0, 50);
    console.log(
      `[api-rag-search] ${requestId} | query="${truncatedQuery}${request.query.length > 50 ? '...' : ''}" | mode=${searchMode} | results=${results.length} | time=${processingTimeMs}ms`
    );

    return buildSuccessResponse(results, pagination, processingTimeMs, requestId);
  } catch (error) {
    const processingTimeMs = Math.round(performance.now() - startTime);
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      `[api-rag-search] Unhandled error for ${requestId}: ${message}`
    );

    return buildErrorResponse(
      'INTERNAL_ERROR',
      message,
      requestId,
      processingTimeMs,
      false,
      { error: message, stack: error instanceof Error ? error.stack : undefined }
    );
  }
});
