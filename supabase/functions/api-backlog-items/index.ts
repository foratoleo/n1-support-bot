import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import {
  CreateBacklogItemRequest,
  BatchCreateRequest,
  GetBacklogItemRequest,
  ListBacklogItemsRequest,
  UpdateBacklogItemRequest,
  BACKLOG_ACTIONS
} from './types.ts';
import { createCorsResponse, createErrorResponse } from './response-builder.ts';
import {
  handleSingleRequest,
  handleBatchRequest,
  handleGetRequest,
  handleListRequest,
  handleUpdateRequest,
  isBatchRequest,
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
      console.error('[api-backlog-items] JSON parse error:', parseError);
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', requestId, 400, false);
    }

    const action = getRequestAction(body);

    switch (action) {
      case 'get':
        return await handleGetRequest(body as GetBacklogItemRequest, requestId, startTime);

      case 'list':
        return await handleListRequest(body as ListBacklogItemsRequest, requestId, startTime);

      case 'update':
        return await handleUpdateRequest(body as UpdateBacklogItemRequest, requestId, startTime);

      case 'create':
        return await handleSingleRequest(body as CreateBacklogItemRequest, requestId, startTime);

      case 'create_batch':
        return await handleBatchRequest(body as BatchCreateRequest, requestId, startTime);

      default:
        if (isBatchRequest(body)) {
          return await handleBatchRequest(body, requestId, startTime);
        }
        return await handleSingleRequest(body as CreateBacklogItemRequest, requestId, startTime);
    }
  } catch (error) {
    console.error('[api-backlog-items] Error:', error);
    const processingTime = Date.now() - startTime;

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isRetryable = !errorMessage.includes('FOREIGN_KEY_VIOLATION') && !errorMessage.includes('PERMISSION_DENIED');

    return createErrorResponse('INTERNAL_ERROR', errorMessage, requestId, 500, isRetryable, undefined, processingTime);
  }
});
