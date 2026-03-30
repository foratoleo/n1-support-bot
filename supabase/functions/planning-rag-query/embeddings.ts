/**
 * OpenAI embedding generation for RAG queries
 *
 * Generates vector embeddings for query text via the OpenAI API.
 * Uses text-embedding-ada-002 model with 1536 dimensions.
 *
 * @module planning-rag-query/embeddings
 */

import { DEFAULT_QUERY_CONFIG } from './types.ts';

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
 * Generate an embedding for a single query text via OpenAI API.
 *
 * @param query - The text query to embed
 * @param apiKey - OpenAI API key
 * @returns Array of numbers representing the embedding vector
 * @throws Error if the API call fails
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey: string
): Promise<number[]> {
  // Prepare the query: replace newlines with spaces for better embedding quality
  const normalizedQuery = query.replace(/\n/g, ' ').trim();

  if (!normalizedQuery) {
    throw new Error('Query cannot be empty after normalization');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_QUERY_CONFIG.embeddingModel,
      input: normalizedQuery,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenAI embeddings API error (${response.status}): ${errorBody}`
    );
  }

  const data: OpenAIEmbeddingResponse = await response.json();

  if (!data.data || data.data.length === 0) {
    throw new Error('No embedding returned from OpenAI API');
  }

  const embedding = data.data[0].embedding;

  // Validate embedding dimensions
  if (embedding.length !== DEFAULT_QUERY_CONFIG.embeddingDimensions) {
    console.warn(
      `[planning-rag-query] Unexpected embedding dimensions: ${embedding.length} (expected ${DEFAULT_QUERY_CONFIG.embeddingDimensions})`
    );
  }

  return embedding;
}

/**
 * Get the expected embedding dimensions.
 */
export function getEmbeddingDimensions(): number {
  return DEFAULT_QUERY_CONFIG.embeddingDimensions;
}
