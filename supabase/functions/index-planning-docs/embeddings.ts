/**
 * OpenAI embedding generation for planning documentation
 *
 * Generates vector embeddings via the OpenAI API using direct fetch calls.
 * Uses text-embedding-ada-002 model with 1536 dimensions.
 *
 * @module index-planning-docs/embeddings
 */

import type { ContentChunk, EmbeddingResult } from './types.ts';

const EMBEDDING_MODEL = 'text-embedding-ada-002';
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_BATCH_SIZE = 20;
const BATCH_DELAY_MS = 100;
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
 * Simple delay utility for rate limiting between batches.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate embeddings for an array of content chunks.
 *
 * Processes chunks in batches to avoid API rate limits.
 * Automatically filters out duplicate chunks.
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
  // Remove duplicates
  const uniqueChunks = filterDuplicateChunks(chunks);

  if (uniqueChunks.length === 0) {
    return [];
  }

  const results: EmbeddingResult[] = [];
  const errors: Array<{ batchIndex: number; error: string }> = [];

  for (let i = 0; i < uniqueChunks.length; i += batchSize) {
    const batch = uniqueChunks.slice(
      i,
      Math.min(i + batchSize, uniqueChunks.length),
    );

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
          });
        }

        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const batchNum = Math.floor(i / batchSize) + 1;

        if (attempt < MAX_RETRIES) {
          console.warn(
            `[index-planning-docs] Batch ${batchNum} failed (attempt ${
              attempt + 1
            }/${MAX_RETRIES + 1}): ${lastError.message}. Retrying...`,
          );
          await delay(RETRY_DELAY_MS * (attempt + 1));
        } else {
          console.error(
            `[index-planning-docs] Batch ${batchNum} permanently failed: ${lastError.message}`,
          );
          errors.push({ batchIndex: batchNum, error: lastError.message });
        }
      }
    }

    // Add delay between batches to respect rate limits
    if (i + batchSize < uniqueChunks.length) {
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
      `[index-planning-docs] ${errors.length} batch(es) failed. ` +
        `Successfully embedded ${results.length}/${uniqueChunks.length} chunks.`,
    );
  }

  return results;
}

/**
 * Get the expected embedding dimensions.
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}
