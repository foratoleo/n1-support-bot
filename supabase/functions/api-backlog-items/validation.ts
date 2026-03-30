import { ValidationResult, validateUUID, validatePositiveInteger } from '../_shared/validation.ts';
import {
  CreateBacklogItemRequest,
  GetBacklogItemRequest,
  ListBacklogItemsRequest,
  UpdateBacklogItemRequest,
  BACKLOG_STATUSES,
  BACKLOG_PRIORITIES,
  SORT_FIELDS,
  SORT_ORDERS,
  BacklogStatus,
  BacklogPriority,
  SortField,
  SortOrder
} from './types.ts';

export function isValidBacklogStatus(status: string): status is BacklogStatus {
  return BACKLOG_STATUSES.includes(status as BacklogStatus);
}

export function validateBacklogStatus(status: string): ValidationResult {
  if (!isValidBacklogStatus(status)) {
    return {
      valid: false,
      error: `Invalid status: ${status}. Valid values are: ${BACKLOG_STATUSES.join(', ')}`
    };
  }
  return { valid: true };
}

export function isValidBacklogPriority(priority: string): priority is BacklogPriority {
  return BACKLOG_PRIORITIES.includes(priority as BacklogPriority);
}

export function validateBacklogPriority(priority: string): ValidationResult {
  if (!isValidBacklogPriority(priority)) {
    return {
      valid: false,
      error: `Invalid priority: ${priority}. Valid values are: ${BACKLOG_PRIORITIES.join(', ')}`
    };
  }
  return { valid: true };
}

export function validateStoryPoints(storyPoints: number): ValidationResult {
  if (!Number.isInteger(storyPoints) || storyPoints < 0) {
    return {
      valid: false,
      error: 'story_points must be a non-negative integer'
    };
  }
  return { valid: true };
}

export function validateBusinessValue(value: number): ValidationResult {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return {
      valid: false,
      error: 'business_value must be an integer between 1 and 10'
    };
  }
  return { valid: true };
}

export function validateTechnicalComplexity(value: number): ValidationResult {
  if (!Number.isInteger(value) || value < 1 || value > 10) {
    return {
      valid: false,
      error: 'technical_complexity must be an integer between 1 and 10'
    };
  }
  return { valid: true };
}

export function validatePosition(position: number): ValidationResult {
  return validatePositiveInteger(position, 'position');
}

export function validateTags(tags: unknown): ValidationResult {
  if (!Array.isArray(tags)) {
    return { valid: false, error: 'tags must be an array' };
  }

  for (let i = 0; i < tags.length; i++) {
    if (typeof tags[i] !== 'string') {
      return { valid: false, error: `tags[${i}] must be a string` };
    }
    if (tags[i].trim() === '') {
      return { valid: false, error: `tags[${i}] cannot be empty` };
    }
  }

  return { valid: true };
}

export function validateAcceptanceCriteria(criteria: unknown): ValidationResult {
  if (!Array.isArray(criteria)) {
    return { valid: false, error: 'acceptance_criteria must be an array' };
  }

  for (let i = 0; i < criteria.length; i++) {
    const item = criteria[i];
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `acceptance_criteria[${i}] must be an object` };
    }
    if (typeof item.id !== 'string') {
      return { valid: false, error: `acceptance_criteria[${i}].id must be a string` };
    }
    if (typeof item.description !== 'string') {
      return { valid: false, error: `acceptance_criteria[${i}].description must be a string` };
    }
    if (typeof item.completed !== 'boolean') {
      return { valid: false, error: `acceptance_criteria[${i}].completed must be a boolean` };
    }
  }

  return { valid: true };
}

export interface ValidationErrors {
  valid: boolean;
  errors: string[];
}

