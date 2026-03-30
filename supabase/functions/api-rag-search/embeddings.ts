/**
 * OpenAI embedding generation for RAG queries
 *
 * Generates vector embeddings for query text via the OpenAI API.
 * Uses text-embedding-ada-002 model with 1536 dimensions.
 * Includes timeout protection and structured error handling.
 *
 * @module api-rag-search/embeddings
 */

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
 * Error classification for embedding generation failures.
 */
export type EmbeddingErrorType =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'INVALID_REQUEST'
  | 'API_ERROR'
  | 'EMPTY_RESPONSE';

/**
 * Structured error from embedding generation.
 */
export interface EmbeddingError {
  type: EmbeddingErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

/**
 * Configuration for embedding generation.
 */
export interface EmbeddingConfig {
  /** OpenAI embedding model */
  model: string;
  /** Embedding dimensions */
  dimensions: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-ada-002',
  dimensions: 1536,
  timeoutMs: 10000, // 10 seconds
};

/**
 * Generate an embedding for a single query text via OpenAI API.
 *
 * @param query - The text query to embed
 * @param apiKey - OpenAI API key
 * @param config - Optional configuration overrides
 * @returns Array of numbers representing the embedding vector
 * @throws EmbeddingError if the API call fails or times out
 */
export async function generateQueryEmbedding(
  query: string,
  apiKey: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<number[]> {
  const cfg = { ...DEFAULT_EMBEDDING_CONFIG, ...config };

  // Prepare the query: replace newlines with spaces for better embedding quality
  const normalizedQuery = query.replace(/\n/g, ' ').trim();

  if (!normalizedQuery) {
    throw {
      type: 'EMPTY_RESPONSE',
      message: 'Query cannot be empty after normalization',
      retryable: false,
    } as EmbeddingError;
  }

  // Create AbortController for timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        input: normalizedQuery,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unable to read error body');

      // Classify error based on status code
      if (response.status === 429) {
        throw {
          type: 'RATE_LIMIT',
          message: `OpenAI rate limit exceeded: ${errorBody}`,
          retryable: true,
          statusCode: 429,
        } as EmbeddingError;
      }

      if (response.status >= 400 && response.status < 500) {
        throw {
          type: 'INVALID_REQUEST',
          message: `Invalid OpenAI request (${response.status}): ${errorBody}`,
          retryable: false,
          statusCode: response.status,
        } as EmbeddingError;
      }

      throw {
        type: 'API_ERROR',
        message: `OpenAI API error (${response.status}): ${errorBody}`,
        retryable: true,
        statusCode: response.status,
      } as EmbeddingError;
    }

    const data: OpenAIEmbeddingResponse = await response.json();

    if (!data.data || data.data.length === 0) {
      throw {
        type: 'EMPTY_RESPONSE',
        message: 'No embedding returned from OpenAI API',
        retryable: false,
      } as EmbeddingError;
    }

    const embedding = data.data[0].embedding;

    // Validate embedding dimensions (log warning but don't fail)
    if (embedding.length !== cfg.dimensions) {
      console.warn(
        `[api-rag-search] Unexpected embedding dimensions: ${embedding.length} (expected ${cfg.dimensions})`
      );
    }

    return embedding;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw {
        type: 'TIMEOUT',
        message: `Embedding generation timed out after ${cfg.timeoutMs}ms`,
        retryable: true,
      } as EmbeddingError;
    }

    // Re-throw if already an EmbeddingError
    if (isEmbeddingError(error)) {
      throw error;
    }

    // Wrap unexpected errors
    throw {
      type: 'API_ERROR',
      message: `Unexpected error during embedding generation: ${error instanceof Error ? error.message : String(error)}`,
      retryable: false,
    } as EmbeddingError;
  }
}

/**
 * Type guard for EmbeddingError.
 */
export function isEmbeddingError(error: unknown): error is EmbeddingError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'message' in error &&
    'retryable' in error
  );
}

/**
 * Get the expected embedding dimensions.
 */
export function getEmbeddingDimensions(): number {
  return DEFAULT_EMBEDDING_CONFIG.dimensions;
}
