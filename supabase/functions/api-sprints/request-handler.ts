import { DatabaseService } from './database-service.ts';
import {
  CreateSprintRequest,
  GetSprintRequest,
  ListSprintsRequest,
  UpdateSprintRequest,
  SprintAction,
  SPRINT_ACTIONS
} from './types.ts';
import {
  validateSprintRequest,
  validateGetRequest,
  validateListRequest,
  validateUpdateRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

export async function handleSingleRequest(
  body: CreateSprintRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateSprintRequest(body);
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

  const sprint = await dbService.createSprint(body);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ sprint }, requestId, processingTime);
}

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): SprintAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (SPRINT_ACTIONS.includes(action as SprintAction)) {
    return action as SprintAction;
  }
  return null;
}

export async function handleGetRequest(
  body: GetSprintRequest,
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

  const sprint = await dbService.getSprint(body.project_id, body.sprint_id);
  if (!sprint) {
    return createErrorResponse(
      'NOT_FOUND',
      'Sprint not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ sprint }, requestId, processingTime, 200);
}

export async function handleListRequest(
  body: ListSprintsRequest,
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

  const result = await dbService.listSprints(body.project_id, {
    filters: body.filters,
    pagination: { page, limit },
    sort: body.sort
  });

  const processingTime = Date.now() - startTime;

  return createPaginatedResponse(result.sprints, requestId, processingTime, {
    totalCount: result.totalCount,
    currentPage: page,
    pageSize: limit,
    appliedFilters
  });
}

export async function handleUpdateRequest(
  body: UpdateSprintRequest,
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
  const sprint = await dbService.updateSprint(body.project_id, body.sprint_id, updateData);

  if (!sprint) {
    return createErrorResponse(
      'NOT_FOUND',
      'Sprint not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ sprint }, requestId, processingTime, 200);
}
