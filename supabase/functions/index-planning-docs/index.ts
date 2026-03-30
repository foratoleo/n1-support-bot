/**
 * Edge Function: index-planning-docs
 *
 * Indexes planning documentation from docs/planning/ directory into the
 * dedicated Planning RAG Supabase instance.
 *
 * Process:
 * 1. Reads markdown files from docs/planning/ (routes, components, hooks, api, data-models)
 * 2. Chunks documents into 500-1000 token segments with overlap
 * 3. Generates embeddings via OpenAI text-embedding-ada-002 (1536 dimensions)
 * 4. Stores documents and embeddings in planning_docs and planning_embeddings tables
 *
 * @module index-planning-docs
 */

import { corsHeaders } from '../_shared/cors.ts';
import type {
  IndexPlanningDocsRequest,
  IndexPlanningDocsResponse,
  ProcessedFileDetails,
  PlanningDocCategory,
  PlanningFileInfo,
} from './types.ts';
import { chunkPlanningDoc, estimateDocumentTokens } from './chunker.ts';
import { generateEmbeddings, getEmbeddingDimensions } from './embeddings.ts';
import {
  createPlanningRagClient,
  upsertPlanningDoc,
  deleteEmbeddingsForDoc,
  insertEmbeddings,
  updateDocChunkInfo,
  getDocumentCount,
  getEmbeddingCount,
} from './planning-rag-client.ts';

const OPERATION = 'index-planning-docs';

/**
 * Map directory name to document category.
 */
function getCategoryFromPath(relativePath: string): PlanningDocCategory {
  const parts = relativePath.split('/');
  const dirName = parts[0]?.toLowerCase();

  switch (dirName) {
    case 'routes':
      return 'route';
    case 'components':
      return 'component';
    case 'hooks':
      return 'hook';
    case 'api':
      return 'api';
    case 'data-models':
      return 'data-model';
    default:
      return 'route'; // Default fallback
  }
}

/**
 * Extract title from markdown content (first H1 or file name).
 */
