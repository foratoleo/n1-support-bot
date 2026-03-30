import { DatabaseService } from './database-service.ts';
import {
  CreateFeatureRequest,
  BatchCreateFeatureRequest,
  GetFeatureRequest,
  ListFeaturesRequest,
  UpdateFeatureRequest,
  DeleteFeatureRequest,
  FeatureAction,
  FEATURE_ACTIONS
} from './types.ts';
import {
  validateCreateFeatureRequest,
  validateBatchRequest,
  validateGetRequest,
  validateListRequest,
  validateUpdateRequest,
  validateDeleteRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { validateUUID } from '../_shared/validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): FeatureAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (FEATURE_ACTIONS.includes(action as FeatureAction)) {
    return action as FeatureAction;
  }
  return null;
}

/**
 * Detects if request is a batch create request by presence of items array
 */
export function isBatchRequest(body: unknown): body is BatchCreateFeatureRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    'items' in body &&
    Array.isArray((body as BatchCreateFeatureRequest).items)
  );
}

export async function handleCreateRequest(
  body: CreateFeatureRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateCreateFeatureRequest(body);
  if (!validation.valid) {
    return createErrorResponse(
      'INVALID_INPUT',
      'Validation failed',
      requestId,
      400,
      false,
      validation.errors
    );
  }

  const dbService = new DatabaseService();

  const projectExists = await dbService.validateProjectExists(body.project_id);
  if (!projectExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const feature = await dbService.createFeature(body);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ feature }, requestId, processingTime, 201);
}

/**
 * Handles batch creation of multiple features
 */
export async function handleBatchRequest(
  body: BatchCreateFeatureRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  if (!body.project_id) {
    return createErrorResponse(
      'INVALID_INPUT',
      'project_id is required',
      requestId,
      400,
      false
    );
  }

  if (!validateUUID(body.project_id)) {
    return createErrorResponse(
      'INVALID_INPUT',
      'project_id must be a valid UUID',
      requestId,
      400,
      false
    );
  }

  const validation = validateBatchRequest(body.items, body.project_id);
  if (!validation.valid) {
    return createErrorResponse(
      'INVALID_INPUT',
      'Validation failed',
      requestId,
      400,
      false,
      validation.errors
    );
  }

  const dbService = new DatabaseService();

  const projectExists = await dbService.validateProjectExists(body.project_id);
  if (!projectExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const features = await dbService.createFeatures(body.project_id, body.items);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ features, count: features.length }, requestId, processingTime, 201);
}

export async function handleGetRequest(
  body: GetFeatureRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateGetRequest(body);
  if (!validation.valid) {
    return createErrorResponse(
      'INVALID_INPUT',
      'Validation failed',
      requestId,
      400,
      false,
      validation.errors
    );
  }

  const dbService = new DatabaseService();

  const projectExists = await dbService.validateProjectExists(body.project_id);
  if (!projectExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const feature = await dbService.getFeature(body.project_id, body.feature_id);
  if (!feature) {
    return createErrorResponse(
      'NOT_FOUND',
      'Feature not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ feature }, requestId, processingTime, 200);
}

export async function handleListRequest(
  body: ListFeaturesRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateListRequest(body);
  if (!validation.valid) {
    return createErrorResponse(
      'INVALID_INPUT',
      'Validation failed',
      requestId,
      400,
      false,
      validation.errors
    );
  }

  const dbService = new DatabaseService();

  const projectExists = await dbService.validateProjectExists(body.project_id);
  if (!projectExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const page = body.pagination?.page ?? PAGINATION_DEFAULTS.page;
  const limit = body.pagination?.limit ?? PAGINATION_DEFAULTS.limit;
  const appliedFilters = body.filters ?? {};

  const result = await dbService.listFeatures(body.project_id, {
    filters: body.filters,
    pagination: { page, limit },
    sort: body.sort
  });

  const processingTime = Date.now() - startTime;

  return createPaginatedResponse(result.items, requestId, processingTime, {
    totalCount: result.totalCount,
    currentPage: page,
    pageSize: limit,
    appliedFilters
  });
}

export async function handleUpdateRequest(
  body: UpdateFeatureRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateUpdateRequest(body);
  if (!validation.valid) {
    return createErrorResponse(
      'INVALID_INPUT',
      'Validation failed',
      requestId,
      400,
      false,
      validation.errors
    );
  }

  const dbService = new DatabaseService();

  const projectExists = await dbService.validateProjectExists(body.project_id);
  if (!projectExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const updateData = mapUpdateRequestToData(body.data);
  const feature = await dbService.updateFeature(body.project_id, body.feature_id, updateData);

  if (!feature) {
    return createErrorResponse(
      'NOT_FOUND',
      'Feature not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ feature }, requestId, processingTime, 200);
}

export async function handleDeleteRequest(
  body: DeleteFeatureRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateDeleteRequest(body);
  if (!validation.valid) {
    return createErrorResponse(
      'INVALID_INPUT',
      'Validation failed',
      requestId,
      400,
      false,
      validation.errors
    );
  }

  const dbService = new DatabaseService();

  const projectExists = await dbService.validateProjectExists(body.project_id);
  if (!projectExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const deleted = await dbService.deleteFeature(body.project_id, body.feature_id);

  if (!deleted) {
    return createErrorResponse(
      'NOT_FOUND',
      'Feature not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse(
    { success: true, message: 'Feature deleted successfully' },
    requestId,
    processingTime,
    200
  );
}
