/**
 * OpenAI embedding generation for Deno Edge Functions
 *
 * Generates vector embeddings via the OpenAI API using direct fetch calls.
 * Supports batch processing with configurable batch sizes and automatic
 * rate limit handling with delays between batches.
 *
 * @module _shared/indexing/embeddings
 */

import type { ContentChunk, EmbeddingResult } from './types.ts';

const EMBEDDING_MODEL = 'text-embedding-ada-002';
const DEFAULT_BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;
const MAX_TOKENS_PER_INPUT = 8000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * OpenAI embeddings API response structure
 */
interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate embeddings for a batch of text inputs via OpenAI API.
 *
 * @param inputs - Array of text strings to embed
 * @param apiKey - OpenAI API key
 * @returns OpenAI embedding response with vectors
 * @throws Error if the API call fails
 */
async function callOpenAIEmbeddings(
  inputs: string[],
  apiKey: string,
): Promise<OpenAIEmbeddingResponse> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: inputs,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenAI embeddings API error (${response.status}): ${errorBody}`,
    );
  }

  return response.json();
}

/**
 * Filter out duplicate chunks based on checksum.
 */
function filterDuplicateChunks(chunks: ContentChunk[]): ContentChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.checksum)) {
      return false;
    }
    seen.add(chunk.checksum);
    return true;
  });
}

/**
 * Filter out chunks that exceed the maximum token limit for embeddings.
 */
function filterOversizedChunks(chunks: ContentChunk[]): ContentChunk[] {
  return chunks.filter((chunk) => {
    if (chunk.tokenCount > MAX_TOKENS_PER_INPUT) {
      console.warn(
        `[indexing] Skipping chunk with ~${chunk.tokenCount} tokens (exceeds ${MAX_TOKENS_PER_INPUT} limit). ` +
        `Source: ${chunk.metadata.sourceTable}/${chunk.metadata.sourceId}, index: ${chunk.metadata.chunkIndex}`,
      );
      return false;
    }
    return true;
  });
}

/**
 * Simple delay utility for rate limiting between batches.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for an array of content chunks.
 *
 * Processes chunks in batches to avoid API rate limits and payload size limits.
 * Automatically filters out duplicate and oversized chunks.
 *
 * @param chunks - Content chunks to generate embeddings for
 * @param apiKey - OpenAI API key
 * @param batchSize - Number of chunks per API call. Default: 20
 * @returns Array of embedding results with vectors and metadata
 */
export async function generateEmbeddings(
  chunks: ContentChunk[],
  apiKey: string,
  batchSize: number = DEFAULT_BATCH_SIZE,
): Promise<EmbeddingResult[]> {
  // Remove duplicates and oversized chunks
  const uniqueChunks = filterDuplicateChunks(chunks);
  const validChunks = filterOversizedChunks(uniqueChunks);

  if (validChunks.length === 0) {
    return [];
  }

  const results: EmbeddingResult[] = [];
  const errors: Array<{ batchIndex: number; error: string }> = [];

  for (let i = 0; i < validChunks.length; i += batchSize) {
    const batch = validChunks.slice(i, Math.min(i + batchSize, validChunks.length));

    // Prepare inputs: replace newlines with spaces for better embedding quality
    const inputs = batch.map((chunk) => chunk.content.replace(/\n/g, ' '));

    // Retry logic for transient API failures
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await callOpenAIEmbeddings(inputs, apiKey);

        for (let j = 0; j < batch.length; j++) {
          results.push({
            chunk: batch[j],
            embedding: response.data[j].embedding,
            tokenCount: batch[j].tokenCount,
          });
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const batchNum = Math.floor(i / batchSize) + 1;

        if (attempt < MAX_RETRIES) {
          console.warn(
            `[indexing] Batch ${batchNum} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${lastError.message}. Retrying...`,
          );
          await delay(RETRY_DELAY_MS * (attempt + 1));
        } else {
          console.error(
            `[indexing] Batch ${batchNum} permanently failed after ${MAX_RETRIES + 1} attempts: ${lastError.message}`,
          );
          errors.push({ batchIndex: batchNum, error: lastError.message });
        }
      }
    }

    // Add delay between batches to respect rate limits
    if (i + batchSize < validChunks.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  // If all batches failed, throw to signal complete failure
  if (results.length === 0 && errors.length > 0) {
    throw new Error(
      `All embedding batches failed. First error: ${errors[0].error}`,
    );
  }

  if (errors.length > 0) {
    console.warn(
      `[indexing] ${errors.length} batch(es) failed out of ${Math.ceil(validChunks.length / batchSize)}. ` +
      `Successfully embedded ${results.length}/${validChunks.length} chunks.`,
    );
  }

  return results;
}
