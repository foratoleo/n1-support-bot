import { DatabaseService } from './database-service.ts';
import {
  CreateBacklogItemRequest,
  BatchCreateRequest,
  GetBacklogItemRequest,
  ListBacklogItemsRequest,
  UpdateBacklogItemRequest,
  BacklogItemAction,
  BACKLOG_ACTIONS
} from './types.ts';
import {
  validateBacklogItemRequest,
  validateBatchRequest,
  validateGetRequest,
  validateListRequest,
  validateUpdateRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { validateUUID } from '../_shared/validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

export async function handleSingleRequest(
  body: CreateBacklogItemRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateBacklogItemRequest(body);
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

  const item = await dbService.createBacklogItem(body);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ item }, requestId, processingTime);
}

export async function handleBatchRequest(
  body: BatchCreateRequest,
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

  const items = await dbService.createBacklogItems(body.project_id, body.items);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ items, count: items.length }, requestId, processingTime);
}

export function isBatchRequest(body: unknown): body is BatchCreateRequest {
  return (
    typeof body === 'object' &&
    body !== null &&
    'items' in body &&
    Array.isArray((body as BatchCreateRequest).items)
  );
}

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): BacklogItemAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (BACKLOG_ACTIONS.includes(action as BacklogItemAction)) {
    return action as BacklogItemAction;
  }
  return null;
}

export async function handleGetRequest(
  body: GetBacklogItemRequest,
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

  const item = await dbService.getBacklogItem(body.project_id, body.item_id);
  if (!item) {
    return createErrorResponse(
      'NOT_FOUND',
      'Backlog item not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ item }, requestId, processingTime, 200);
}

export async function handleListRequest(
  body: ListBacklogItemsRequest,
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

  const result = await dbService.listBacklogItems(body.project_id, {
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
  body: UpdateBacklogItemRequest,
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
  const item = await dbService.updateBacklogItem(body.project_id, body.item_id, updateData);

  if (!item) {
    return createErrorResponse(
      'NOT_FOUND',
      'Backlog item not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ item }, requestId, processingTime, 200);
}
