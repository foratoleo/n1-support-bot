import { corsHeaders } from '../../_shared/cors.ts';
import { ValidationError, ApiError, DatabaseError } from './validation.ts';

/**
 * Formats a successful response with CORS headers
 */
export function formatSuccessResponse(data: any): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Formats an error response with appropriate status code and CORS headers
 */
export function formatErrorResponse(error: Error, statusCode: number): Response {
  const errorBody: {
    success: false;
    error: string;
    code: string;
    details?: Record<string, any>;
  } = {
    success: false,
    error: error.message,
    code: error.constructor.name,
  };

  // Add error-specific details
  if (error instanceof ValidationError) {
    errorBody.details = {
      field: error.field,
    };
  } else if (error instanceof ApiError) {
    errorBody.details = {
      statusCode: error.statusCode,
      isRetryable: error.isRetryable,
    };
    if (error.apiResponse) {
      errorBody.details.apiResponse = error.apiResponse;
    }
  } else if (error instanceof DatabaseError) {
    errorBody.details = {
      operation: error.operation,
    };
    if (error.constraint) {
      errorBody.details.constraint = error.constraint;
    }
  }

  // Log error for monitoring
  logError(error, { statusCode });

  return new Response(JSON.stringify(errorBody), {
    status: statusCode,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Logs error with structured format for monitoring
 */
export function logError(error: Error, context: Record<string, any> = {}): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    errorType: error.constructor.name,
    message: error.message,
    stack: error.stack,
    context,
  };

  console.error('Error:', JSON.stringify(logEntry, null, 2));
}
