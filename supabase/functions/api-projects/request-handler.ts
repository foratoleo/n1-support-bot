import { DatabaseService } from './database-service.ts';
import {
  CreateProjectRequest,
  GetProjectRequest,
  ListProjectsRequest,
  UpdateProjectRequest,
  ProjectAction,
  PROJECT_ACTIONS
} from './types.ts';
import {
  validateProjectRequest,
  validateGetRequest,
  validateListRequest,
  validateUpdateRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

// ============================================
// CREATE Handler
// ============================================

export async function handleCreateRequest(
  body: CreateProjectRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateProjectRequest(body);
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
  const project = await dbService.createProject(body);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ project }, requestId, processingTime);
}

// ============================================
// GET Handler
// ============================================

export async function handleGetRequest(
  body: GetProjectRequest,
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
  const project = await dbService.getProject(body.project_id);

  if (!project) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ project }, requestId, processingTime, 200);
}

// ============================================
// LIST Handler
// ============================================

export async function handleListRequest(
  body: ListProjectsRequest,
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

  const page = body.pagination?.page ?? PAGINATION_DEFAULTS.page;
  const limit = body.pagination?.limit ?? PAGINATION_DEFAULTS.limit;
  const appliedFilters = body.filters ?? {};

  const result = await dbService.listProjects({
    filters: body.filters,
    pagination: { page, limit },
    sort: body.sort
  });

  const processingTime = Date.now() - startTime;

  return createPaginatedResponse(result.projects, requestId, processingTime, {
    totalCount: result.totalCount,
    currentPage: page,
    pageSize: limit,
    appliedFilters
  });
}

// ============================================
// UPDATE Handler
// ============================================

export async function handleUpdateRequest(
  body: UpdateProjectRequest,
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
  const updateData = mapUpdateRequestToData(body.data);
  const project = await dbService.updateProject(body.project_id, updateData);

  if (!project) {
    return createErrorResponse(
      'NOT_FOUND',
      'Project not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ project }, requestId, processingTime, 200);
}

// ============================================
// Request Type Detection
// ============================================

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): ProjectAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (PROJECT_ACTIONS.includes(action as ProjectAction)) {
    return action as ProjectAction;
  }
  return null;
}
