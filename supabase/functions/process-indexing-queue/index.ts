/**
 * process-indexing-queue Edge Function
 *
 * Reads pending items from the indexing_queue table and processes them
 * by chunking content and generating embeddings. Designed to be invoked
 * by a cron job or manually.
 *
 * Uses shared indexing utilities from _shared/indexing/ for chunking and
 * embedding generation, matching the patterns used by index-single-document.
 *
 * @module process-indexing-queue
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { chunkContent } from '../_shared/indexing/chunker.ts';
import { generateEmbeddings } from '../_shared/indexing/embeddings.ts';
import { getTaskNormalizedContent } from '../_shared/indexing/task-content-extractor.ts';
import { getBacklogNormalizedContent } from '../_shared/indexing/backlog-content-extractor.ts';
import { getFeatureNormalizedContent } from '../_shared/indexing/feature-content-extractor.ts';
import { getMeetingNormalizedContent } from '../_shared/indexing/meeting-content-extractor.ts';
import { getGeneratedDocumentNormalizedContent } from '../_shared/indexing/generated-document-content-extractor.ts';
import { getKnowledgeBaseContent } from '../_shared/indexing/knowledge-base-content-extractor.ts';
import { getStyleGuideContent } from '../_shared/indexing/style-guide-content-extractor.ts';
import { resolveContentType } from '../_shared/indexing/types.ts';
import type { IndexingQueueItem, SourceTable } from '../_shared/indexing/types.ts';

const OPERATION = 'process-indexing-queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProcessQueueRequest {
  batch_size?: number;
  max_concurrent?: number;
}

interface ProcessQueueResponse {
  success: boolean;
  total_in_queue: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors?: Array<{ source_table: string; source_id: string; error: string }>;
}

interface ItemResult {
  success: boolean;
  source_table: string;
  source_id: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Concurrency Control
// ---------------------------------------------------------------------------

/**
 * Processes an array of items with a maximum concurrency limit.
 * Instead of launching all tasks at once, it keeps at most `maxConcurrent`
 * promises running in parallel at any given time.
 */
async function processWithConcurrency<T>(
  items: T[],
  maxConcurrent: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = processor(item).then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);

    if (executing.length >= maxConcurrent) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}

// ---------------------------------------------------------------------------
// Content Extraction
// ---------------------------------------------------------------------------

/**
 * Fetches content from the appropriate source table based on the queue item.
 * Returns null if the source record is not found.
 */
