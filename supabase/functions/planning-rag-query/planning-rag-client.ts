/**
 * Supabase client for Planning RAG query operations
 *
 * Creates a client connected to the dedicated Planning RAG Supabase instance
 * at https://euciehzmtsqcvyopsmgk.supabase.co
 *
 * Provides functions for vector similarity search on planning_embeddings table.
 *
 * @module planning-rag-query/planning-rag-client
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import type { DatabaseQueryResult, PlanningDocCategory } from './types.ts';

/**
 * Environment variables required for Planning RAG Supabase connection.
 */
const PLANNING_RAG_URL = 'VITE_PLANNING_RAG_URL';
const PLANNING_RAG_SERVICE_ROLE = 'SUPABASE_PLANNING_SERVICE_ROLE';

/**
 * Singleton instance of the Planning RAG Supabase client.
 */
let planningRagClient: SupabaseClient | null = null;

/**
 * Creates and returns a singleton Supabase client for the Planning RAG database.
 *
 * @returns Supabase client configured for Planning RAG
 * @throws Error if required environment variables are missing
 */
export function createPlanningRagClient(): SupabaseClient {
  if (planningRagClient) {
    return planningRagClient;
  }

  const supabaseUrl = Deno.env.get(PLANNING_RAG_URL);
  const serviceRoleKey = Deno.env.get(PLANNING_RAG_SERVICE_ROLE);

  if (!supabaseUrl) {
    throw new Error(
      `Missing required environment variable: ${PLANNING_RAG_URL}. ` +
      'Please set it in your Edge Function environment.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      `Missing required environment variable: ${PLANNING_RAG_SERVICE_ROLE}. ` +
      'Please set it in your Edge Function environment.'
    );
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

/**
 * Reset the singleton client (for testing).
 */
export function resetPlanningRagClient(): void {
  planningRagClient = null;
}

/**
 * Search for similar chunks using vector similarity.
 *
 * Uses PostgreSQL's pgvector extension to perform cosine similarity search
 * on the planning_embeddings table.
 *
 * @param client - Supabase client instance
 * @param queryEmbedding - The embedding vector to search with
 * @param limit - Maximum number of results to return
 * @param similarityThreshold - Minimum similarity score (0-1)
 * @param categories - Optional filter by document categories
 * @returns Array of database query results with similarity scores
 */
export async function searchSimilarChunks(
  client: SupabaseClient,
  queryEmbedding: number[],
  limit: number,
  similarityThreshold: number,
  categories?: PlanningDocCategory[]
): Promise<DatabaseQueryResult[]> {
  // Convert embedding array to PostgreSQL vector format string
  const embeddingString = `[${queryEmbedding.join(',')}]`;

  // Build the SQL query using RPC for vector operations
  // We'll use a raw query approach since Supabase doesn't have built-in vector search helpers

  // First, try to use an RPC function if it exists (more efficient)
  // Fall back to a direct query if not available

  try {
    // Direct SQL query approach using the embeddings table
    // The <=> operator computes cosine distance, so similarity = 1 - distance
    const { data, error } = await client.rpc('search_planning_embeddings', {
      query_embedding: embeddingString,
      match_limit: limit,
      similarity_threshold: similarityThreshold,
      filter_categories: categories || null,
    });

    if (error) {
      // If RPC doesn't exist, fall back to direct query
      if (error.code === 'PGRST202' || error.message.includes('function')) {
        console.log('[planning-rag-query] RPC not found, using fallback query');
        return await searchWithDirectQuery(
          client,
          embeddingString,
          limit,
          similarityThreshold,
          categories
        );
      }
      throw new Error(`Failed to search embeddings: ${error.message}`);
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      doc_id: row.doc_id as string,
      chunk_index: row.chunk_index as number,
      chunk_text: row.chunk_text as string,
      embedding: row.embedding as number[],
      metadata: row.metadata as DatabaseQueryResult['metadata'],
      similarity: row.similarity as number,
    }));
  } catch (error) {
    // Try fallback approach
    console.log('[planning-rag-query] Using fallback query due to error:', error);
    return await searchWithDirectQuery(
      client,
      embeddingString,
      limit,
      similarityThreshold,
      categories
    );
  }
}

/**
 * Fallback search using direct SQL query via Supabase.
 * Used when the RPC function is not available.
 */
async function searchWithDirectQuery(
  client: SupabaseClient,
  embeddingString: string,
  limit: number,
  similarityThreshold: number,
  categories?: PlanningDocCategory[]
): Promise<DatabaseQueryResult[]> {
  // Build category filter condition
  let categoryCondition = '';
  if (categories && categories.length > 0) {
    const categoryList = categories.map((c) => `'${c}'`).join(',');
    categoryCondition = `AND metadata->>'category' IN (${categoryList})`;
  }

  // Use raw SQL through Supabase
  // Note: Supabase doesn't support raw SQL directly in the JS client
  // We need to use the RPC approach or create a database function

  // For now, we'll fetch all embeddings and compute similarity in JS
  // This is less efficient but works as a fallback
  console.log('[planning-rag-query] Using JavaScript-based similarity computation');

  const query = client
    .from('planning_embeddings')
    .select('id, doc_id, chunk_index, chunk_text, embedding, metadata');

  // Apply category filter if provided (done post-fetch since JSONB filtering is complex)

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch embeddings: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Parse the query embedding
  const queryVector = JSON.parse(embeddingString);

  // Compute cosine similarity for each embedding
  const results = data
    .map((row) => {
      // Parse embedding if it's a string
      let embedding = row.embedding;
      if (typeof embedding === 'string') {
        try {
          embedding = JSON.parse(embedding);
        } catch {
          return null;
        }
      }

      // Filter by category if needed
      if (categories && categories.length > 0) {
        const rowCategory = row.metadata?.category;
        if (!rowCategory || !categories.includes(rowCategory)) {
          return null;
        }
      }

      const similarity = cosineSimilarity(queryVector, embedding);

      return {
        id: row.id,
        doc_id: row.doc_id,
        chunk_index: row.chunk_index,
        chunk_text: row.chunk_text,
        embedding: row.embedding,
        metadata: row.metadata,
        similarity,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((row) => row.similarity >= similarityThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results as DatabaseQueryResult[];
}

/**
 * Compute cosine similarity between two vectors.
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
 * Get count of embeddings in planning_embeddings table.
 */
export async function getEmbeddingCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('planning_embeddings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to get embedding count: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get count of documents in planning_docs table.
 */
export async function getDocumentCount(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('planning_docs')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Failed to get document count: ${error.message}`);
  }

  return count || 0;
}
