/**
 * Supabase client for Planning RAG database
 *
 * Creates a client connected to the dedicated Planning RAG Supabase instance
 * at https://euciehzmtsqcvyopsmgk.supabase.co
 *
 * Uses service role credentials from environment variables for full access
 * to planning_docs and planning_embeddings tables.
 *
 * @module index-planning-docs/planning-rag-client
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import type { PlanningDoc, PlanningEmbedding, PlanningDocMetadata } from './types.ts';

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
 * Calculate checksum for content change detection.
 */
function calculateChecksum(content: string): string {
  if (!content) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  return Array.from(data)
    .reduce((hash, byte) => {
      const newHash = ((hash << 5) - hash) + byte;
      return newHash & newHash;
    }, 0)
    .toString(16);
}

/**
 * Count words in text content.
 */
function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate token count from text.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Insert or update a planning document.
 */
export async function upsertPlanningDoc(
  client: SupabaseClient,
  filePath: string,
  title: string,
  category: string,
  content: string,
): Promise<{ doc: PlanningDoc; isNew: boolean }> {
  const checksum = calculateChecksum(content);
  const wordCount = countWords(content);
  const tokenCount = estimateTokens(content);

  // Check if document already exists
  const { data: existing, error: fetchError } = await client
    .from('planning_docs')
    .select('*')
    .eq('file_path', filePath)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is expected for new docs
    throw new Error(`Failed to check existing document: ${fetchError.message}`);
  }

  const metadata: PlanningDocMetadata = {
    file_name: title,
    file_size: content.length,
    word_count: wordCount,
    token_count: tokenCount,
    is_chunked: false,
    chunk_count: 0,
    content_checksum: checksum,
  };

  if (existing) {
    // Check if content has changed
    const existingMetadata = existing.metadata as PlanningDocMetadata;
    if (existingMetadata?.content_checksum === checksum) {
      // Content unchanged, return existing
      return { doc: existing as PlanningDoc, isNew: false };
    }

    // Update existing document
    const { data: updated, error: updateError } = await client
      .from('planning_docs')
      .update({
        title,
        content,
        category,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update document: ${updateError.message}`);
    }

    return { doc: updated as PlanningDoc, isNew: false };
  }

  // Insert new document
  const { data: inserted, error: insertError } = await client
    .from('planning_docs')
    .insert({
      title,
      content,
      category,
      file_path: filePath,
      metadata,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to insert document: ${insertError.message}`);
  }

  return { doc: inserted as PlanningDoc, isNew: true };
}

/**
 * Delete all embeddings for a document.
 */
export async function deleteEmbeddingsForDoc(
  client: SupabaseClient,
  docId: string,
): Promise<void> {
  const { error } = await client
    .from('planning_embeddings')
    .delete()
    .eq('doc_id', docId);

  if (error) {
    throw new Error(`Failed to delete embeddings: ${error.message}`);
  }
}

/**
 * Insert embeddings for a document.
 */
export async function insertEmbeddings(
  client: SupabaseClient,
  docId: string,
  embeddings: Array<{
    chunkIndex: number;
    chunkText: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  if (embeddings.length === 0) return;

  const rows = embeddings.map((e) => ({
    doc_id: docId,
    chunk_index: e.chunkIndex,
    chunk_text: e.chunkText,
    embedding: JSON.stringify(e.embedding),
    metadata: e.metadata,
  }));

  const { error } = await client
    .from('planning_embeddings')
    .insert(rows);

  if (error) {
    throw new Error(`Failed to insert embeddings: ${error.message}`);
  }
}

/**
 * Update document metadata with chunking info.
 */
export async function updateDocChunkInfo(
  client: SupabaseClient,
  docId: string,
  chunkCount: number,
): Promise<void> {
  // First get current metadata
  const { data: doc, error: fetchError } = await client
    .from('planning_docs')
    .select('metadata')
    .eq('id', docId)
    .single();

  if (fetchError) {
    throw new Error(`Failed to fetch document metadata: ${fetchError.message}`);
  }

  const metadata = {
    ...(doc?.metadata || {}),
    is_chunked: true,
    chunk_count: chunkCount,
  };

  const { error } = await client
    .from('planning_docs')
    .update({ metadata })
    .eq('id', docId);

  if (error) {
    throw new Error(`Failed to update document metadata: ${error.message}`);
  }
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