async function extractContent(
  supabase: ReturnType<typeof createSupabaseClient>,
  sourceTable: string,
  sourceId: string
): Promise<{ content: string; projectId: string } | null> {
  switch (sourceTable) {
    case 'generated_documents': {
      // Stage 1: Fetch only project_id — avoid transferring the full document body on the happy path
      const { data: docMeta, error: docError } = await supabase
        .from('generated_documents')
        .select('project_id')
        .eq('id', sourceId)
        .single();

      if (docError || !docMeta) {
        console.error(`[${OPERATION}] Failed to fetch generated_documents/${sourceId}:`, docError?.message);
        return null;
      }

      // Stage 2: Try to get normalized content (enriched with meeting, sprint, features, approval, etc.)
      const normalizedContent = await getGeneratedDocumentNormalizedContent(sourceId, docMeta.project_id);

      if (normalizedContent) {
        console.log(`[${OPERATION}] Using normalized content for generated_documents/${sourceId} (${normalizedContent.length} chars)`);
        return { content: normalizedContent, projectId: docMeta.project_id };
      }

      // Fallback: fetch raw content only when normalized path returned nothing
      console.warn(`[${OPERATION}] Falling back to basic extraction for generated_documents/${sourceId}`);
      const { data: docContent, error: contentError } = await supabase
        .from('generated_documents')
        .select('content')
        .eq('id', sourceId)
        .single();

      if (contentError || !docContent) {
        console.error(`[${OPERATION}] Failed to fetch content for generated_documents/${sourceId}:`, contentError?.message);
        return null;
      }

      return { content: docContent.content || '', projectId: docMeta.project_id };
    }

    case 'meeting_transcripts': {
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .select('project_id, transcript_text')
        .eq('id', sourceId)
        .single();

      if (transcriptError || !transcriptData) {
        console.error(`[${OPERATION}] Failed to fetch meeting_transcripts/${sourceId}:`, transcriptError?.message);
        return null;
      }

      // Try to get normalized content (enriched with participants, sprint, etc.)
      const normalizedContent = await getMeetingNormalizedContent(sourceId, transcriptData.project_id);

      if (normalizedContent) {
        console.log(`[${OPERATION}] Using normalized content for meeting_transcripts/${sourceId} (${normalizedContent.length} chars)`);
        return { content: normalizedContent, projectId: transcriptData.project_id };
      }

      // Fallback: only transcript_text if normalized function fails
      console.warn(`[${OPERATION}] Falling back to basic extraction for meeting_transcripts/${sourceId}`);
      return { content: transcriptData.transcript_text || '', projectId: transcriptData.project_id };
    }

    case 'project_documents': {
      const { data, error } = await supabase
        .from('project_documents')
        .select('content, project_id')
        .eq('id', sourceId)
        .single();

      if (error || !data) {
        console.error(`[${OPERATION}] Failed to fetch project_documents/${sourceId}:`, error?.message);
        return null;
      }
      return { content: data.content || '', projectId: data.project_id };
    }

    case 'dev_tasks': {
      // First get project_id for the task
      const { data: taskData, error: taskError } = await supabase
        .from('dev_tasks')
        .select('title, description, project_id')
        .eq('id', sourceId)
        .single();

      if (taskError || !taskData) {
        console.error(`[${OPERATION}] Failed to fetch dev_tasks/${sourceId}:`, taskError?.message);
        return null;
      }

      // Try to get normalized content
      const normalizedContent = await getTaskNormalizedContent(sourceId, taskData.project_id);

      if (normalizedContent) {
        console.log(`[${OPERATION}] Using normalized content for dev_tasks/${sourceId} (${normalizedContent.length} chars)`);
        return { content: normalizedContent, projectId: taskData.project_id };
      }

      // Fallback to basic extraction if normalized record fails
      console.warn(`[${OPERATION}] Falling back to basic extraction for dev_tasks/${sourceId}`);
      const content = [taskData.title, taskData.description].filter(Boolean).join('\n');
      return { content, projectId: taskData.project_id };
    }

    case 'backlog_items': {
      // First get project_id for the backlog item
      const { data: backlogData, error: backlogError } = await supabase
        .from('backlog_items')
        .select('title, description, project_id')
        .eq('id', sourceId)
        .single();

      if (backlogError || !backlogData) {
        console.error(`[${OPERATION}] Failed to fetch backlog_items/${sourceId}:`, backlogError?.message);
        return null;
      }

      // Try to get normalized content
      const normalizedContent = await getBacklogNormalizedContent(sourceId, backlogData.project_id);

      if (normalizedContent) {
        console.log(`[${OPERATION}] Using normalized content for backlog_items/${sourceId} (${normalizedContent.length} chars)`);
        return { content: normalizedContent, projectId: backlogData.project_id };
      }

      // Fallback to basic extraction if normalized record fails
      console.warn(`[${OPERATION}] Falling back to basic extraction for backlog_items/${sourceId}`);
      const content = [backlogData.title, backlogData.description].filter(Boolean).join('\n');
      return { content, projectId: backlogData.project_id };
    }

    case 'features': {
      // First get project_id for the feature
      const { data: featureData, error: featureError } = await supabase
        .from('features')
        .select('title, description, project_id')
        .eq('id', sourceId)
        .single();

      if (featureError || !featureData) {
        console.error(`[${OPERATION}] Failed to fetch features/${sourceId}:`, featureError?.message);
        return null;
      }

      // Try to get normalized content
      const normalizedContent = await getFeatureNormalizedContent(sourceId, featureData.project_id);

      if (normalizedContent) {
        console.log(`[${OPERATION}] Using normalized content for features/${sourceId} (${normalizedContent.length} chars)`);
        return { content: normalizedContent, projectId: featureData.project_id };
      }

      // Fallback to basic extraction if normalized record fails
      console.warn(`[${OPERATION}] Falling back to basic extraction for features/${sourceId}`);
      const content = [featureData.title, featureData.description].filter(Boolean).join('\n');
      return { content, projectId: featureData.project_id };
    }

    case 'company_knowledge_base': {
      const content = await getKnowledgeBaseContent(sourceId);

      if (!content) {
        console.error(`[${OPERATION}] Failed to fetch company_knowledge_base/${sourceId}`);
        return null;
      }

      console.log(`[${OPERATION}] Fetched knowledge base article ${sourceId} (${content.length} chars)`);
      // Knowledge base articles are company-wide; use sentinel project UUID
      return { content, projectId: '00000000-0000-0000-0000-000000000000' };
    }

    case 'style_guides': {
      const content = await getStyleGuideContent(supabase, sourceId);

      if (!content) {
        console.error(`[${OPERATION}] Failed to fetch style_guides/${sourceId}`);
        return null;
      }

      console.log(`[${OPERATION}] Fetched style guide ${sourceId} (${content.length} chars)`);
      // Style guides are company-wide — use sentinel project UUID (same as company_knowledge_base)
      return { content, projectId: '00000000-0000-0000-0000-000000000000' };
    }

    default:
      console.error(`[${OPERATION}] Unknown source_table: ${sourceTable}`);
      return null;
  }
}

