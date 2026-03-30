/**
 * planning-assistant Edge Function
 *
 * Unified API that combines RAG documentation queries with project data queries.
 * Routes queries to appropriate backends and combines results.
 *
 * Architecture:
 * - Accepts natural language queries
 * - Analyzes query intent (documentation, data, or combined)
 * - Queries RAG system for documentation (planning_embeddings)
 * - Queries main Supabase for project data (features, tasks, sprints, etc.)
 * - Combines and formats results into natural language response
 *
 * @module planning-assistant
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { corsHeaders } from '../_shared/cors.ts';
import type {
  PlanningAssistantRequest,
  PlanningAssistantResponse,
  RagResult,
  DataResult,
  QueryIntent,
  RagChunk,
  DataQueryResult,
  DocCategory,
} from './types.ts';
import { analyzeQuery } from './query-analyzer.ts';
import { queryProjectData, searchProjectData } from './data-querier.ts';
import { formatResponse, formatError } from './response-formatter.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPERATION = 'planning-assistant';
const DEFAULT_LIMIT = 5;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const PLANNING_RAG_URL = 'VITE_PLANNING_RAG_URL';
const PLANNING_RAG_SERVICE_ROLE = 'SUPABASE_PLANNING_SERVICE_ROLE';

// ---------------------------------------------------------------------------
// Planning RAG Client (separate Supabase instance)
// ---------------------------------------------------------------------------

let planningRagClient: SupabaseClient | null = null;

function getPlanningRagClient(): SupabaseClient {
  if (planningRagClient) {
    return planningRagClient;
  }

  const supabaseUrl = Deno.env.get(PLANNING_RAG_URL);
  const serviceRoleKey = Deno.env.get(PLANNING_RAG_SERVICE_ROLE);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(`Missing required environment variables: ${PLANNING_RAG_URL} or ${PLANNING_RAG_SERVICE_ROLE}`);
  }

  planningRagClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return planningRagClient;
}

// ---------------------------------------------------------------------------
// RAG Query Functions
// ---------------------------------------------------------------------------

/**
 * Generate query embedding via OpenAI
 */
