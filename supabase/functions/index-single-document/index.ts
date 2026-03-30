/**
 * Edge Function: index-single-document
 *
 * @deprecated Esta funcao nao e invocada por nenhum codigo em producao.
 * O fluxo principal de indexacao utiliza process-indexing-queue (via cron).
 * Mantida apenas como referencia. Usar process-indexing-queue para novas implementacoes.
 *
 * Indexes a single document for RAG by extracting its content, chunking it,
 * generating embeddings via OpenAI, and storing them in the document_embeddings table.
 *
 * Supports INSERT, UPDATE, and DELETE event types:
 * - INSERT/UPDATE: Fetches the record, extracts content, chunks, embeds, and stores
 * - DELETE: Removes all existing embeddings for the given source
 *
 * @module index-single-document
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { chunkContent } from '../_shared/indexing/chunker.ts';
import { generateEmbeddings } from '../_shared/indexing/embeddings.ts';
import { getMeetingNormalizedContent } from '../_shared/indexing/meeting-content-extractor.ts';
import { getKnowledgeBaseContent } from '../_shared/indexing/knowledge-base-content-extractor.ts';
import { resolveContentType } from '../_shared/indexing/types.ts';
import type {
  IndexDocumentRequest,
  IndexDocumentResponse,
  SourceTable,
  EmbeddingInsertRow,
} from '../_shared/indexing/types.ts';

const OPERATION = 'index-single-document';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a JSON response with CORS headers.
 */
function createResponse(body: IndexDocumentResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Build a CORS-only preflight response.
 */
function createCorsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Validate the incoming request body.
 * Returns an error message if invalid, or null if valid.
 */
function validateRequest(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body is required';
  }

  const req = body as Record<string, unknown>;

  if (!req.source_table || typeof req.source_table !== 'string') {
    return 'source_table is required';
  }

  const validTables: SourceTable[] = [
    'generated_documents',
    'meeting_transcripts',
    'project_documents',
    'dev_tasks',
    'backlog_items',
    'features',
    'company_knowledge_base',
  ];
  if (!validTables.includes(req.source_table as SourceTable)) {
    return `source_table must be one of: ${validTables.join(', ')}`;
  }

  if (!req.source_id || typeof req.source_id !== 'string') {
    return 'source_id is required';
  }

  if (!req.project_id || typeof req.project_id !== 'string') {
    return 'project_id is required';
  }

  if (!req.event_type || typeof req.event_type !== 'string') {
    return 'event_type is required';
  }

  const validEvents = ['INSERT', 'UPDATE', 'DELETE'];
  if (!validEvents.includes(req.event_type as string)) {
    return `event_type must be one of: ${validEvents.join(', ')}`;
  }

  return null;
}

/**
 * Extract text content from a source record based on its table type.
 * For meeting_transcripts, fetches enriched normalized content via
 * get-meeting-normalized-record Edge Function (participants, sprint, etc.),
 * falling back to transcript_text if the normalized fetch fails.
 */
async function extractContent(
  sourceTable: SourceTable,
  record: Record<string, unknown>,
): Promise<string> {
  switch (sourceTable) {
    case 'generated_documents':
      return String(record.content || '');
    case 'meeting_transcripts': {
      const transcriptId = String(record.id || '');
      const projectId = String(record.project_id || '');

      if (transcriptId && projectId) {
        const normalizedContent = await getMeetingNormalizedContent(transcriptId, projectId);
        if (normalizedContent) {
          console.log(
            `[${OPERATION}] Using normalized content for meeting_transcripts/${transcriptId} (${normalizedContent.length} chars)`,
          );
          return normalizedContent;
        }
        console.warn(
          `[${OPERATION}] Falling back to basic extraction for meeting_transcripts/${transcriptId}`,
        );
      }

      return String(record.transcript_text || '');
    }
    case 'project_documents':
      return `${String(record.description || '')}\n${String(record.content || '')}`;
    case 'dev_tasks':
      return `${String(record.title || '')}\n${String(record.description || '')}`;
    case 'backlog_items':
      return `${String(record.title || '')}\n${String(record.description || '')}`;
    case 'features':
      return `${String(record.title || '')}\n${String(record.description || '')}`;
    case 'company_knowledge_base': {
      const articleId = String(record.id || '');
      if (!articleId) {
        console.warn(`[${OPERATION}] Missing id for company_knowledge_base record`);
        return '';
      }
      const content = await getKnowledgeBaseContent(articleId);
      if (!content) {
        console.warn(`[${OPERATION}] No content fetched for knowledge base article ${articleId}`);
        return '';
      }
      return content;
    }
    default:
      return String(record.content || '');
  }
}

/**
 * Delete all existing embeddings for a given source_table + source_id.
 */
async function deleteExistingEmbeddings(
  supabase: ReturnType<typeof createSupabaseClient>,
  sourceTable: string,
  sourceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('document_embeddings')
    .delete()
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId);

  if (error) {
    console.error(`[${OPERATION}] Error deleting embeddings:`, error);
    throw new Error(`Failed to delete existing embeddings: ${error.message}`);
  }
}

/**
 * Mark a queue item as completed by calling the complete_queue_item RPC.
 */
async function completeQueueItem(
  supabase: ReturnType<typeof createSupabaseClient>,
  queueItemId: string,
): Promise<void> {
  const { error } = await supabase.rpc('complete_queue_item', {
    item_id: queueItemId,
    success: true,
    error_msg: null,
  });

  if (error) {
    // Non-fatal: log but don't throw
    console.warn(
      `[${OPERATION}] Failed to complete queue item ${queueItemId}:`,
      error.message,
    );
  }
}

/**
 * Mark a queue item as failed by calling the complete_queue_item RPC.
 */
