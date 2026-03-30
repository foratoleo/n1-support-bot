import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import {
  CreateFeatureRequest,
  BatchCreateFeatureRequest,
  GetFeatureRequest,
  ListFeaturesRequest,
  UpdateFeatureRequest,
  DeleteFeatureRequest
} from './types.ts';
import { createCorsResponse, createErrorResponse } from './response-builder.ts';
import {
  handleCreateRequest,
  handleBatchRequest,
  handleGetRequest,
  handleListRequest,
  handleUpdateRequest,
  handleDeleteRequest,
  getRequestAction,
  isBatchRequest
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
      console.error('[api-features] JSON parse error:', parseError);
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', requestId, 400, false);
    }

    const action = getRequestAction(body);

    switch (action) {
      case 'get':
        return await handleGetRequest(body as GetFeatureRequest, requestId, startTime);

      case 'list':
        return await handleListRequest(body as ListFeaturesRequest, requestId, startTime);

      case 'update':
        return await handleUpdateRequest(body as UpdateFeatureRequest, requestId, startTime);

      case 'delete':
        return await handleDeleteRequest(body as DeleteFeatureRequest, requestId, startTime);

      case 'create_batch':
        return await handleBatchRequest(body as BatchCreateFeatureRequest, requestId, startTime);

      case 'create':
      default:
        // Auto-detect batch request if items array present (backwards compatibility)
        if (isBatchRequest(body)) {
          return await handleBatchRequest(body as BatchCreateFeatureRequest, requestId, startTime);
        }
        return await handleCreateRequest(body as CreateFeatureRequest, requestId, startTime);
    }
  } catch (error) {
    console.error('[api-features] Error:', error);
    const processingTime = Date.now() - startTime;

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isRetryable = !errorMessage.includes('FOREIGN_KEY_VIOLATION') && !errorMessage.includes('PERMISSION_DENIED');

    return createErrorResponse('INTERNAL_ERROR', errorMessage, requestId, 500, isRetryable, undefined, processingTime);
  }
});
