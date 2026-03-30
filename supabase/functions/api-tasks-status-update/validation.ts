import { validateUUID, validateTaskStatus } from '../_shared/validation.ts';
import { BatchStatusUpdateRequest, StatusUpdateItem, TASK_STATUSES } from './types.ts';

const MAX_BATCH_SIZE = 100;

export function validateRequest(body: unknown): { valid: true; data: BatchStatusUpdateRequest } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const request = body as Record<string, unknown>;

  if (!request.project_id || typeof request.project_id !== 'string') {
    errors.push('project_id is required and must be a string');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.updates) {
    errors.push('updates is required');
  } else if (!Array.isArray(request.updates)) {
    errors.push('updates must be an array');
  } else if (request.updates.length === 0) {
    errors.push('updates must contain at least one item');
  } else if (request.updates.length > MAX_BATCH_SIZE) {
    errors.push(`updates cannot exceed ${MAX_BATCH_SIZE} items`);
  } else {
    request.updates.forEach((item: unknown, index: number) => {
      const entry = item as Record<string, unknown>;

      if (!entry || typeof entry !== 'object') {
        errors.push(`updates[${index}] must be an object`);
        return;
      }

      if (!entry.task_id || typeof entry.task_id !== 'string') {
        errors.push(`updates[${index}].task_id is required and must be a string`);
      } else if (!validateUUID(entry.task_id)) {
        errors.push(`updates[${index}].task_id must be a valid UUID`);
      }

      if (!entry.status || typeof entry.status !== 'string') {
        errors.push(`updates[${index}].status is required and must be a string`);
      } else {
        const statusValidation = validateTaskStatus(entry.status);
        if (!statusValidation.valid) {
          errors.push(`updates[${index}].status: ${statusValidation.error}`);
        }
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      project_id: request.project_id as string,
      updates: (request.updates as Record<string, unknown>[]).map((item) => ({
        task_id: item.task_id as string,
        status: item.status as StatusUpdateItem['status'],
      })),
    },
  };
}
