import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { generateRequestId } from '../_shared/response-formatter.ts';
import { createCorsResponse, createSuccessResponse, createErrorResponse } from '../_shared/api-response-builder.ts';
import { validateRequest } from './validation.ts';
import { DatabaseService } from './database-service.ts';
import { BatchStatusUpdateResponse } from './types.ts';

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
    } catch {
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', requestId, 400, false);
    }

    const validation = validateRequest(body);

    if (!validation.valid) {
      return createErrorResponse('VALIDATION_ERROR', validation.errors.join('; '), requestId, 400, false);
    }

    const { project_id, updates } = validation.data;
    const db = new DatabaseService();

    const projectExists = await db.validateProjectExists(project_id);
    if (!projectExists) {
      return createErrorResponse('PROJECT_NOT_FOUND', `Project ${project_id} not found`, requestId, 404, false);
    }

    const results = await Promise.all(
      updates.map((item) => db.updateTaskStatus(project_id, item.task_id, item.status))
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    const response: BatchStatusUpdateResponse = {
      results,
      summary: {
        total: results.length,
        succeeded,
        failed,
      },
    };

    const processingTime = Date.now() - startTime;
    return createSuccessResponse(response, requestId, processingTime, 200);
  } catch (error) {
    console.error('[api-tasks-status-update] Error:', error);
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isRetryable = !errorMessage.includes('FOREIGN_KEY_VIOLATION') && !errorMessage.includes('PERMISSION_DENIED');

    return createErrorResponse('INTERNAL_ERROR', errorMessage, requestId, 500, isRetryable, undefined, processingTime);
  }
});
