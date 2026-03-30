import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  ExternalServiceCallService,
  ExternalServiceDatabaseError,
} from './external-service-database.ts';
import {
  CreateServiceCallRequest,
  UpdateServiceCallResponse,
  ServiceName,
  ServiceCategory,
  RequestMethod,
  OperationType,
} from './external-service-types.ts';

/**
 * Utility functions for tracking external service API calls
 *
 * These utilities provide a simplified interface for common service
 * tracking operations in Edge Functions.
 */

/**
 * Configuration for tracking a service call
 */
export interface TrackServiceCallConfig {
  projectId: string;
  serviceName: ServiceName;
  serviceCategory: ServiceCategory;
  endpointPath: string;
  operationType?: OperationType;
  requestMethod?: RequestMethod;
  requestUrl: string;
  requestHeaders?: Record<string, string>;
  requestBody?: Record<string, any>;
  requestParameters?: Record<string, any>;
  aiInteractionId?: string;
}

/**
 * Helper class for tracking service calls with automatic timing
 */
export class ServiceCallTracker {
  private callId: string | null = null;
  private startTime: number = 0;
  private service: ExternalServiceCallService;

  constructor(
    private supabaseClient: SupabaseClient,
    private config: TrackServiceCallConfig
  ) {
    this.service = new ExternalServiceCallService(supabaseClient);
  }

  /**
   * Starts tracking the service call
   * @returns Service call ID
   */
  async start(): Promise<string> {
    this.startTime = Date.now();

    const request: CreateServiceCallRequest = {
      projectId: this.config.projectId,
      serviceName: this.config.serviceName,
      serviceCategory: this.config.serviceCategory,
      endpointPath: this.config.endpointPath,
      operationType: this.config.operationType,
      requestMethod: this.config.requestMethod || 'POST',
      requestUrl: this.config.requestUrl,
      requestHeaders: this.config.requestHeaders,
      requestBody: this.config.requestBody,
      requestParameters: this.config.requestParameters,
      aiInteractionId: this.config.aiInteractionId,
    };

    this.callId = await this.service.createServiceCall(request);
    console.log(`Service call tracking started: ${this.callId}`);
    return this.callId;
  }

  /**
   * Records a successful completion with response data
   *
   * @param responseStatus - HTTP status code
   * @param responseBody - Response body
   * @param responseMetadata - Additional metadata
   */
  async complete(
    responseStatus: number,
    responseBody?: Record<string, any>,
    responseMetadata?: Record<string, any>
  ): Promise<void> {
    if (!this.callId) {
      throw new Error('Cannot complete tracking: call not started');
    }

    const durationMs = Date.now() - this.startTime;

    const update: UpdateServiceCallResponse = {
      status: 'completed',
      responseStatus,
      responseBody,
      responseMetadata,
      completedAt: new Date().toISOString(),
      durationMs,
    };

    await this.service.updateServiceCall(this.callId, update);
    console.log(`Service call completed: ${this.callId} (${durationMs}ms)`);
  }

  /**
   * Records a failure with error details
   *
   * @param error - Error object or message
   * @param responseStatus - Optional HTTP status code
   */
  async fail(error: Error | string, responseStatus?: number): Promise<void> {
    if (!this.callId) {
      throw new Error('Cannot fail tracking: call not started');
    }

    const durationMs = Date.now() - this.startTime;
    const errorMessage = error instanceof Error ? error.message : error;
    const errorDetails = error instanceof Error
      ? { stack: error.stack, name: error.name }
      : undefined;

    const update: UpdateServiceCallResponse = {
      status: 'failed',
      responseStatus,
      errorMessage,
      errorDetails,
      completedAt: new Date().toISOString(),
      durationMs,
    };

    await this.service.updateServiceCall(this.callId, update);
    console.error(`Service call failed: ${this.callId} - ${errorMessage}`);
  }

  /**
   * Records a timeout
   */
  async timeout(): Promise<void> {
    if (!this.callId) {
      throw new Error('Cannot timeout tracking: call not started');
    }

    const durationMs = Date.now() - this.startTime;

    const update: UpdateServiceCallResponse = {
      status: 'timeout',
      errorMessage: 'Request timeout exceeded',
      completedAt: new Date().toISOString(),
      durationMs,
    };

    await this.service.updateServiceCall(this.callId, update);
    console.warn(`Service call timeout: ${this.callId}`);
  }

  /**
   * Updates cost and token information (for AI services)
   *
   * @param costUsd - Cost in USD
   * @param tokensUsed - Number of tokens used
   */
  async updateCost(costUsd: number, tokensUsed?: number): Promise<void> {
    if (!this.callId) {
      throw new Error('Cannot update cost: call not started');
    }

    const update: UpdateServiceCallResponse = {
      status: 'completed', // Preserve existing status
      costUsd,
      tokensUsed,
    };

    await this.service.updateServiceCall(this.callId, update);
    console.log(`Service call cost updated: ${this.callId} - $${costUsd}`);
  }

  /**
   * Gets the current call ID
   */
  getCallId(): string | null {
    return this.callId;
  }
}