async function generateQueryEmbedding(
  query: string,
  openaiApiKey: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: query.slice(0, 30000),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI embeddings API error (${response.status}): ${errorBody}`);
  }

  const json = await response.json();
  return json.data[0].embedding;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Query RAG system for documentation
 */
async function queryRagDocumentation(
  query: string,
  categories: DocCategory[],
  limit: number,
  similarityThreshold: number
): Promise<RagResult> {
  const startTime = Date.now();

  try {
    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('VITE_OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Generate query embedding
    console.log(`[${OPERATION}] Generating query embedding...`);
    const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);

    // Get Planning RAG client
    const client = getPlanningRagClient();

    // Query embeddings table
    console.log(`[${OPERATION}] Searching planning_embeddings...`);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Fetch all embeddings and compute similarity (fallback approach)
    // In production, you'd use a proper vector search RPC
    const { data, error } = await client
      .from('planning_embeddings')
      .select('id, doc_id, chunk_index, chunk_text, embedding, metadata');

    if (error) {
      throw new Error(`Failed to query embeddings: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {
        used: false,
        results: [],
        total_results: 0,
        processing_time_ms: Date.now() - startTime,
        error: undefined,
      };
    }

    // Compute similarities
    const results: RagChunk[] = [];
    for (const row of data) {
      // Parse embedding if string
      let embedding = row.embedding;
      if (typeof embedding === 'string') {
        try {
          embedding = JSON.parse(embedding);
        } catch {
          continue;
        }
      }

      // Filter by category if needed
      if (categories.length > 0) {
        const rowCategory = row.metadata?.category;
        if (!rowCategory || !categories.includes(rowCategory)) {
          continue;
        }
      }

      const similarity = cosineSimilarity(queryEmbedding, embedding);

      if (similarity >= similarityThreshold) {
        results.push({
          id: row.id,
          doc_id: row.doc_id,
          chunk_index: row.chunk_index,
          similarity,
          chunk_text: row.chunk_text,
          source: {
            title: row.metadata?.title || 'Untitled',
            category: row.metadata?.category || 'route',
            file_path: row.metadata?.file_path || '',
            section: row.metadata?.section,
          },
        });
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = results.slice(0, limit);

    console.log(`[${OPERATION}] Found ${limitedResults.length} RAG results`);

    return {
      used: true,
      results: limitedResults,
      total_results: limitedResults.length,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${OPERATION}] RAG query error:`, errorMessage);

    return {
      used: false,
      results: [],
      total_results: 0,
      processing_time_ms: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------

function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  request?: PlanningAssistantRequest;
} {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const req = body as Record<string, unknown>;

  if (!req.query || typeof req.query !== 'string') {
    return { valid: false, error: 'Query field is required and must be a string' };
  }

  if (!req.project_id || typeof req.project_id !== 'string') {
    return { valid: false, error: 'project_id field is required and must be a string' };
  }

  if (req.query.trim().length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (req.limit !== undefined) {
    const limit = Number(req.limit);
    if (isNaN(limit) || limit < 1 || limit > 20) {
      return { valid: false, error: 'Limit must be between 1 and 20' };
    }
  }

  if (req.similarity_threshold !== undefined) {
    const threshold = Number(req.similarity_threshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      return { valid: false, error: 'Similarity threshold must be between 0 and 1' };
    }
  }

  return {
    valid: true,
    request: {
      query: req.query as string,
      project_id: req.project_id as string,
      user_id: req.user_id as string | undefined,
      data_categories: req.data_categories as PlanningAssistantRequest['data_categories'],
      doc_categories: req.doc_categories as PlanningAssistantRequest['doc_categories'],
      limit: req.limit !== undefined ? Number(req.limit) : DEFAULT_LIMIT,
      similarity_threshold:
        req.similarity_threshold !== undefined
          ? Number(req.similarity_threshold)
          : DEFAULT_SIMILARITY_THRESHOLD,
      include_raw_data: req.include_raw_data as boolean | undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Response Builders
// ---------------------------------------------------------------------------

function buildSuccessResponse(
  response: PlanningAssistantResponse,
  requestId: string
): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
  });
}

function buildErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode: number,
  processingTimeMs: number
): Response {
  const response: PlanningAssistantResponse = {
    success: false,
    request_id: requestId,
    query: '',
    intent: 'unknown',
    documentation_used: false,
    data_used: false,
    confidence: 0,
    response: formatError(message, ''),
    processing_time_ms: processingTimeMs,
    error: message,
  };

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
  });
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = `pa-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const startTime = Date.now();

  try {
    // Only allow POST
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
    } catch {
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

    const request = validation.request!;

    console.log(`[${OPERATION}] Processing query: "${request.query.substring(0, 50)}..."`);
    console.log(`[${OPERATION}] Project ID: ${request.project_id}`);

    // Analyze query intent
    const intentAnalysis = analyzeQuery(request.query, {
      data_categories: request.data_categories,
      doc_categories: request.doc_categories,
    });

    console.log(`[${OPERATION}] Intent: ${intentAnalysis.intent} (confidence: ${intentAnalysis.confidence})`);
    console.log(`[${OPERATION}] Reasoning: ${intentAnalysis.reasoning}`);

    // Execute queries based on intent
    let ragResult: RagResult = {
      used: false,
      results: [],
      total_results: 0,
      processing_time_ms: 0,
    };

    let dataResult: DataResult = {
      used: false,
      categories: [],
      total_results: 0,
      processing_time_ms: 0,
    };

    // Query RAG for documentation (if intent is documentation or combined)
    if (intentAnalysis.intent === 'documentation' || intentAnalysis.intent === 'combined') {
      try {
        ragResult = await queryRagDocumentation(
          request.query,
          intentAnalysis.target_doc_categories,
          request.limit!,
          request.similarity_threshold!
        );
      } catch (error) {
        console.error(`[${OPERATION}] RAG query failed:`, error);
      }
    }

    // Query project data (if intent is data or combined)
    if (intentAnalysis.intent === 'data' || intentAnalysis.intent === 'combined') {
      try {
        dataResult = await searchProjectData(
          request.project_id,
          request.query,
          intentAnalysis.target_data_categories,
          request.limit
        );
      } catch (error) {
        console.error(`[${OPERATION}] Data query failed:`, error);
      }
    }

    // Format response
    const formattedResponse = formatResponse(
      intentAnalysis.intent,
      request.query,
      ragResult.results,
      dataResult.categories,
      request.include_raw_data || false
    );

    // Calculate combined confidence
    const docConfidence = ragResult.used ? ragResult.total_results / Math.max(request.limit!, 1) : 0;
    const dataConfidence = dataResult.used ? dataResult.total_results > 0 ? 0.5 : 0 : 0;
    const combinedConfidence = Math.min(
      intentAnalysis.confidence * 0.5 + docConfidence * 0.25 + dataConfidence * 0.25,
      1.0
    );

    const response: PlanningAssistantResponse = {
      success: true,
      request_id: requestId,
      query: request.query,
      intent: intentAnalysis.intent,
      documentation_used: ragResult.used,
      data_used: dataResult.used,
      confidence: Math.round(combinedConfidence * 100) / 100,
      response: formattedResponse,
      documentation: ragResult.used ? ragResult.results : undefined,
      data: dataResult.used ? dataResult.categories : undefined,
      processing_time_ms: Date.now() - startTime,
    };

    console.log(`[${OPERATION}] Completed in ${response.processing_time_ms}ms`);
    console.log(`[${OPERATION}] Doc results: ${ragResult.total_results}, Data results: ${dataResult.total_results}`);

    return buildSuccessResponse(response, requestId);
  } catch (error) {
    console.error(`[${OPERATION}] Fatal error:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return buildErrorResponse(
      'INTERNAL_ERROR',
      errorMessage,
      requestId,
      500,
      Date.now() - startTime
    );
  }
});