export function validateBacklogItemRequest(request: CreateBacklogItemRequest): ValidationErrors {
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
    const statusValidation = validateBacklogStatus(request.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (request.priority !== undefined) {
    const priorityValidation = validateBacklogPriority(request.priority);
    if (!priorityValidation.valid) {
      errors.push(priorityValidation.error!);
    }
  }

  if (request.story_points !== undefined) {
    const storyPointsValidation = validateStoryPoints(request.story_points);
    if (!storyPointsValidation.valid) {
      errors.push(storyPointsValidation.error!);
    }
  }

  if (request.business_value !== undefined && request.business_value !== null) {
    const businessValueValidation = validateBusinessValue(request.business_value);
    if (!businessValueValidation.valid) {
      errors.push(businessValueValidation.error!);
    }
  }

  if (request.technical_complexity !== undefined && request.technical_complexity !== null) {
    const complexityValidation = validateTechnicalComplexity(request.technical_complexity);
    if (!complexityValidation.valid) {
      errors.push(complexityValidation.error!);
    }
  }

  if (request.tags !== undefined) {
    const tagsValidation = validateTags(request.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (request.acceptance_criteria !== undefined) {
    const criteriaValidation = validateAcceptanceCriteria(request.acceptance_criteria);
    if (!criteriaValidation.valid) {
      errors.push(criteriaValidation.error!);
    }
  }

  if (request.position !== undefined) {
    const positionValidation = validatePosition(request.position);
    if (!positionValidation.valid) {
      errors.push(positionValidation.error!);
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

const MAX_BATCH_SIZE = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function validateBatchRequest(items: Omit<CreateBacklogItemRequest, 'project_id'>[], projectId: string): ValidationErrors {
  const allErrors: string[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, errors: ['items must be a non-empty array'] };
  }

  if (items.length > MAX_BATCH_SIZE) {
    return { valid: false, errors: [`Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`] };
  }

  for (let i = 0; i < items.length; i++) {
    const itemWithProject = { ...items[i], project_id: projectId };
    const validation = validateBacklogItemRequest(itemWithProject);
    if (!validation.valid) {
      validation.errors.forEach(error => {
        allErrors.push(`items[${i}]: ${error}`);
      });
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

// ============================================
// GET Request Validation
// ============================================

export function validateGetRequest(request: GetBacklogItemRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.item_id) {
    errors.push('item_id is required');
  } else if (!validateUUID(request.item_id)) {
    errors.push('item_id must be a valid UUID');
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

export function validateStatusArray(statuses: unknown): ValidationResult {
  if (!Array.isArray(statuses)) {
    return { valid: false, error: 'filters.status must be an array' };
  }

  for (let i = 0; i < statuses.length; i++) {
    if (!BACKLOG_STATUSES.includes(statuses[i] as BacklogStatus)) {
      return { valid: false, error: `filters.status[${i}]: Invalid status '${statuses[i]}'. Valid values are: ${BACKLOG_STATUSES.join(', ')}` };
    }
  }

  return { valid: true };
}

export function validatePriorityArray(priorities: unknown): ValidationResult {
  if (!Array.isArray(priorities)) {
    return { valid: false, error: 'filters.priority must be an array' };
  }

  for (let i = 0; i < priorities.length; i++) {
    if (!BACKLOG_PRIORITIES.includes(priorities[i] as BacklogPriority)) {
      return { valid: false, error: `filters.priority[${i}]: Invalid priority '${priorities[i]}'. Valid values are: ${BACKLOG_PRIORITIES.join(', ')}` };
    }
  }

  return { valid: true };
}

export function validateListRequest(request: ListBacklogItemsRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (request.filters) {
    if (request.filters.status !== undefined) {
      const statusValidation = validateStatusArray(request.filters.status);
      if (!statusValidation.valid) {
        errors.push(statusValidation.error!);
      }
    }

    if (request.filters.priority !== undefined) {
      const priorityValidation = validatePriorityArray(request.filters.priority);
      if (!priorityValidation.valid) {
        errors.push(priorityValidation.error!);
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

export function validateUpdateRequest(request: UpdateBacklogItemRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.item_id) {
    errors.push('item_id is required');
  } else if (!validateUUID(request.item_id)) {
    errors.push('item_id must be a valid UUID');
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
    const statusValidation = validateBacklogStatus(data.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (data.priority !== undefined) {
    const priorityValidation = validateBacklogPriority(data.priority);
    if (!priorityValidation.valid) {
      errors.push(priorityValidation.error!);
    }
  }

  if (data.story_points !== undefined) {
    const storyPointsValidation = validateStoryPoints(data.story_points);
    if (!storyPointsValidation.valid) {
      errors.push(storyPointsValidation.error!);
    }
  }

  if (data.business_value !== undefined && data.business_value !== null) {
    const businessValueValidation = validateBusinessValue(data.business_value);
    if (!businessValueValidation.valid) {
      errors.push(businessValueValidation.error!);
    }
  }

  if (data.technical_complexity !== undefined && data.technical_complexity !== null) {
    const complexityValidation = validateTechnicalComplexity(data.technical_complexity);
    if (!complexityValidation.valid) {
      errors.push(complexityValidation.error!);
    }
  }

  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (data.acceptance_criteria !== undefined) {
    const criteriaValidation = validateAcceptanceCriteria(data.acceptance_criteria);
    if (!criteriaValidation.valid) {
      errors.push(criteriaValidation.error!);
    }
  }

  if (data.position !== undefined) {
    const positionValidation = validatePosition(data.position);
    if (!positionValidation.valid) {
      errors.push(positionValidation.error!);
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
