/**
 * MS Graph API Service Call Tracker
 *
 * Wraps Microsoft Graph API calls and records them in external_service_calls
 * for complete traceability of all API communications.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CreateServiceCallRequest,
  UpdateServiceCallResponse,
  RequestMethod,
  OperationType,
} from '../_shared/external-service-types.ts';
import { ExternalServiceCallService } from '../_shared/external-service-database.ts';

// ============================================
// Types
// ============================================

export interface MSGraphRequestConfig {
  url: string;
  method: RequestMethod;
  headers: Record<string, string>;
  body?: string;
}

export interface MSGraphResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MSGraphTrackedResult<T> {
  response: Response;
  data: T;
  serviceCallId: string;
}

export interface TrackingContext {
  projectId: string;
  userId: string;
  operationType: OperationType;
  endpointPath: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extracts endpoint path from a full MS Graph URL
 */
function extractEndpointPath(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Converts Headers object to plain Record
 */
function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    // Skip sensitive headers in the record
    if (!key.toLowerCase().includes('authorization')) {
      record[key] = value;
    }
  });
  return record;
}

/**
 * Sanitizes request headers for storage (removes sensitive data)
 */
function sanitizeRequestHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === 'authorization') {
      // Redact authorization but keep token type
      sanitized[key] = value.startsWith('Bearer ')
        ? 'Bearer [REDACTED]'
        : '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Truncates large response bodies for storage
 */
function truncateForStorage(data: unknown, maxSize = 50000): unknown {
  const jsonString = JSON.stringify(data);
  if (jsonString.length <= maxSize) {
    return data;
  }

  // For arrays, limit number of items
  if (Array.isArray(data)) {
    const truncated = data.slice(0, 10);
    return {
      _truncated: true,
      _originalLength: data.length,
      _storedItems: truncated.length,
      items: truncated,
    };
  }

  // For objects with value arrays (common MS Graph pattern)
  if (typeof data === 'object' && data !== null && 'value' in data && Array.isArray((data as { value: unknown[] }).value)) {
    const graphData = data as { value: unknown[]; [key: string]: unknown };
    const truncatedValue = graphData.value.slice(0, 10);
    return {
      ...graphData,
      value: truncatedValue,
      _truncated: true,
      _originalLength: graphData.value.length,
      _storedItems: truncatedValue.length,
    };
  }

  // For other large objects, return metadata
  return {
    _truncated: true,
    _originalSize: jsonString.length,
    _message: 'Response body too large for storage',
  };
}

// ============================================
// MS Graph Service Tracker Class
// ============================================

export class MSGraphServiceTracker {
  private serviceCallService: ExternalServiceCallService;

  constructor(private supabase: SupabaseClient) {
    this.serviceCallService = new ExternalServiceCallService(supabase);
  }

  /**
   * Creates a tracked fetch wrapper for MS Graph API calls
   *
   * @param context - Tracking context with project/user info
   * @returns Tracked fetch function
   */
  createTrackedFetch(context: TrackingContext) {
    return async <T>(
      url: string,
      options: RequestInit
    ): Promise<MSGraphTrackedResult<T>> => {
      const startTime = Date.now();
      const method = (options.method || 'GET') as RequestMethod;
      const headers = options.headers as Record<string, string> || {};
      const body = options.body as string | undefined;

      // Create the service call record before making the request
      const createRequest: CreateServiceCallRequest = {
        projectId: context.projectId,
        serviceName: 'microsoft_graph',
        serviceCategory: 'integration',
        endpointPath: context.endpointPath || extractEndpointPath(url),
        operationType: context.operationType,
        requestMethod: method,
        requestUrl: url,
        requestHeaders: sanitizeRequestHeaders(headers),
        requestBody: body ? this.parseBodySafely(body) : undefined,
        requestParameters: this.extractQueryParams(url),
      };

      let serviceCallId: string;

      try {
        serviceCallId = await this.serviceCallService.createServiceCall(createRequest);
      } catch (error) {
        console.error('[ms-graph-tracker] Failed to create service call record:', error);
        // Continue with the request even if tracking fails
        const response = await fetch(url, options);
        const data = await response.json() as T;
        return {
          response,
          data,
          serviceCallId: '',
        };
      }

      // Make the actual API request
      let response: Response;
      let responseData: T;
      let updateData: UpdateServiceCallResponse;

      try {
        response = await fetch(url, options);
        const durationMs = Date.now() - startTime;

        // Parse response body
        const responseText = await response.text();
        responseData = this.parseResponseSafely<T>(responseText);

        // Handle response based on status
        if (response.ok) {
          // Success case
          updateData = {
            status: 'completed',
            responseStatus: response.status,
            responseHeaders: headersToRecord(response.headers),
            responseBody: truncateForStorage(responseData) as Record<string, any>,
            responseMetadata: {
              statusText: response.statusText,
              url: response.url,
              redirected: response.redirected,
            },
            completedAt: new Date().toISOString(),
            durationMs,
          };

          // Update the service call record with success
          try {
            await this.serviceCallService.updateServiceCall(serviceCallId, updateData);
          } catch (updateError) {
            console.error('[ms-graph-tracker] Failed to update service call record:', updateError);
          }

          // Create a new Response object since we consumed the body
          const clonedResponse = new Response(JSON.stringify(responseData), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });

          return {
            response: clonedResponse,
            data: responseData,
            serviceCallId,
          };
        } else {
          // Error case - record the failure and throw
          updateData = {
            status: 'failed',
            responseStatus: response.status,
            responseHeaders: headersToRecord(response.headers),
            responseBody: truncateForStorage(responseData) as Record<string, any>,
            responseMetadata: {
              statusText: response.statusText,
            },
            completedAt: new Date().toISOString(),
            durationMs,
            errorMessage: `MS Graph API error: ${response.status} ${response.statusText}`,
            errorDetails: {
              httpStatus: response.status,
              httpStatusText: response.statusText,
              errorBody: responseData,
            },
          };

          // Update the service call record with failure
          try {
            await this.serviceCallService.updateServiceCall(serviceCallId, updateData);
          } catch (updateError) {
            console.error('[ms-graph-tracker] Failed to update service call with error:', updateError);
          }

          // Throw error so calling code can handle it properly
          // Use specific error prefixes that ms-graph-client.ts expects
          if (response.status === 401) {
            throw new Error('MS_GRAPH_UNAUTHORIZED: Access token is invalid or expired');
          }
          if (response.status === 403) {
            throw new Error('MS_GRAPH_FORBIDDEN: Insufficient permissions');
          }
          if (response.status === 404) {
            throw new Error('MS_GRAPH_NOT_FOUND: Resource not found');
          }
          if (response.status === 429) {
            throw new Error('MS_GRAPH_RATE_LIMITED: Too many requests');
          }
          throw new Error(`MS_GRAPH_ERROR: Failed with status ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        // Network errors or errors thrown from the block above
        // Only record if this is a network/fetch error (not already recorded above)
        if (!(error instanceof Error && error.message.startsWith('MS_GRAPH_'))) {
          const durationMs = Date.now() - startTime;

          updateData = {
            status: 'failed',
            completedAt: new Date().toISOString(),
            durationMs,
            errorMessage: error instanceof Error ? error.message : 'Unknown fetch error',
            errorDetails: {
              errorType: error instanceof Error ? error.name : 'UnknownError',
              stack: error instanceof Error ? error.stack : undefined,
            },
          };

          // Update the service call record with error
          try {
            await this.serviceCallService.updateServiceCall(serviceCallId, updateData);
          } catch (updateError) {
            console.error('[ms-graph-tracker] Failed to update service call with error:', updateError);
          }
        }

        throw error;
      }
    };
  }

  /**
   * Logs a token refresh operation
   */
  async logTokenRefresh(
    projectId: string,
    userId: string,
    tokenUrl: string,
    success: boolean,
    durationMs: number,
    errorMessage?: string
  ): Promise<string | null> {
    try {
      const createRequest: CreateServiceCallRequest = {
        projectId,
        serviceName: 'microsoft_graph',
        serviceCategory: 'integration',
        endpointPath: '/oauth2/v2.0/token',
        operationType: 'sync',
        requestMethod: 'POST',
        requestUrl: tokenUrl,
        requestHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' },
        requestBody: { grant_type: 'refresh_token', client_id: '[REDACTED]' },
      };

      const serviceCallId = await this.serviceCallService.createServiceCall(createRequest);

      const updateData: UpdateServiceCallResponse = success
        ? {
            status: 'completed',
            responseStatus: 200,
            completedAt: new Date().toISOString(),
            durationMs,
            responseMetadata: { tokenRefreshed: true },
          }
        : {
            status: 'failed',
            completedAt: new Date().toISOString(),
            durationMs,
            errorMessage: errorMessage || 'Token refresh failed',
          };

      await this.serviceCallService.updateServiceCall(serviceCallId, updateData);
      return serviceCallId;
    } catch (error) {
      console.error('[ms-graph-tracker] Failed to log token refresh:', error);
      return null;
    }
  }

  /**
   * Parses request body safely
   */
  private parseBodySafely(body: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(body);
    } catch {
      // For form-encoded data, return as metadata
      if (body.includes('=')) {
        const params: Record<string, string> = {};
        const pairs = body.split('&');
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          // Redact sensitive values
          if (
            key === 'client_secret' ||
            key === 'refresh_token' ||
            key === 'access_token'
          ) {
            params[decodeURIComponent(key)] = '[REDACTED]';
          } else {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
          }
        }
        return params;
      }
      return { _rawBody: '[non-JSON body]' };
    }
  }

  /**
   * Parses response body safely
   */
  private parseResponseSafely<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch {
      return { _rawResponse: text } as unknown as T;
    }
  }

  /**
   * Extracts query parameters from URL
   */
  private extractQueryParams(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return params;
    } catch {
      return {};
    }
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Creates a new MS Graph Service Tracker instance
 */
export function createMSGraphTracker(supabase: SupabaseClient): MSGraphServiceTracker {
  return new MSGraphServiceTracker(supabase);
}