/**
 * Wraps an async function with automatic service call tracking
 *
 * Usage:
 * ```typescript
 * const result = await trackServiceCall(
 *   supabaseClient,
 *   config,
 *   async () => {
 *     return await externalApiCall();
 *   }
 * );
 * ```
 *
 * @param supabaseClient - Supabase client instance
 * @param config - Tracking configuration
 * @param fn - Async function to execute and track
 * @returns Result of the function
 */
export async function trackServiceCall<T>(
  supabaseClient: SupabaseClient,
  config: TrackServiceCallConfig,
  fn: () => Promise<T>
): Promise<T> {
  const tracker = new ServiceCallTracker(supabaseClient, config);

  try {
    await tracker.start();
    const result = await fn();
    await tracker.complete(200, { success: true });
    return result;
  } catch (error) {
    await tracker.fail(error as Error);
    throw error;
  }
}

/**
 * Wraps a fetch call with automatic service call tracking
 *
 * Usage:
 * ```typescript
 * const response = await trackedFetch(
 *   supabaseClient,
 *   projectId,
 *   'https://api.example.com/endpoint',
 *   {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(data)
 *   },
 *   {
 *     serviceName: 'example-api',
 *     serviceCategory: 'integration',
 *     endpointPath: '/endpoint'
 *   }
 * );
 * ```
 *
 * @param supabaseClient - Supabase client instance
 * @param projectId - Project ID
 * @param url - Request URL
 * @param options - Fetch options
 * @param trackingConfig - Additional tracking configuration
 * @returns Fetch response
 */
export async function trackedFetch(
  supabaseClient: SupabaseClient,
  projectId: string,
  url: string,
  options: RequestInit = {},
  trackingConfig: {
    serviceName: ServiceName;
    serviceCategory: ServiceCategory;
    endpointPath: string;
    operationType?: OperationType;
    aiInteractionId?: string;
  }
): Promise<Response> {
  const config: TrackServiceCallConfig = {
    projectId,
    serviceName: trackingConfig.serviceName,
    serviceCategory: trackingConfig.serviceCategory,
    endpointPath: trackingConfig.endpointPath,
    operationType: trackingConfig.operationType,
    requestMethod: (options.method as RequestMethod) || 'GET',
    requestUrl: url,
    requestHeaders: options.headers as Record<string, string>,
    requestBody: options.body ? JSON.parse(options.body as string) : undefined,
    aiInteractionId: trackingConfig.aiInteractionId,
  };

  const tracker = new ServiceCallTracker(supabaseClient, config);

  try {
    await tracker.start();
    const response = await fetch(url, options);

    // Try to parse response body
    let responseBody: any;
    try {
      const clone = response.clone();
      const text = await clone.text();
      responseBody = text ? JSON.parse(text) : undefined;
    } catch {
      // Response is not JSON, skip body parsing
    }

    if (response.ok) {
      await tracker.complete(response.status, responseBody);
    } else {
      await tracker.fail(
        new Error(`HTTP ${response.status}: ${response.statusText}`),
        response.status
      );
    }

    return response;
  } catch (error) {
    await tracker.fail(error as Error);
    throw error;
  }
}

/**
 * Helper to calculate cost for OpenAI API calls
 *
 * Pricing as of 2025 (update as needed):
 * - GPT-4o: $5.00/1M input, $15.00/1M output
 * - GPT-4o-mini: $0.15/1M input, $0.60/1M output
 *
 * @param model - OpenAI model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 5.0, output: 15.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'gpt-4': { input: 30.0, output: 60.0 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}

/**
 * Helper to sanitize headers (remove sensitive data)
 *
 * @param headers - Request or response headers
 * @returns Sanitized headers
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'api-key', 'x-api-key', 'cookie', 'set-cookie'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Helper to sanitize request/response body (remove sensitive fields)
 *
 * @param body - Request or response body
 * @param sensitiveFields - Array of field names to redact
 * @returns Sanitized body
 */
export function sanitizeBody(
  body: Record<string, any>,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey', 'api_key']
): Record<string, any> {
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Extract service name from URL
 *
 * @param url - Request URL
 * @returns Detected service name or 'other'
 */
export function detectServiceName(url: string): ServiceName {
  if (url.includes('openai.com')) return 'openai';
  if (url.includes('googleapis.com/pagespeedonline')) return 'pagespeed';
  if (url.includes('github.com') || url.includes('api.github.com')) return 'github';
  if (url.includes('elevenlabs.io')) return 'elevenlabs';
  if (url.includes('stripe.com')) return 'stripe';
  if (url.includes('sendgrid.com')) return 'sendgrid';
  if (url.includes('twilio.com')) return 'twilio';
  if (url.includes('cloudinary.com')) return 'cloudinary';
  if (url.includes('amazonaws.com')) return 'aws-s3';
  if (url.includes('recall.ai')) return 'recall';

  return 'other';
}

/**
 * Extract endpoint path from URL
 *
 * @param url - Request URL
 * @returns Endpoint path
 */
export function extractEndpointPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return '/unknown';
  }
}
