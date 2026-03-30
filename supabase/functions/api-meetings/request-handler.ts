import { DatabaseService } from './database-service.ts';
import {
  CreateMeetingRequest,
  GetMeetingRequest,
  ListMeetingsRequest,
  UpdateMeetingRequest,
  MeetingAction,
  MEETING_ACTIONS
} from './types.ts';
import {
  validateMeetingRequest,
  validateGetRequest,
  validateListRequest,
  validateUpdateRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

export async function handleSingleRequest(
  body: CreateMeetingRequest,
  requestId: string,
  startTime: number
): Promise<Response> {
  const validation = validateMeetingRequest(body);
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

  // Only validate project exists if project_id is provided
  if (body.project_id) {
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
  }

  const meeting = await dbService.createMeeting(body);
  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ meeting }, requestId, processingTime);
}

export async function handleGetRequest(
  body: GetMeetingRequest,
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

  // Only validate project exists if project_id is provided
  if (body.project_id) {
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
  }

  const meeting = await dbService.getMeeting(body.meeting_id, body.project_id);
  if (!meeting) {
    return createErrorResponse(
      'NOT_FOUND',
      'Meeting transcript not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ meeting }, requestId, processingTime, 200);
}

export async function handleListRequest(
  body: ListMeetingsRequest,
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

  // Determine effective project_id (from root or filters)
  const effectiveProjectId = body.project_id || body.filters?.project_id;

  // Only validate project exists if project_id is provided
  if (effectiveProjectId) {
    const projectExists = await dbService.validateProjectExists(effectiveProjectId);
    if (!projectExists) {
      return createErrorResponse(
        'NOT_FOUND',
        'Project not found or has been deleted',
        requestId,
        404,
        false
      );
    }
  }

  const page = body.pagination?.page ?? PAGINATION_DEFAULTS.page;
  const limit = body.pagination?.limit ?? PAGINATION_DEFAULTS.limit;
  const appliedFilters = body.filters ?? {};

  const result = await dbService.listMeetings({
    projectId: body.project_id,
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
  body: UpdateMeetingRequest,
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

  // Only validate project exists if project_id is provided
  if (body.project_id) {
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
  }

  // If updating project_id in data, validate the new project exists
  if (body.data.project_id) {
    const newProjectExists = await dbService.validateProjectExists(body.data.project_id);
    if (!newProjectExists) {
      return createErrorResponse(
        'NOT_FOUND',
        'Target project not found or has been deleted',
        requestId,
        404,
        false
      );
    }
  }

  const updateData = mapUpdateRequestToData(body.data);
  const meeting = await dbService.updateMeeting(body.meeting_id, updateData, body.project_id);

  if (!meeting) {
    return createErrorResponse(
      'NOT_FOUND',
      'Meeting transcript not found',
      requestId,
      404,
      false
    );
  }

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ meeting }, requestId, processingTime, 200);
}

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): MeetingAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (MEETING_ACTIONS.includes(action as MeetingAction)) {
    return action as MeetingAction;
  }
  return null;
}
