// OpenAI Client Module with Robust Error Handling and Monitoring
// Following OpenAI Responses API pattern with comprehensive retry logic and observability

import OpenAI from "https://esm.sh/openai@4.28.0";
import { 
  getOpenAIConfig, 
  getModelConfig, 
  calculateCost as configCalculateCost,
  validateConfiguration,
  type OpenAIConfig,
  type ModelConfig,
  type RetryConfig,
  type PerformanceConfig,
  type CircuitBreakerConfig
} from "../../../src/config/deno-adapter.ts";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * OpenAI API error types for classification and handling
 */
export enum OpenAIErrorType {
  RATE_LIMIT = 'RATE_LIMIT',
  TOKEN_LIMIT = 'TOKEN_LIMIT',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  AUTHENTICATION = 'AUTHENTICATION',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Enhanced error response with detailed context
 */
export interface OpenAIError {
  type: OpenAIErrorType;
  message: string;
  code?: string;
  statusCode?: number;
  retryable: boolean;
  retryAfter?: number; // seconds
  details?: any;
  timestamp: string;
}

/**
 * Request configuration with retry and monitoring options
 * Now integrates with centralized configuration system
 */
export interface OpenAIRequestConfig {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  instructions?: string;
  timeout?: number; // milliseconds
  maxRetries?: number;
  retryDelayMs?: number;
  enableLogging?: boolean;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Response wrapper with usage metrics
 */
export interface OpenAIResponse<T = string> {
  success: boolean;
  data?: T;
  error?: OpenAIError;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
  performance?: {
    requestTime: number;
    retries: number;
    cacheHit: boolean;
  };
  requestId: string;
  timestamp: string;
}

/**
 * Rate limiting state
 */
interface RateLimitState {
  requestsRemaining: number;
  tokensRemaining: number;
  resetTime: number;
  lastRequest: number;
}

/**
 * Circuit breaker state for fault tolerance
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  nextAttempt: number;
}

// ============================================================================
// Configuration and Constants
// ============================================================================

// Configuration now loaded from centralized system
function getDefaultConfig(): Partial<OpenAIRequestConfig> {
  const config = getOpenAIConfig();
  const modelConfig = getModelConfig();
  
  return {
    model: modelConfig.name,
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
    timeout: config.client.timeout,
    maxRetries: config.retry.maxRetries,
    retryDelayMs: config.retry.initialDelay,
    enableLogging: config.performance.enableLogging
  };
}

// Model pricing now comes from centralized configuration via getModelConfig()

// Circuit breaker configuration now loaded from centralized system
function getCircuitBreakerConfig(): CircuitBreakerConfig {
  const config = getOpenAIConfig();
  return config.performance.circuitBreaker;
}

// ============================================================================
// OpenAI Client Implementation
// ============================================================================

export class OpenAIClient {
  private client: OpenAI;
  private rateLimitState: RateLimitState;
  private circuitBreaker: CircuitBreakerState;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor(apiKey?: string, organizationId?: string) {
    // Get configuration from centralized system
    const config = getOpenAIConfig();
    
    // Validate configuration
    const validationErrors = validateConfiguration(config);
    if (validationErrors.length > 0) {
      console.warn('OpenAI configuration validation warnings:', validationErrors);
    }
    
    // Use provided keys or fall back to configuration
    const key = apiKey || config.client.apiKey;
    if (!key) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: key,
      organization: organizationId || config.client.organizationId,
      maxRetries: 0, // We handle retries ourselves for better control
    });

    // Initialize rate limiting state from centralized configuration
    const performanceConfig = config.performance;
    this.rateLimitState = {
      requestsRemaining: performanceConfig.rateLimits.requestsPerMinute,
      tokensRemaining: performanceConfig.rateLimits.tokensPerMinute,
      resetTime: Date.now() + 60000,
      lastRequest: 0
    };

    // Initialize circuit breaker
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED',
      nextAttempt: 0
    };
  }

  /**
   * Main method to create responses with robust error handling using OpenAI Responses API
   */
  async createCompletion(
    prompt: string,
    config: OpenAIRequestConfig = {}
  ): Promise<OpenAIResponse> {
    const startTime = Date.now();
    const requestId = config.requestId || crypto.randomUUID();
    const defaultConfig = getDefaultConfig();
    const mergedConfig = { ...defaultConfig, ...config };

    // Check circuit breaker
    if (!this.isCircuitBreakerAllowing()) {
      return this.createErrorResponse(
        OpenAIErrorType.SERVICE_UNAVAILABLE,
        'Service temporarily unavailable due to repeated failures',
        503,
        false,
        requestId
      );
    }

    // Log request if enabled
    if (mergedConfig.enableLogging) {
      this.logRequest(requestId, prompt, mergedConfig);
    }

    let lastError: OpenAIError | undefined;
    let retries = 0;

    // Retry loop with exponential backoff
    while (retries <= (mergedConfig.maxRetries || 0)) {
      try {
        // Check rate limits
        await this.checkRateLimits();

        // Create response with timeout using Responses API
        const response = await this.createResponseWithTimeout(
          prompt,
          mergedConfig
        );

        // Update rate limit state from response headers
        this.updateRateLimitState(response);

        // Calculate usage and cost - use centralized cost calculation
        const usage = this.calculateUsage(response, mergedConfig.model || getModelConfig().name);

        // Log response if enabled
        if (mergedConfig.enableLogging) {
          this.logResponse(requestId, response, usage, retries);
        }

        // Reset circuit breaker on success
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'CLOSED';

        return {
          success: true,
          data: response.output_text || '',
          usage,
          performance: {
            requestTime: Date.now() - startTime,
            retries,
            cacheHit: false
          },
          requestId,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        lastError = this.classifyError(error);
        
        // Log error
        if (mergedConfig.enableLogging) {
          this.logError(requestId, lastError, retries);
        }

        // Update circuit breaker
        this.updateCircuitBreaker(lastError);

        // Determine if we should retry
        if (!lastError.retryable || retries >= (mergedConfig.maxRetries || 0)) {
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(
          retries,
          mergedConfig.retryDelayMs || 1000,
          lastError.retryAfter
        );

        // Wait before retrying
        await this.delay(delay);
        retries++;
      }
    }

    // Return error response
    return {
      success: false,
      error: lastError,
      performance: {
        requestTime: Date.now() - startTime,
        retries,
        cacheHit: false
      },
      requestId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Stream responses for real-time responses using OpenAI Responses API
   */
  async *streamCompletion(
    prompt: string,
    config: OpenAIRequestConfig = {}
  ): AsyncGenerator<string, void, unknown> {
    const requestId = config.requestId || crypto.randomUUID();
    const defaultConfig = getDefaultConfig();
    const mergedConfig = { ...defaultConfig, ...config };

    try {
      // Check circuit breaker
      if (!this.isCircuitBreakerAllowing()) {
        throw new Error('Service temporarily unavailable');
      }

      // Create streaming response using Responses API with centralized model config
      const modelConfig = getModelConfig(mergedConfig.model);
      const stream = await this.client.responses.create({
        model: modelConfig.name,
        input: prompt,
        instructions: mergedConfig.instructions,
        temperature: mergedConfig.temperature || modelConfig.temperature,
        max_output_tokens: mergedConfig.maxOutputTokens || modelConfig.maxTokens,
        stream: true,
      });

      // Process stream
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') {
          yield event.delta;
        }
      }

    } catch (error) {
      const classifiedError = this.classifyError(error);
      if (mergedConfig.enableLogging) {
        this.logError(requestId, classifiedError, 0);
      }
      throw error;
    }
  }

  /**
   * Create embeddings for text
   */
  async createEmbedding(
    text: string | string[],
    model: string = 'text-embedding-3-small'
  ): Promise<OpenAIResponse<number[][]>> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      const response = await this.client.embeddings.create({
        model,
        input: text,
      });

      const embeddings = response.data.map(d => d.embedding);

      return {
        success: true,
        data: embeddings,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: 0,
          totalTokens: response.usage?.total_tokens || 0,
          estimatedCost: this.calculateEmbeddingCost(
            response.usage?.total_tokens || 0,
            model
          )
        },
        performance: {
          requestTime: Date.now() - startTime,
          retries: 0,
          cacheHit: false
        },
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const classifiedError = this.classifyError(error);
      return {
        success: false,
        error: classifiedError,
        performance: {
          requestTime: Date.now() - startTime,
          retries: 0,
          cacheHit: false
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async createResponseWithTimeout(
    prompt: string,
    config: OpenAIRequestConfig
  ): Promise<any> {
    const controller = new AbortController();
    const modelConfig = getModelConfig(config.model);
    const timeout = setTimeout(() => {
      controller.abort();
    }, config.timeout || modelConfig.timeoutMs);

    try {
      const response = await this.client.responses.create({
        model: modelConfig.name,
        input: prompt,
        instructions: config.instructions,
        temperature: config.temperature || modelConfig.temperature,
        max_output_tokens: config.maxOutputTokens || modelConfig.maxTokens,
        // Note: Responses API doesn't use top_p, frequency_penalty, presence_penalty in the same way
        // signal: controller.signal as any, // TODO: Check if Responses API supports AbortController
      });

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private classifyError(error: any): OpenAIError {
    const timestamp = new Date().toISOString();

    // Handle OpenAI API errors
    if (error?.status) {
      switch (error.status) {
        case 429:
          return {
            type: OpenAIErrorType.RATE_LIMIT,
            message: error.message || 'Rate limit exceeded',
            code: 'rate_limit_exceeded',
            statusCode: 429,
            retryable: true,
            retryAfter: this.extractRetryAfter(error),
            timestamp
          };
        
        case 401:
          return {
            type: OpenAIErrorType.AUTHENTICATION,
            message: error.message || 'Authentication failed',
            code: 'invalid_api_key',
            statusCode: 401,
            retryable: false,
            timestamp
          };
        
        case 400:
          return {
            type: OpenAIErrorType.INVALID_REQUEST,
            message: error.message || 'Invalid request',
            code: 'invalid_request',
            statusCode: 400,
            retryable: false,
            details: error.error,
            timestamp
          };
        
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: OpenAIErrorType.SERVICE_UNAVAILABLE,
            message: error.message || 'Service temporarily unavailable',
            code: 'service_unavailable',
            statusCode: error.status,
            retryable: true,
            timestamp
          };
        
        default:
          return {
            type: OpenAIErrorType.API_ERROR,
            message: error.message || 'API error occurred',
            code: 'api_error',
            statusCode: error.status,
            retryable: error.status >= 500,
            timestamp
          };
      }
    }

    // Handle network errors
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
      return {
        type: OpenAIErrorType.TIMEOUT,
        message: 'Request timeout',
        code: 'timeout',
        retryable: true,
        timestamp
      };
    }

    if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
      return {
        type: OpenAIErrorType.NETWORK_ERROR,
        message: error.message || 'Network error',
        code: 'network_error',
        retryable: true,
        timestamp
      };
    }

    // Handle token limit errors
    if (error?.message?.includes('token') || error?.message?.includes('context length')) {
      return {
        type: OpenAIErrorType.TOKEN_LIMIT,
        message: error.message || 'Token limit exceeded',
        code: 'context_length_exceeded',
        retryable: false,
        timestamp
      };
    }

    // Unknown error
    return {
      type: OpenAIErrorType.UNKNOWN,
      message: error?.message || 'Unknown error occurred',
      code: 'unknown',
      retryable: false,
      details: error,
      timestamp
    };
  }

  private extractRetryAfter(error: any): number {
    // Try to extract retry-after from headers or error message
    if (error?.headers?.['retry-after']) {
      return parseInt(error.headers['retry-after']);
    }
    
    // Try to parse from error message
    const match = error?.message?.match(/try again in (\d+)s/);
    if (match) {
      return parseInt(match[1]);
    }
    
    // Default to 60 seconds
    return 60;
  }

  private calculateRetryDelay(
    attempt: number,
    baseDelay: number,
    retryAfter?: number
  ): number {
    // Use retry-after if provided
    if (retryAfter) {
      return retryAfter * 1000;
    }

    // Exponential backoff with jitter
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), 60000);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  private async checkRateLimits(): Promise<void> {
    const now = Date.now();
    const config = getOpenAIConfig();
    const rateLimits = config.performance.rateLimits;
    
    // Reset if window has passed
    if (now > this.rateLimitState.resetTime) {
      this.rateLimitState.requestsRemaining = rateLimits.requestsPerMinute;
      this.rateLimitState.tokensRemaining = rateLimits.tokensPerMinute;
      this.rateLimitState.resetTime = now + 60000;
    }

    // Check if we have capacity
    if (this.rateLimitState.requestsRemaining <= 0) {
      const waitTime = this.rateLimitState.resetTime - now;
      if (waitTime > 0) {
        await this.delay(waitTime);
      }
    }

    // Implement request spacing to avoid bursts using centralized configuration
    const timeSinceLastRequest = now - this.rateLimitState.lastRequest;
    const minSpacing = config.performance.minRequestSpacing;
    if (timeSinceLastRequest < minSpacing) {
      await this.delay(minSpacing - timeSinceLastRequest);
    }

    this.rateLimitState.lastRequest = Date.now();
    this.rateLimitState.requestsRemaining--;
  }

  private updateRateLimitState(response: any): void {
    // Update from response headers if available
    const headers = response?.headers;
    if (headers) {
      if (headers['x-ratelimit-limit-requests']) {
        // Update rate limit state from headers
        this.rateLimitState.requestsRemaining = 
          parseInt(headers['x-ratelimit-remaining-requests'] || '0');
        this.rateLimitState.tokensRemaining = 
          parseInt(headers['x-ratelimit-remaining-tokens'] || '0');
      }
    }
  }

  private calculateUsage(response: any, model: string): any {
    const usage = response.usage;
    if (!usage) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
    }

    // OpenAI Responses API uses input_tokens and output_tokens
    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
    
    // Use centralized cost calculation
    const estimatedCost = configCalculateCost(inputTokens, outputTokens, model);
    
    return {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: totalTokens,
      estimatedCost: estimatedCost
    };
  }

  private calculateEmbeddingCost(tokens: number, model: string): number {
    // Embedding model pricing
    const embeddingPricing: Record<string, number> = {
      'text-embedding-3-small': 0.00002,
      'text-embedding-3-large': 0.00013,
      'text-embedding-ada-002': 0.00010
    };
    
    const price = embeddingPricing[model] || 0.00002;
    return Math.round((tokens / 1000) * price * 10000) / 10000;
  }

  private isCircuitBreakerAllowing(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'CLOSED':
        return true;
      
      case 'OPEN':
        if (now >= this.circuitBreaker.nextAttempt) {
          this.circuitBreaker.state = 'HALF_OPEN';
          return true;
        }
        return false;
      
      case 'HALF_OPEN':
        return true;
      
      default:
        return true;
    }
  }