function extractTitle(content: string, fileName: string): string {
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  // Convert file name to title
  return fileName
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get file extension.
 */
function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.');
  return lastDot >= 0 ? path.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Build CORS response.
 */
function createCorsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Build JSON response with CORS headers.
 */
function createResponse(body: IndexPlanningDocsResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Read documentation files from the docs/planning directory.
 * Since Edge Functions run in Deno, we need to use Deno.readDir.
 */
async function readDocumentationFiles(
  specificPaths?: string[],
): Promise<PlanningFileInfo[]> {
  const files: PlanningFileInfo[] = [];
  const basePath = './docs/planning';

  // Categories to scan
  const categories = ['routes', 'components', 'hooks', 'api', 'data-models'];

  async function scanDirectory(dirPath: string, category: PlanningDocCategory): Promise<void> {
    try {
      const entries = Deno.readDir(dirPath);

      for await (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.isDirectory) {
          // Recursively scan subdirectories
          await scanDirectory(fullPath, category);
        } else if (entry.isFile && getExtension(entry.name) === 'md') {
          const relativePath = fullPath.replace('./docs/planning/', '');

          // If specific paths provided, only process those
          if (specificPaths && !specificPaths.includes(relativePath)) {
            continue;
          }

          try {
            const content = await Deno.readTextFile(fullPath);
            const stat = await Deno.stat(fullPath);

            files.push({
              path: fullPath,
              relative_path: relativePath,
              category,
              name: entry.name.replace(/\.md$/, ''),
              content,
              size: stat.size,
              modified_at: stat.mtime,
            });
          } catch (readError) {
            console.error(`[${OPERATION}] Failed to read ${fullPath}:`, readError);
          }
        }
      }
    } catch (dirError) {
      // Directory doesn't exist or can't be read - skip
      console.warn(`[${OPERATION}] Could not read directory ${dirPath}:`, dirError);
    }
  }

  // Scan each category directory
  for (const category of categories) {
    const categoryPath = `${basePath}/${category}`;
    await scanDirectory(categoryPath, category.replace('-models', '-model') as PlanningDocCategory);
  }

  // Also check for README.md in the base docs/planning directory
  try {
    const readmePath = `${basePath}/README.md`;
    const content = await Deno.readTextFile(readmePath);
    const stat = await Deno.stat(readmePath);

    if (!specificPaths || specificPaths.includes('README.md')) {
      files.push({
        path: readmePath,
        relative_path: 'README.md',
        category: 'route', // Treat README as route (overview)
        name: 'README',
        content,
        size: stat.size,
        modified_at: stat.mtime,
      });
    }
  } catch {
    // README doesn't exist - skip
  }

  return files;
}

/**
 * Process a single documentation file.
 */
async function processFile(
  file: PlanningFileInfo,
  client: ReturnType<typeof createPlanningRagClient>,
  openaiApiKey: string,
  forceReindex: boolean,
  dryRun: boolean,
): Promise<ProcessedFileDetails> {
  const result: ProcessedFileDetails = {
    file_path: file.relative_path,
    category: file.category,
    chunks: 0,
    embeddings: 0,
    is_new: false,
  };

  try {
    // Extract title from content
    const title = extractTitle(file.content, file.name);

    // Estimate tokens for logging
    const docTokens = estimateDocumentTokens(file.content);
    console.log(
      `[${OPERATION}] Processing ${file.relative_path} (~${docTokens} tokens)`,
    );

    if (dryRun) {
      // In dry run, just chunk and estimate
      const chunks = chunkPlanningDoc(file.content, title);
      result.chunks = chunks.length;
      result.embeddings = chunks.length;
      return result;
    }

    // Upsert document in database
    const { doc, isNew } = await upsertPlanningDoc(
      client,
      file.relative_path,
      title,
      file.category,
      file.content,
    );

    result.is_new = isNew;

    // If document wasn't updated and not forcing reindex, skip embedding generation
    if (!isNew && !forceReindex) {
      console.log(`[${OPERATION}] Document unchanged, skipping: ${file.relative_path}`);
      return result;
    }

    // Delete existing embeddings for this document
    await deleteEmbeddingsForDoc(client, doc.id);

    // Chunk the document
    const chunks = chunkPlanningDoc(file.content, title);
    result.chunks = chunks.length;

    if (chunks.length === 0) {
      console.log(`[${OPERATION}] No chunks generated for: ${file.relative_path}`);
      return result;
    }

    // Generate embeddings
    const embeddingResults = await generateEmbeddings(chunks, openaiApiKey);
    result.embeddings = embeddingResults.length;

    if (embeddingResults.length === 0) {
      console.warn(`[${OPERATION}] No embeddings generated for: ${file.relative_path}`);
      return result;
    }

    // Insert embeddings into database
    await insertEmbeddings(
      client,
      doc.id,
      embeddingResults.map((r) => ({
        chunkIndex: r.chunk.chunk_index,
        chunkText: r.chunk.content,
        embedding: r.embedding,
        metadata: {
          title,
          category: file.category,
          section: r.chunk.section,
          file_path: file.relative_path,
          token_count: r.chunk.tokenCount,
        },
      })),
    );

    // Update document metadata with chunk count
    await updateDocChunkInfo(client, doc.id, chunks.length);

    console.log(
      `[${OPERATION}] Indexed ${file.relative_path}: ${chunks.length} chunks, ${embeddingResults.length} embeddings`,
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${OPERATION}] Failed to process ${file.relative_path}:`, errorMessage);
    result.error = errorMessage;
    return result;
  }
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  const startTime = Date.now();

  try {
    // Validate method
    if (req.method !== 'POST') {
      return createResponse(
        { success: false, error: 'Method not allowed. Use POST.', documents_processed: 0, chunks_created: 0, embeddings_generated: 0, processing_time_ms: 0 },
        405,
      );
    }

    // Parse request body (all params optional)
    let body: IndexPlanningDocsRequest = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      // Empty body is valid - use defaults
    }

    const { force_reindex = false, file_paths, dry_run = false } = body;

    console.log(
      `[${OPERATION}] Starting indexing. force_reindex=${force_reindex}, dry_run=${dry_run}, specific_files=${file_paths?.length || 'all'}`,
    );

    // Validate environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Create Planning RAG client
    const client = createPlanningRagClient();

    // Read documentation files
    const files = await readDocumentationFiles(file_paths);

    if (files.length === 0) {
      console.log(`[${OPERATION}] No documentation files found`);

      return createResponse(
        {
          success: true,
          documents_processed: 0,
          chunks_created: 0,
          embeddings_generated: 0,
          processing_time_ms: Date.now() - startTime,
          processed_files: [],
        },
        200,
      );
    }

    console.log(`[${OPERATION}] Found ${files.length} documentation files to process`);

    // Process each file
    const processedFiles: ProcessedFileDetails[] = [];
    let totalChunks = 0;
    let totalEmbeddings = 0;

    for (const file of files) {
      const result = await processFile(
        file,
        client,
        openaiApiKey,
        force_reindex,
        dry_run,
      );
      processedFiles.push(result);
      totalChunks += result.chunks;
      totalEmbeddings += result.embeddings;
    }

    const elapsed = Date.now() - startTime;

    // Get final counts from database (unless dry run)
    let finalDocCount = files.length;
    let finalEmbeddingCount = totalEmbeddings;

    if (!dry_run) {
      try {
        finalDocCount = await getDocumentCount(client);
        finalEmbeddingCount = await getEmbeddingCount(client);
      } catch (countError) {
        console.warn(`[${OPERATION}] Could not get final counts:`, countError);
      }
    }

    console.log(
      `[${OPERATION}] Completed in ${elapsed}ms. ` +
      `Files: ${files.length}, Chunks: ${totalChunks}, Embeddings: ${totalEmbeddings}`,
    );

    // Validate embedding dimensions
    const expectedDimensions = getEmbeddingDimensions();
    console.log(`[${OPERATION}] Embedding dimensions: ${expectedDimensions}`);

    const response: IndexPlanningDocsResponse = {
      success: true,
      documents_processed: files.length,
      chunks_created: totalChunks,
      embeddings_generated: totalEmbeddings,
      processing_time_ms: elapsed,
      processed_files: processedFiles,
    };

    return createResponse(response, 200);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${OPERATION}] Fatal error after ${elapsed}ms:`, errorMessage);

    return createResponse(
      {
        success: false,
        error: errorMessage,
        documents_processed: 0,
        chunks_created: 0,
        embeddings_generated: 0,
        processing_time_ms: elapsed,
      },
      500,
    );
  }
});
