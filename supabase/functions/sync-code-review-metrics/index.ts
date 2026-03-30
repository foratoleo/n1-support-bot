/**
 * Code Review Metrics Refresh Edge Function
 *
 * Supabase Edge Function for refreshing materialized views that aggregate
 * code review metrics (by reviewer and by PR author).
 *
 * Can be invoked:
 * 1. Manually via POST request for on-demand refresh
 * 2. As fire-and-forget callback after sync-github-prs completes
 * 3. Via pg_cron for scheduled automatic refresh
 *
 * @module sync-code-review-metrics
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { MetricsAggregator } from './metrics-aggregator.ts';
import { OPERATION } from './config.ts';
import type {
  MetricsRefreshRequest,
  MetricsRefreshResponse,
  MetricsRefreshErrorType,
} from './types.ts';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create CORS preflight response
 */
function createCorsResponse(): Response {
  return new Response('ok', {
    headers: corsHeaders,
    status: 200,
  });
}

/**
 * Create JSON response with CORS headers
 */
function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

/**
 * Map error type to HTTP status code
 */
function getStatusForErrorType(type: MetricsRefreshErrorType): number {
  switch (type) {
    case 'validation':
      return 400;
    case 'lock_conflict':
      return 409;
    case 'timeout':
      return 504;
    case 'database':
    case 'unknown':
    default:
      return 500;
  }
}

/**
 * Create error response with appropriate HTTP status
 */
function createErrorResponse(
  message: string,
  type: MetricsRefreshErrorType = 'unknown'
): Response {
  const status = getStatusForErrorType(type);

  const response = {
    success: false,
    summary: null,
    error: message,
  };

  return createJsonResponse(response, status);
}

/**
 * Validate UUID format
 */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Parse and validate the request body.
 *
 * Validates:
 * - project_id: optional, must be valid UUID if provided
 * - force_full: optional, must be boolean if provided
 */
function parseRequestBody(body: unknown): {
  valid: boolean;
  data?: MetricsRefreshRequest;
  errors?: Array<{ field: string; message: string }>;
} {
  // Allow empty body (all fields are optional)
  if (!body || typeof body !== 'object') {
    return { valid: true, data: {} };
  }

  const errors: Array<{ field: string; message: string }> = [];
  const request = body as MetricsRefreshRequest;

  // Validate project_id if provided
  if (request.project_id !== undefined) {
    if (typeof request.project_id !== 'string') {
      errors.push({ field: 'project_id', message: 'project_id must be a string' });
    } else if (!request.project_id.trim()) {
      errors.push({ field: 'project_id', message: 'project_id cannot be empty' });
    } else if (!isValidUUID(request.project_id)) {
      errors.push({ field: 'project_id', message: 'project_id must be a valid UUID' });
    }
  }

  // Validate force_full if provided
  if (request.force_full !== undefined && typeof request.force_full !== 'boolean') {
    errors.push({ field: 'force_full', message: 'force_full must be a boolean' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: request };
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return createErrorResponse(
        `Method ${req.method} not allowed. Use POST.`,
        'validation'
      );
    }

    // Parse request body (allow empty body for fire-and-forget calls)
    let body: unknown = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return createErrorResponse(
        'Invalid JSON in request body',
        'validation'
      );
    }

    // Validate request fields
    const validation = parseRequestBody(body);
    if (!validation.valid) {
      const errorMessages = validation.errors!
        .map((e) => `${e.field}: ${e.message}`)
        .join('; ');
      return createErrorResponse(errorMessages, 'validation');
    }

    const request = validation.data!;

    console.log(`[${OPERATION}] Refresh request received:`, {
      project_id: request.project_id || 'all',
      force_full: request.force_full || false,
    });

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Create aggregator and execute refresh
    const aggregator = new MetricsAggregator(supabase);
    const result: MetricsRefreshResponse = await aggregator.refreshMetrics();

    console.log(`[${OPERATION}] Refresh result:`, {
      success: result.success,
      views_refreshed: result.views_refreshed.length,
      duration_ms: result.duration_ms,
      error: result.error || null,
    });

    // Determine response based on result
    if (result.success) {
      return createJsonResponse({
        success: true,
        summary: result,
      });
    }

    // Refresh failed - classify the error
    const errorType = classifyError(result.error || '');
    const status = getStatusForErrorType(errorType);

    return createJsonResponse(
      {
        success: false,
        summary: result,
        error: result.error,
      },
      status
    );
  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return createErrorResponse(errorMessage, 'unknown');
  }
});

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify an error message into a typed category for HTTP status mapping.
 *
 * @param message - Error message from the aggregator
 * @returns Appropriate error type
 */
function classifyError(message: string): MetricsRefreshErrorType {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('lock conflict') || lowerMessage.includes('could not obtain lock')) {
    return 'lock_conflict';
  }

  if (lowerMessage.includes('timed out') || lowerMessage.includes('timeout')) {
    return 'timeout';
  }

  if (
    lowerMessage.includes('database') ||
    lowerMessage.includes('does not exist') ||
    lowerMessage.includes('pgrst')
  ) {
    return 'database';
  }

  return 'unknown';
}
