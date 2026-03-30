import {
  ValidationResult,
  validateUUID,
  validatePositiveInteger,
  validateTaskStatus,
  validateTaskStatuses,
  validateTaskPriority,
  validateTaskPriorities,
  validateTaskType,
  validateTaskTypes,
  validateTags
} from '../_shared/validation.ts';
import {
  CreateTaskRequest,
  GetTaskRequest,
  ListTasksRequest,
  UpdateTaskRequest,
  SORT_FIELDS,
  SORT_ORDERS,
  SortField,
  SortOrder
} from './types.ts';

export interface ValidationErrors {
  valid: boolean;
  errors: string[];
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// ============================================
// CREATE Request Validation
// ============================================

export function validateCreateRequest(request: CreateTaskRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.title) {
    errors.push('title is required');
  } else if (typeof request.title !== 'string' || request.title.trim() === '') {
    errors.push('title must be a non-empty string');
  }

  if (request.description !== undefined && typeof request.description !== 'string') {
    errors.push('description must be a string');
  }

  if (request.status !== undefined) {
    const statusValidation = validateTaskStatus(request.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (request.priority !== undefined) {
    const priorityValidation = validateTaskPriority(request.priority);
    if (!priorityValidation.valid) {
      errors.push(priorityValidation.error!);
    }
  }

  if (request.task_type !== undefined) {
    const typeValidation = validateTaskType(request.task_type);
    if (!typeValidation.valid) {
      errors.push(typeValidation.error!);
    }
  }

  if (request.story_points !== undefined) {
    const storyPointsValidation = validatePositiveInteger(request.story_points, 'story_points');
    if (!storyPointsValidation.valid) {
      errors.push(storyPointsValidation.error!);
    }
  }

  if (request.estimated_hours !== undefined) {
    const estimatedHoursValidation = validatePositiveInteger(request.estimated_hours, 'estimated_hours');
    if (!estimatedHoursValidation.valid) {
      errors.push(estimatedHoursValidation.error!);
    }
  }

  if (request.actual_hours !== undefined) {
    const actualHoursValidation = validatePositiveInteger(request.actual_hours, 'actual_hours');
    if (!actualHoursValidation.valid) {
      errors.push(actualHoursValidation.error!);
    }
  }

  if (request.component_area !== undefined && typeof request.component_area !== 'string') {
    errors.push('component_area must be a string');
  }

  if (request.tags !== undefined) {
    const tagsValidation = validateTags(request.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (request.dependencies !== undefined && !Array.isArray(request.dependencies)) {
    errors.push('dependencies must be an array');
  }

  if (request.ai_metadata !== undefined && (typeof request.ai_metadata !== 'object' || request.ai_metadata === null)) {
    errors.push('ai_metadata must be an object');
  }

  if (request.parent_task_id !== undefined && request.parent_task_id !== null) {
    if (!validateUUID(request.parent_task_id)) {
      errors.push('parent_task_id must be a valid UUID');
    }
  }

  if (request.assigned_to !== undefined && request.assigned_to !== null) {
    if (!validateUUID(request.assigned_to)) {
      errors.push('assigned_to must be a valid UUID');
    }
  }

  if (request.sprint_id !== undefined && request.sprint_id !== null) {
    if (!validateUUID(request.sprint_id)) {
      errors.push('sprint_id must be a valid UUID');
    }
  }

  if (request.feature_id !== undefined && request.feature_id !== null) {
    if (!validateUUID(request.feature_id)) {
      errors.push('feature_id must be a valid UUID');
    }
  }

  if (request.generated_from_interaction_id !== undefined && request.generated_from_interaction_id !== null) {
    if (!validateUUID(request.generated_from_interaction_id)) {
      errors.push('generated_from_interaction_id must be a valid UUID');
    }
  }

  if (request.created_by !== undefined && typeof request.created_by !== 'string') {
    errors.push('created_by must be a string');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// GET Request Validation
// ============================================

export function validateGetRequest(request: GetTaskRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.task_id) {
    errors.push('task_id is required');
  } else if (!validateUUID(request.task_id)) {
    errors.push('task_id must be a valid UUID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// LIST Request Validation
// ============================================

export function validatePagination(page?: number, limit?: number): ValidationResult {
  if (page !== undefined) {
    if (!Number.isInteger(page) || page < 1) {
      return { valid: false, error: `page must be a positive integer (minimum: 1)` };
    }
  }

  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      return { valid: false, error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
    }
  }

  return { valid: true };
}

export function validateSortOptions(field?: string, order?: string): ValidationResult {
  if (field !== undefined) {
    if (!SORT_FIELDS.includes(field as SortField)) {
      return { valid: false, error: `Invalid sort field: ${field}. Valid values are: ${SORT_FIELDS.join(', ')}` };
    }
  }

  if (order !== undefined) {
    if (!SORT_ORDERS.includes(order as SortOrder)) {
      return { valid: false, error: `Invalid sort order: ${order}. Valid values are: ${SORT_ORDERS.join(', ')}` };
    }
  }

  return { valid: true };
}

export function validateListRequest(request: ListTasksRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (request.filters) {
    if (request.filters.status !== undefined) {
      const statusValidation = validateTaskStatuses(request.filters.status);
      if (!statusValidation.valid) {
        errors.push(`filters.status: ${statusValidation.error!}`);
      }
    }

    if (request.filters.priority !== undefined) {
      const priorityValidation = validateTaskPriorities(request.filters.priority);
      if (!priorityValidation.valid) {
        errors.push(`filters.priority: ${priorityValidation.error!}`);
      }
    }

    if (request.filters.task_type !== undefined) {
      const typeValidation = validateTaskTypes(request.filters.task_type);
      if (!typeValidation.valid) {
        errors.push(`filters.task_type: ${typeValidation.error!}`);
      }
    }

    if (request.filters.sprint_id !== undefined && request.filters.sprint_id !== null) {
      if (!validateUUID(request.filters.sprint_id)) {
        errors.push('filters.sprint_id must be a valid UUID');
      }
    }

    if (request.filters.assigned_to !== undefined && request.filters.assigned_to !== null) {
      if (!validateUUID(request.filters.assigned_to)) {
        errors.push('filters.assigned_to must be a valid UUID');
      }
    }

    if (request.filters.assignee_email !== undefined && request.filters.assigned_to !== undefined) {
      errors.push('Cannot use both filters.assigned_to and filters.assignee_email. Use one or the other.');
    }

    if (request.filters.assignee_email !== undefined && typeof request.filters.assignee_email !== 'string') {
      errors.push('filters.assignee_email must be a string');
    }

    if (request.filters.parent_task_id !== undefined && request.filters.parent_task_id !== null) {
      if (!validateUUID(request.filters.parent_task_id)) {
        errors.push('filters.parent_task_id must be a valid UUID');
      }
    }

    if (request.filters.feature_id !== undefined && request.filters.feature_id !== null) {
      if (!validateUUID(request.filters.feature_id)) {
        errors.push('filters.feature_id must be a valid UUID');
      }
    }

    if (request.filters.tags !== undefined) {
      const tagsValidation = validateTags(request.filters.tags);
      if (!tagsValidation.valid) {
        errors.push(`filters.${tagsValidation.error!}`);
      }
    }
  }

  if (request.pagination) {
    const paginationValidation = validatePagination(request.pagination.page, request.pagination.limit);
    if (!paginationValidation.valid) {
      errors.push(paginationValidation.error!);
    }
  }

  if (request.sort) {
    const sortValidation = validateSortOptions(request.sort.field, request.sort.order);
    if (!sortValidation.valid) {
      errors.push(sortValidation.error!);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// UPDATE Request Validation
// ============================================

export function validateUpdateRequest(request: UpdateTaskRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.task_id) {
    errors.push('task_id is required');
  } else if (!validateUUID(request.task_id)) {
    errors.push('task_id must be a valid UUID');
  }

  if (!request.data || typeof request.data !== 'object') {
    errors.push('data is required and must be an object');
    return { valid: false, errors };
  }

  const dataKeys = Object.keys(request.data).filter(key => {
    const value = request.data[key as keyof typeof request.data];
    return value !== undefined;
  });
  if (dataKeys.length === 0) {
    errors.push('data must contain at least one field to update');
  }

  const { data } = request;

  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('title must be a non-empty string');
    }
  }

  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('description must be a string or null');
  }

  if (data.status !== undefined) {
    const statusValidation = validateTaskStatus(data.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (data.priority !== undefined) {
    const priorityValidation = validateTaskPriority(data.priority);
    if (!priorityValidation.valid) {
      errors.push(priorityValidation.error!);
    }
  }

  if (data.task_type !== undefined) {
    const typeValidation = validateTaskType(data.task_type);
    if (!typeValidation.valid) {
      errors.push(typeValidation.error!);
    }
  }

  if (data.story_points !== undefined) {
    const storyPointsValidation = validatePositiveInteger(data.story_points, 'story_points');
    if (!storyPointsValidation.valid) {
      errors.push(storyPointsValidation.error!);
    }
  }

  if (data.estimated_hours !== undefined) {
    const estimatedHoursValidation = validatePositiveInteger(data.estimated_hours, 'estimated_hours');
    if (!estimatedHoursValidation.valid) {
      errors.push(estimatedHoursValidation.error!);
    }
  }

  if (data.actual_hours !== undefined) {
    const actualHoursValidation = validatePositiveInteger(data.actual_hours, 'actual_hours');
    if (!actualHoursValidation.valid) {
      errors.push(actualHoursValidation.error!);
    }
  }

  if (data.component_area !== undefined && data.component_area !== null && typeof data.component_area !== 'string') {
    errors.push('component_area must be a string or null');
  }

  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (data.dependencies !== undefined && !Array.isArray(data.dependencies)) {
    errors.push('dependencies must be an array');
  }

  if (data.ai_metadata !== undefined && (typeof data.ai_metadata !== 'object' || data.ai_metadata === null)) {
    errors.push('ai_metadata must be an object');
  }

  if (data.parent_task_id !== undefined && data.parent_task_id !== null) {
    if (!validateUUID(data.parent_task_id)) {
      errors.push('parent_task_id must be a valid UUID');
    }
  }

  if (data.assigned_to !== undefined && data.assigned_to !== null) {
    if (!validateUUID(data.assigned_to)) {
      errors.push('assigned_to must be a valid UUID');
    }
  }

  if (data.sprint_id !== undefined && data.sprint_id !== null) {
    if (!validateUUID(data.sprint_id)) {
      errors.push('sprint_id must be a valid UUID');
    }
  }

  if (data.feature_id !== undefined && data.feature_id !== null) {
    if (!validateUUID(data.feature_id)) {
      errors.push('feature_id must be a valid UUID');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// Pagination Defaults Export
// ============================================

export const PAGINATION_DEFAULTS = {
  page: DEFAULT_PAGE,
  limit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT
} as const;