async function failQueueItem(
  supabase: ReturnType<typeof createSupabaseClient>,
  queueItemId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase.rpc('complete_queue_item', {
    item_id: queueItemId,
    success: false,
    error_msg: errorMessage,
  });

  if (error) {
    // Non-fatal: log but don't throw
    console.warn(
      `[${OPERATION}] Failed to mark queue item ${queueItemId} as failed:`,
      error.message,
    );
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  // Validate environment and initialize clients inside handler for graceful error responses
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    return createResponse(
      { success: false, error: 'OPENAI_API_KEY environment variable is not configured' },
      500,
    );
  }

  const supabase = createSupabaseClient();

  // Track queue_item_id outside try block for error handling
  let queueItemId: string | undefined;

  try {
    // Validate method
    if (req.method !== 'POST') {
      return createResponse(
        { success: false, error: 'Method not allowed. Use POST.' },
        405,
      );
    }

    // Parse body
    const body: IndexDocumentRequest = await req.json();

    // Validate request
    const validationError = validateRequest(body);
    if (validationError) {
      return createResponse({ success: false, error: validationError }, 400);
    }

    const { source_table, source_id, project_id, event_type, queue_item_id } = body;
    queueItemId = queue_item_id;

    console.log(
      `[${OPERATION}] Processing ${event_type} for ${source_table}/${source_id} ` +
      `(project: ${project_id})`,
    );

    // --- DELETE event ---
    if (event_type === 'DELETE') {
      await deleteExistingEmbeddings(supabase, source_table, source_id);

      console.log(
        `[${OPERATION}] Deleted embeddings for ${source_table}/${source_id}`,
      );

      if (queueItemId) {
        await completeQueueItem(supabase, queueItemId);
      }

      return createResponse({ success: true, chunks_processed: 0 }, 200);
    }

    // --- INSERT / UPDATE event ---

    // 1. Fetch the source record
    const { data: record, error: fetchError } = await supabase
      .from(source_table)
      .select('*')
      .eq('id', source_id)
      .single();

    if (fetchError || !record) {
      const msg = fetchError
        ? `Failed to fetch record: ${fetchError.message}`
        : `Record not found: ${source_table}/${source_id}`;
      console.error(`[${OPERATION}] ${msg}`);
      return createResponse({ success: false, error: msg }, 404);
    }

    // 2. Extract content
    const content = await extractContent(source_table, record as Record<string, unknown>);

    if (!content || content.trim().length === 0) {
      console.log(
        `[${OPERATION}] No content to index for ${source_table}/${source_id}. Skipping.`,
      );

      if (queueItemId) {
        await completeQueueItem(supabase, queueItemId);
      }

      return createResponse({ success: true, chunks_processed: 0 }, 200);
    }

    // 3. Chunk the content
    const chunks = chunkContent(content, source_table, source_id, {
      title: (record as Record<string, unknown>).title as string | undefined,
    });

    if (chunks.length === 0) {
      console.log(
        `[${OPERATION}] Content too short to chunk for ${source_table}/${source_id}. Skipping.`,
      );

      if (queueItemId) {
        await completeQueueItem(supabase, queueItemId);
      }

      return createResponse({ success: true, chunks_processed: 0 }, 200);
    }

    console.log(
      `[${OPERATION}] Created ${chunks.length} chunks for ${source_table}/${source_id}`,
    );

    // 4. Generate embeddings
    const embeddingResults = await generateEmbeddings(chunks, OPENAI_API_KEY);

    if (embeddingResults.length === 0) {
      console.warn(
        `[${OPERATION}] No embeddings generated for ${source_table}/${source_id}`,
      );

      if (queueItemId) {
        await completeQueueItem(supabase, queueItemId);
      }

      return createResponse({ success: true, chunks_processed: 0 }, 200);
    }

    console.log(
      `[${OPERATION}] Generated ${embeddingResults.length} embeddings for ${source_table}/${source_id}`,
    );

    // 5. Delete old embeddings for this source (before inserting new ones)
    await deleteExistingEmbeddings(supabase, source_table, source_id);

    // 6. Insert new embeddings
    const insertRows: EmbeddingInsertRow[] = embeddingResults.map((result) => ({
      content_chunk: result.chunk.content,
      source_table: result.chunk.metadata.sourceTable,
      source_id: result.chunk.metadata.sourceId,
      chunk_index: result.chunk.metadata.chunkIndex,
      embedding: JSON.stringify(result.embedding),
      project_id,
      metadata: result.chunk.metadata,
      checksum: result.chunk.checksum,
      token_count: result.tokenCount,
      content_type: resolveContentType(source_table, result.chunk.metadata),
    }));

    const { error: insertError } = await supabase
      .from('document_embeddings')
      .insert(insertRows);

    if (insertError) {
      console.error(`[${OPERATION}] Error inserting embeddings:`, insertError);
      throw new Error(`Failed to insert embeddings: ${insertError.message}`);
    }

    console.log(
      `[${OPERATION}] Successfully indexed ${embeddingResults.length} chunks ` +
      `for ${source_table}/${source_id}`,
    );

    // 7. Complete queue item if provided
    if (queueItemId) {
      await completeQueueItem(supabase, queueItemId);
    }

    return createResponse(
      { success: true, chunks_processed: embeddingResults.length },
      200,
    );

  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'Internal server error';

    // Mark queue item as failed so it can be retried
    if (queueItemId) {
      await failQueueItem(supabase, queueItemId, errorMessage);
    }

    const statusCode = errorMessage.includes('Method not allowed')
      ? 405
      : errorMessage.includes('required')
      ? 400
      : 500;

    return createResponse({ success: false, error: errorMessage }, statusCode);
  }
});