  private updateCircuitBreaker(error: OpenAIError): void {
    // Only count retryable errors towards circuit breaker
    if (!error.retryable) {
      return;
    }

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    const circuitBreakerConfig = getCircuitBreakerConfig();
    if (this.circuitBreaker.failures >= circuitBreakerConfig.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.circuitBreaker.nextAttempt = 
        Date.now() + circuitBreakerConfig.resetTimeout;
    }
  }

  private createErrorResponse(
    type: OpenAIErrorType,
    message: string,
    statusCode: number,
    retryable: boolean,
    requestId: string
  ): OpenAIResponse {
    return {
      success: false,
      error: {
        type,
        message,
        statusCode,
        retryable,
        timestamp: new Date().toISOString()
      },
      requestId,
      timestamp: new Date().toISOString()
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Logging Methods
  // ============================================================================

  private logRequest(
    requestId: string,
    prompt: string,
    config: OpenAIRequestConfig
  ): void {
    console.log('[OpenAI Request]', {
      requestId,
      model: config.model,
      promptLength: prompt.length,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      userId: config.userId,
      metadata: config.metadata,
      timestamp: new Date().toISOString()
    });
  }

  private logResponse(
    requestId: string,
    response: any,
    usage: any,
    retries: number
  ): void {
    console.log('[OpenAI Response]', {
      requestId,
      model: response.model,
      usage,
      retries,
      responseId: response.id,
      timestamp: new Date().toISOString()
    });
  }

  private logError(
    requestId: string,
    error: OpenAIError,
    retryAttempt: number
  ): void {
    console.error('[OpenAI Error]', {
      requestId,
      errorType: error.type,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      retryable: error.retryable,
      retryAttempt,
      timestamp: error.timestamp
    });
  }

  // ============================================================================
  // Public Utility Methods
  // ============================================================================

  /**
   * Count tokens in text (approximate)
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get current rate limit state
   */
  getRateLimitState(): RateLimitState {
    return { ...this.rateLimitState };
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED',
      nextAttempt: 0
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a singleton instance of OpenAI client
 */
let singletonClient: OpenAIClient | null = null;

export function getOpenAIClient(): OpenAIClient {
  if (!singletonClient) {
    singletonClient = new OpenAIClient();
  }
  return singletonClient;
}

// ============================================================================
// Export Default Instance
// ============================================================================

export default new OpenAIClient();