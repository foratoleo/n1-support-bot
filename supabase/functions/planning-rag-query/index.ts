/**
 * planning-rag-query Edge Function
 *
 * Accepts text queries, generates embeddings via OpenAI, and performs
 * vector similarity search on the planning_embeddings table to return
 * the most relevant documentation chunks.
 *
 * @module planning-rag-query
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  PlanningRagQueryRequest,
  PlanningRagQueryResponse,
  QueryResult,
  DEFAULT_QUERY_CONFIG,
} from './types.ts';
import { generateQueryEmbedding } from './embeddings.ts';
import {
  createPlanningRagClient,
  searchSimilarChunks,
} from './planning-rag-client.ts';

/**
 * Generate a unique request ID for tracing.
 */
function createRequestId(): string {
  return `rag-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Validate the incoming request.
 */
function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  request?: PlanningRagQueryRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const req = body as Record<string, unknown>;

  if (!req.query || typeof req.query !== 'string') {
    return { valid: false, error: 'Query field is required and must be a string' };
  }

  if (req.query.trim().length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (req.limit !== undefined) {
    const limit = Number(req.limit);
    if (isNaN(limit) || limit < 1 || limit > DEFAULT_QUERY_CONFIG.maxLimit) {
      return {
        valid: false,
        error: `Limit must be between 1 and ${DEFAULT_QUERY_CONFIG.maxLimit}`,
      };
    }
  }

  if (req.similarity_threshold !== undefined) {
    const threshold = Number(req.similarity_threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return { valid: false, error: 'Similarity threshold must be between 0 and 1' };
    }
  }

  if (req.categories !== undefined) {
    if (!Array.isArray(req.categories)) {
      return { valid: false, error: 'Categories must be an array' };
    }
    const validCategories = ['route', 'component', 'hook', 'api', 'data-model'];
    for (const cat of req.categories) {
      if (!validCategories.includes(cat)) {
        return {
          valid: false,
          error: `Invalid category: ${cat}. Valid categories are: ${validCategories.join(', ')}`,
        };
      }
    }
  }

  return {
    valid: true,
    request: {
      query: req.query as string,
      limit: req.limit !== undefined ? Number(req.limit) : DEFAULT_QUERY_CONFIG.defaultLimit,
      similarity_threshold:
        req.similarity_threshold !== undefined
          ? Number(req.similarity_threshold)
          : DEFAULT_QUERY_CONFIG.defaultSimilarityThreshold,
      categories: req.categories as PlanningRagQueryRequest['categories'],
      include_content: req.include_content !== false, // Default true
    },
  };
}

/**
 * Build success response.
 */
function buildSuccessResponse(
  results: QueryResult[],
  query: string,
  processingTimeMs: number,
  requestId: string
): Response {
  const response: PlanningRagQueryResponse = {
    success: true,
    processing_time_ms: processingTimeMs,
    query,
    embedding_dimensions: DEFAULT_QUERY_CONFIG.embeddingDimensions,
    total_results: results.length,
    results,
  };

  return new Response(JSON.stringify({ ...response, requestId }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Processing-Time-Ms': processingTimeMs.toString(),
      'X-Request-Id': requestId,
    },
  });
}

/**
 * Build error response.
 */
function buildErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode: number,
  processingTimeMs: number
): Response {
  const response: PlanningRagQueryResponse = {
    success: false,
    processing_time_ms: processingTimeMs,
    query: '',
    embedding_dimensions: 0,
    total_results: 0,
    results: [],
    error: message,
  };

  return new Response(JSON.stringify({ ...response, requestId }), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Processing-Time-Ms': processingTimeMs.toString(),
      'X-Request-Id': requestId,
    },
  });
}

/**
 * Main handler for the Edge Function.
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = createRequestId();
  const startTime = Date.now();

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return buildErrorResponse(
        'METHOD_NOT_ALLOWED',
        'Only POST method is supported',
        requestId,
        405,
        Date.now() - startTime
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[planning-rag-query] JSON parse error:', parseError);
      return buildErrorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        requestId,
        400,
        Date.now() - startTime
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return buildErrorResponse(
        'VALIDATION_ERROR',
        validation.error!,
        requestId,
        400,
        Date.now() - startTime
      );
    }

    const { query, limit, similarity_threshold, categories, include_content } =
      validation.request!;

    console.log(`[planning-rag-query] Processing query: "${query.substring(0, 50)}..."`);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('VITE_OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[planning-rag-query] Missing OpenAI API key');
      return buildErrorResponse(
        'CONFIGURATION_ERROR',
        'OpenAI API key not configured',
        requestId,
        500,
        Date.now() - startTime
      );
    }

    // Generate embedding for the query
    console.log('[planning-rag-query] Generating query embedding...');
    const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

    // Create Planning RAG client
    const client = createPlanningRagClient();

    // Search for similar chunks
    console.log('[planning-rag-query] Searching for similar chunks...');
    const searchResults = await searchSimilarChunks(
      client,
      queryEmbedding,
      limit,
      similarity_threshold,
      categories
    );

    // Format results
    const results: QueryResult[] = searchResults.map((result) => ({
      id: result.id,
      doc_id: result.doc_id,
      chunk_index: result.chunk_index,
      similarity: result.similarity || 0,
      chunk_text: include_content ? result.chunk_text : undefined,
      source: result.metadata,
    }));

    const processingTime = Date.now() - startTime;
    console.log(
      `[planning-rag-query] Query completed in ${processingTime}ms. Found ${results.length} results.`
    );

    return buildSuccessResponse(results, query, processingTime, requestId);
  } catch (error) {
    console.error('[planning-rag-query] Error:', error);
    const processingTime = Date.now() - startTime;

    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred';

    return buildErrorResponse(
      'INTERNAL_ERROR',
      errorMessage,
      requestId,
      500,
      processingTime
    );
  }
});
