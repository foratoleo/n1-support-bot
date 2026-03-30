import { DatabaseService } from './database-service.ts';
import {
  CreateTaskRequest,
  GetTaskRequest,
  ListTasksRequest,
  UpdateTaskRequest,
  TaskAction,
  TASK_ACTIONS
} from './types.ts';
import {
  validateCreateRequest,
  validateGetRequest,
  validateListRequest,
  validateUpdateRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

export async function handleSingleRequest(
  body: CreateTaskRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateCreateRequest(body);
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

  const task = await dbService.createTask(body);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ task }, requestId, processingTime);
}

export async function handleGetRequest(
  body: GetTaskRequest,
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

  const task = await dbService.getTask(body.project_id, body.task_id);
  if (!task) {
    return createErrorResponse(
      'NOT_FOUND',
      'Task not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ task }, requestId, processingTime, 200);
}

export async function handleListRequest(
  body: ListTasksRequest,
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
  const filters = body.filters ? { ...body.filters } : {};

  if (filters.assignee_email) {
    const memberId = await dbService.resolveEmailToMemberId(filters.assignee_email);
    if (!memberId) {
      const processingTime = Date.now() - startTime;
      return createPaginatedResponse([], requestId, processingTime, {
        totalCount: 0,
        currentPage: page,
        pageSize: limit,
        appliedFilters: filters
      });
    }
    filters.assigned_to = memberId;
  }

  const appliedFilters = filters;

  const result = await dbService.listTasks(body.project_id, {
    filters,
    pagination: { page, limit },
    sort: body.sort
  });

  const processingTime = Date.now() - startTime;

  return createPaginatedResponse(result.tasks, requestId, processingTime, {
    totalCount: result.totalCount,
    currentPage: page,
    pageSize: limit,
    appliedFilters
  });
}

export async function handleUpdateRequest(
  body: UpdateTaskRequest,
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
  const task = await dbService.updateTask(body.project_id, body.task_id, updateData);

  if (!task) {
    return createErrorResponse(
      'NOT_FOUND',
      'Task not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ task }, requestId, processingTime, 200);
}

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): TaskAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (TASK_ACTIONS.includes(action as TaskAction)) {
    return action as TaskAction;
  }
  return null;
}
