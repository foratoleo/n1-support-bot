import { DatabaseService } from './database-service.ts';
import {
  CreateCommentRequest,
  ListCommentsRequest,
  UpdateCommentRequest,
  CommentAction,
  COMMENT_ACTIONS
} from './types.ts';
import {
  validateCreateRequest,
  validateListRequest,
  validateUpdateRequest,
  PAGINATION_DEFAULTS
} from './validation.ts';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from './response-builder.ts';
import { mapUpdateRequestToData } from './data-mapper.ts';

export async function handleCreateRequest(
  body: CreateCommentRequest,
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

  // Validate project exists
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

  // Validate task exists in the project
  const taskExists = await dbService.validateTaskExists(body.project_id, body.task_id);
  if (!taskExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Task not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  // Validate author is a team member of this project
  const authorExists = await dbService.validateTeamMemberExists(body.project_id, body.author_id);
  if (!authorExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Author not found or is not a member of this project',
      requestId,
      404,
      false
    );
  }

  const createdComment = await dbService.createComment(body);

  // Retrieve comment with author info for consistent response format
  const commentWithAuthor = await dbService.getComment(body.project_id, createdComment.id);

  const processingTime = Date.now() - startTime;

  return createSuccessResponse({ comment: commentWithAuthor }, requestId, processingTime, 201);
}

export async function handleListRequest(
  body: ListCommentsRequest,
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

  // Validate project exists
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

  // Validate task exists in the project
  const taskExists = await dbService.validateTaskExists(body.project_id, body.task_id);
  if (!taskExists) {
    return createErrorResponse(
      'NOT_FOUND',
      'Task not found or has been deleted',
      requestId,
      404,
      false
    );
  }

  const page = body.pagination?.page ?? PAGINATION_DEFAULTS.page;
  const limit = body.pagination?.limit ?? PAGINATION_DEFAULTS.limit;
  const appliedFilters = { task_id: body.task_id };

  const result = await dbService.listComments(body.project_id, body.task_id, {
    pagination: { page, limit },
    sort: body.sort
  });

  const processingTime = Date.now() - startTime;

  return createPaginatedResponse(result.comments, requestId, processingTime, {
    totalCount: result.totalCount,
    currentPage: page,
    pageSize: limit,
    appliedFilters
  });
}

export async function handleUpdateRequest(
  body: UpdateCommentRequest,
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

  // Validate project exists
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

  // Try to update - the DB query enforces author_id ownership
  const updatedComment = await dbService.updateComment(
    body.project_id,
    body.comment_id,
    body.author_id,
    updateData
  );

  if (!updatedComment) {
    // Check if comment exists to distinguish "not found" vs "unauthorized"
    const commentExists = await dbService.commentExists(body.project_id, body.comment_id);

    if (commentExists) {
      // Comment exists but author_id doesn't match - unauthorized
      return createErrorResponse(
        'FORBIDDEN',
        'Only the author can edit this comment',
        requestId,
        403,
        false
      );
    } else {
      // Comment doesn't exist
      return createErrorResponse(
        'NOT_FOUND',
        'Comment not found',
        requestId,
        404,
        false
      );
    }
  }

  // Get the updated comment with author info from the view
  const commentWithAuthor = await dbService.getComment(body.project_id, body.comment_id);

  const processingTime = Date.now() - startTime;
  return createSuccessResponse({ comment: commentWithAuthor }, requestId, processingTime, 200);
}

export function isActionRequest(body: unknown): body is { action: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'action' in body &&
    typeof (body as { action: string }).action === 'string'
  );
}

export function getRequestAction(body: unknown): CommentAction | null {
  if (!isActionRequest(body)) {
    return null;
  }
  const action = body.action;
  if (COMMENT_ACTIONS.includes(action as CommentAction)) {
    return action as CommentAction;
  }
  return null;
}