// ---------------------------------------------------------------------------
// Queue Item Processing
// ---------------------------------------------------------------------------

/**
 * Processes a single indexing queue item:
 * - DELETE events: remove embeddings for the source
 * - INSERT/UPDATE events: extract content, chunk, embed, and store
 */
async function processItem(
  supabase: ReturnType<typeof createSupabaseClient>,
  item: IndexingQueueItem,
  openaiApiKey: string
): Promise<void> {
  const { id, source_table, source_id, event_type } = item;

  console.log(`[${OPERATION}] Processing item ${id}: ${event_type} on ${source_table}/${source_id}`);

  // Handle DELETE events
  if (event_type === 'DELETE') {
    const { error } = await supabase
      .from('document_embeddings')
      .delete()
      .eq('source_table', source_table)
      .eq('source_id', source_id);

    if (error) {
      throw new Error(`Failed to delete embeddings for ${source_table}/${source_id}: ${error.message}`);
    }

    console.log(`[${OPERATION}] Deleted embeddings for ${source_table}/${source_id}`);
    return;
  }

  // Handle INSERT/UPDATE events
  const extracted = await extractContent(supabase, source_table, source_id);

  if (!extracted) {
    throw new Error(`Source record not found: ${source_table}/${source_id}`);
  }

  if (!extracted.content || extracted.content.trim().length === 0) {
    console.warn(`[${OPERATION}] Empty content for ${source_table}/${source_id}. Skipping embedding generation.`);
    // Still mark as completed since there is nothing to index
    return;
  }

  // Step 1: Chunk content
  const chunks = chunkContent(
    extracted.content,
    source_table as SourceTable,
    source_id,
  );

  if (chunks.length === 0) {
    console.warn(`[${OPERATION}] No chunks produced for ${source_table}/${source_id}. Content may be too short.`);
    return;
  }

  console.log(`[${OPERATION}] Produced ${chunks.length} chunks for ${source_table}/${source_id}`);

  // Step 2: Generate embeddings
  const embeddings = await generateEmbeddings(chunks, openaiApiKey);

  console.log(`[${OPERATION}] Generated ${embeddings.length} embeddings for ${source_table}/${source_id}`);

  // Step 3: Delete old embeddings for this source
  const { error: deleteError } = await supabase
    .from('document_embeddings')
    .delete()
    .eq('source_table', source_table)
    .eq('source_id', source_id);

  if (deleteError) {
    console.error(`[${OPERATION}] Failed to delete old embeddings for ${source_table}/${source_id}:`, deleteError.message);
    // Continue anyway - insert will work, just might have duplicates temporarily
  }

  // Step 4: Insert new embeddings
  const insertData = embeddings.map((result) => ({
    content_chunk: result.chunk.content,
    source_table: result.chunk.metadata.sourceTable,
    source_id: result.chunk.metadata.sourceId,
    chunk_index: result.chunk.metadata.chunkIndex,
    embedding: JSON.stringify(result.embedding),
    project_id: extracted.projectId,
    metadata: result.chunk.metadata,
    checksum: result.chunk.checksum,
    token_count: result.tokenCount,
    content_type: resolveContentType(source_table as SourceTable, result.chunk.metadata),
  }));

  const { error: insertError } = await supabase
    .from('document_embeddings')
    .insert(insertData);

  if (insertError) {
    throw new Error(`Failed to insert embeddings for ${source_table}/${source_id}: ${insertError.message}`);
  }

  console.log(`[${OPERATION}] Successfully indexed ${source_table}/${source_id} (${embeddings.length} embeddings)`);
}

