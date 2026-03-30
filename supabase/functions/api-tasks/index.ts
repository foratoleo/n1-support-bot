import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import {
  CreateTaskRequest,
  GetTaskRequest,
  ListTasksRequest,
  UpdateTaskRequest
} from './types.ts';
import { createCorsResponse, createErrorResponse } from './response-builder.ts';
import {
  handleSingleRequest,
  handleGetRequest,
  handleListRequest,
  handleUpdateRequest,
  getRequestAction
} from './request-handler.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('METHOD_NOT_ALLOWED', 'Only POST method is supported', requestId, 405, false);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[api-tasks] JSON parse error:', parseError);
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', requestId, 400, false);
    }

    const action = getRequestAction(body);

    switch (action) {
      case 'get':
        return await handleGetRequest(body as GetTaskRequest, requestId, startTime);

      case 'list':
        return await handleListRequest(body as ListTasksRequest, requestId, startTime);

      case 'update':
        return await handleUpdateRequest(body as UpdateTaskRequest, requestId, startTime);

      case 'create':
        return await handleSingleRequest(body as CreateTaskRequest, requestId, startTime);

      default:
        // Default to create if no action specified
        return await handleSingleRequest(body as CreateTaskRequest, requestId, startTime);
    }
  } catch (error) {
    console.error('[api-tasks] Error:', error);
    const processingTime = Date.now() - startTime;

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isRetryable = !errorMessage.includes('FOREIGN_KEY_VIOLATION') && !errorMessage.includes('PERMISSION_DENIED');

    return createErrorResponse('INTERNAL_ERROR', errorMessage, requestId, 500, isRetryable, undefined, processingTime);
  }
});
