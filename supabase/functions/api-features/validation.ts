import { ValidationResult, validateUUID, validatePositiveInteger, validateTags } from '../_shared/validation.ts';
import {
  CreateFeatureRequest,
  GetFeatureRequest,
  ListFeaturesRequest,
  UpdateFeatureRequest,
  DeleteFeatureRequest,
  FEATURE_STATUSES,
  FEATURE_PRIORITIES,
  SORT_FIELDS,
  SORT_ORDERS,
  FeatureStatus,
  FeaturePriority,
  SortField,
  SortOrder
} from './types.ts';

export function isValidFeatureStatus(status: string): status is FeatureStatus {
  return FEATURE_STATUSES.includes(status as FeatureStatus);
}

export function validateFeatureStatus(status: string): ValidationResult {
  if (!isValidFeatureStatus(status)) {
    return {
      valid: false,
      error: `Invalid status: ${status}. Valid values are: ${FEATURE_STATUSES.join(', ')}`
    };
  }
  return { valid: true };
}

export function isValidFeaturePriority(priority: string): priority is FeaturePriority {
  return FEATURE_PRIORITIES.includes(priority as FeaturePriority);
}

export function validateFeaturePriority(priority: string): ValidationResult {
  if (!isValidFeaturePriority(priority)) {
    return {
      valid: false,
      error: `Invalid priority: ${priority}. Valid values are: ${FEATURE_PRIORITIES.join(', ')}`
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

export function validateEstimatedHours(hours: number): ValidationResult {
  if (!Number.isInteger(hours) || hours < 0) {
    return {
      valid: false,
      error: 'estimated_hours must be a non-negative integer'
    };
  }
  return { valid: true };
}

export function validatePosition(position: number): ValidationResult {
  return validatePositiveInteger(position, 'position');
}

export function validateReadyCriteria(criteria: unknown): ValidationResult {
  if (!Array.isArray(criteria)) {
    return { valid: false, error: 'ready_criteria must be an array' };
  }

  for (let i = 0; i < criteria.length; i++) {
    const item = criteria[i];
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `ready_criteria[${i}] must be an object` };
    }
    if (typeof item.id !== 'string') {
      return { valid: false, error: `ready_criteria[${i}].id must be a string` };
    }
    if (typeof item.description !== 'string') {
      return { valid: false, error: `ready_criteria[${i}].description must be a string` };
    }
    if (typeof item.completed !== 'boolean') {
      return { valid: false, error: `ready_criteria[${i}].completed must be a boolean` };
    }
  }

  return { valid: true };
}

export function validateDependencies(dependencies: unknown): ValidationResult {
  if (!Array.isArray(dependencies)) {
    return { valid: false, error: 'dependencies must be an array' };
  }

  for (let i = 0; i < dependencies.length; i++) {
    const item = dependencies[i];
    if (typeof item !== 'object' || item === null) {
      return { valid: false, error: `dependencies[${i}] must be an object` };
    }
    if (typeof item.id !== 'string') {
      return { valid: false, error: `dependencies[${i}].id must be a string` };
    }
    if (typeof item.feature_id !== 'string') {
      return { valid: false, error: `dependencies[${i}].feature_id must be a string` };
    }
    if (typeof item.title !== 'string') {
      return { valid: false, error: `dependencies[${i}].title must be a string` };
    }
    if (typeof item.type !== 'string') {
      return { valid: false, error: `dependencies[${i}].type must be a string` };
    }
  }

  return { valid: true };
}

export interface ValidationErrors {
  valid: boolean;
  errors: string[];
}

export function validateCreateFeatureRequest(request: CreateFeatureRequest): ValidationErrors {
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

  if (request.backlog_item_id !== undefined && request.backlog_item_id !== null) {
    if (!validateUUID(request.backlog_item_id)) {
      errors.push('backlog_item_id must be a valid UUID');
    }
  }

  if (request.meeting_transcript_id !== undefined && request.meeting_transcript_id !== null) {
    if (!validateUUID(request.meeting_transcript_id)) {
      errors.push('meeting_transcript_id must be a valid UUID');
    }
  }

  if (request.status !== undefined) {
    const statusValidation = validateFeatureStatus(request.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (request.priority !== undefined) {
    const priorityValidation = validateFeaturePriority(request.priority);
    if (!priorityValidation.valid) {
      errors.push(priorityValidation.error!);
    }
  }

  if (request.delivered_value !== undefined && typeof request.delivered_value !== 'string') {
    errors.push('delivered_value must be a string');
  }

  if (request.notes !== undefined && typeof request.notes !== 'string') {
    errors.push('notes must be a string');
  }

  if (request.story_points !== undefined) {
    const storyPointsValidation = validateStoryPoints(request.story_points);
    if (!storyPointsValidation.valid) {
      errors.push(storyPointsValidation.error!);
    }
  }

  if (request.estimated_hours !== undefined && request.estimated_hours !== null) {
    const hoursValidation = validateEstimatedHours(request.estimated_hours);
    if (!hoursValidation.valid) {
      errors.push(hoursValidation.error!);
    }
  }

  if (request.tags !== undefined) {
    const tagsValidation = validateTags(request.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (request.ready_criteria !== undefined) {
    const criteriaValidation = validateReadyCriteria(request.ready_criteria);
    if (!criteriaValidation.valid) {
      errors.push(criteriaValidation.error!);
    }
  }

  if (request.dependencies !== undefined) {
    const dependenciesValidation = validateDependencies(request.dependencies);
    if (!dependenciesValidation.valid) {
      errors.push(dependenciesValidation.error!);
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

/**
 * Validates a batch of feature items for creation
 * Reuses single-item validation for each item in the batch
 */
export function validateBatchRequest(
  items: Omit<CreateFeatureRequest, 'project_id'>[],
  projectId: string
): ValidationErrors {
  const allErrors: string[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, errors: ['items must be a non-empty array'] };
  }

  if (items.length > MAX_BATCH_SIZE) {
    return { valid: false, errors: [`Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`] };
  }

  for (let i = 0; i < items.length; i++) {
    const itemWithProject = { ...items[i], project_id: projectId };
    const validation = validateCreateFeatureRequest(itemWithProject);
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

export function validateGetRequest(request: GetFeatureRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.feature_id) {
    errors.push('feature_id is required');
  } else if (!validateUUID(request.feature_id)) {
    errors.push('feature_id must be a valid UUID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

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
    if (!FEATURE_STATUSES.includes(statuses[i] as FeatureStatus)) {
      return { valid: false, error: `filters.status[${i}]: Invalid status '${statuses[i]}'. Valid values are: ${FEATURE_STATUSES.join(', ')}` };
    }
  }

  return { valid: true };
}

export function validatePriorityArray(priorities: unknown): ValidationResult {
  if (!Array.isArray(priorities)) {
    return { valid: false, error: 'filters.priority must be an array' };
  }

  for (let i = 0; i < priorities.length; i++) {
    if (!FEATURE_PRIORITIES.includes(priorities[i] as FeaturePriority)) {
      return { valid: false, error: `filters.priority[${i}]: Invalid priority '${priorities[i]}'. Valid values are: ${FEATURE_PRIORITIES.join(', ')}` };
    }
  }

  return { valid: true };
}

export function validateListRequest(request: ListFeaturesRequest): ValidationErrors {
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

    if (request.filters.backlog_item_id !== undefined) {
      if (!validateUUID(request.filters.backlog_item_id)) {
        errors.push('filters.backlog_item_id must be a valid UUID');
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

export function validateUpdateRequest(request: UpdateFeatureRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.feature_id) {
    errors.push('feature_id is required');
  } else if (!validateUUID(request.feature_id)) {
    errors.push('feature_id must be a valid UUID');
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

  if (data.backlog_item_id !== undefined && data.backlog_item_id !== null) {
    if (!validateUUID(data.backlog_item_id)) {
      errors.push('backlog_item_id must be a valid UUID');
    }
  }

  if (data.meeting_transcript_id !== undefined && data.meeting_transcript_id !== null) {
    if (!validateUUID(data.meeting_transcript_id)) {
      errors.push('meeting_transcript_id must be a valid UUID');
    }
  }

  if (data.status !== undefined) {
    const statusValidation = validateFeatureStatus(data.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (data.priority !== undefined) {
    const priorityValidation = validateFeaturePriority(data.priority);
    if (!priorityValidation.valid) {
      errors.push(priorityValidation.error!);
    }
  }

  if (data.delivered_value !== undefined && data.delivered_value !== null && typeof data.delivered_value !== 'string') {
    errors.push('delivered_value must be a string or null');
  }

  if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
    errors.push('notes must be a string or null');
  }

  if (data.story_points !== undefined) {
    const storyPointsValidation = validateStoryPoints(data.story_points);
    if (!storyPointsValidation.valid) {
      errors.push(storyPointsValidation.error!);
    }
  }

  if (data.estimated_hours !== undefined && data.estimated_hours !== null) {
    const hoursValidation = validateEstimatedHours(data.estimated_hours);
    if (!hoursValidation.valid) {
      errors.push(hoursValidation.error!);
    }
  }

  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (data.ready_criteria !== undefined) {
    const criteriaValidation = validateReadyCriteria(data.ready_criteria);
    if (!criteriaValidation.valid) {
      errors.push(criteriaValidation.error!);
    }
  }

  if (data.dependencies !== undefined) {
    const dependenciesValidation = validateDependencies(data.dependencies);
    if (!dependenciesValidation.valid) {
      errors.push(dependenciesValidation.error!);
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

export function validateDeleteRequest(request: DeleteFeatureRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.feature_id) {
    errors.push('feature_id is required');
  } else if (!validateUUID(request.feature_id)) {
    errors.push('feature_id must be a valid UUID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export const PAGINATION_DEFAULTS = {
  page: DEFAULT_PAGE,
  limit: DEFAULT_LIMIT,
  maxLimit: MAX_LIMIT
} as const;