// ---------------------------------------------------------------------------
// Queue Status Updates (via complete_queue_item RPC)
// ---------------------------------------------------------------------------

async function markItemCompleted(
  supabase: ReturnType<typeof createSupabaseClient>,
  itemId: string,
): Promise<void> {
  const { error } = await supabase.rpc('complete_queue_item', {
    item_id: itemId,
    success: true,
    error_msg: null,
  });

  if (error) {
    console.error(`[${OPERATION}] Failed to mark item ${itemId} as completed:`, error.message);
  }
}

async function markItemFailed(
  supabase: ReturnType<typeof createSupabaseClient>,
  itemId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase.rpc('complete_queue_item', {
    item_id: itemId,
    success: false,
    error_msg: errorMessage,
  });

  if (error) {
    console.error(`[${OPERATION}] Failed to mark item ${itemId} as failed:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Validate method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed. Use POST.' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body (all params optional)
    let body: ProcessQueueRequest = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is valid - use defaults
    }

    const batchSize = Math.min(Math.max(body.batch_size || 10, 1), 50);
    const maxConcurrent = Math.min(Math.max(body.max_concurrent || 3, 1), 10);

    console.log(`[${OPERATION}] Starting queue processing. batch_size=${batchSize}, max_concurrent=${maxConcurrent}`);

    // Validate environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Dequeue items atomically using the database function
    const { data: queueItems, error: dequeueError } = await supabase
      .rpc('dequeue_indexing_batch', { batch_size: batchSize });

    if (dequeueError) {
      console.error(`[${OPERATION}] Failed to dequeue items:`, dequeueError.message);
      throw new Error(`Failed to dequeue items: ${dequeueError.message}`);
    }

    const items: IndexingQueueItem[] = queueItems || [];

    if (items.length === 0) {
      console.log(`[${OPERATION}] No pending items in queue`);

      // Get total pending items count for reporting
      const { count } = await supabase
        .from('indexing_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      const response: ProcessQueueResponse = {
        success: true,
        total_in_queue: count || 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${OPERATION}] Dequeued ${items.length} items for processing`);

    // Process items with controlled concurrency
    const results: ItemResult[] = [];

    await processWithConcurrency(items, maxConcurrent, async (item: IndexingQueueItem) => {
      try {
        await processItem(supabase, item, openaiApiKey);
        await markItemCompleted(supabase, item.id);
        results.push({
          success: true,
          source_table: item.source_table,
          source_id: item.source_id,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${OPERATION}] Error processing item ${item.id}:`, errorMessage);

        await markItemFailed(supabase, item.id, errorMessage);
        results.push({
          success: false,
          source_table: item.source_table,
          source_id: item.source_id,
          error: errorMessage,
        });
      }
    });

    // Compute summary
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const errors = results
      .filter((r) => !r.success)
      .map((r) => ({
        source_table: r.source_table,
        source_id: r.source_id,
        error: r.error || 'Unknown error',
      }));

    // Get total pending items count for reporting
    const { count: totalCount } = await supabase
      .from('indexing_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    const elapsed = Date.now() - startTime;
    console.log(
      `[${OPERATION}] Completed in ${elapsed}ms. ` +
      `Processed: ${items.length}, Succeeded: ${succeeded}, Failed: ${failed}`
    );

    const response: ProcessQueueResponse = {
      success: true,
      total_in_queue: totalCount || 0,
      processed: items.length,
      succeeded,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${OPERATION}] Fatal error after ${elapsed}ms:`, errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
