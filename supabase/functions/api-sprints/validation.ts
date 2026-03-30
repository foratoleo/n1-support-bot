import {
  ValidationResult,
  validateUUID,
  validateDateFormat,
  validateDateRange,
  validateSprintStatus,
  validateSprintStatuses,
  validatePositiveInteger
} from '../_shared/validation.ts';
import {
  CreateSprintRequest,
  GetSprintRequest,
  ListSprintsRequest,
  UpdateSprintRequest,
  SPRINT_STATUSES,
  SORT_FIELDS,
  SORT_ORDERS,
  SprintStatus,
  SortField,
  SortOrder
} from './types.ts';

export interface ValidationErrors {
  valid: boolean;
  errors: string[];
}

// ============================================
// Helper Validators
// ============================================

export function isValidSprintStatus(status: string): status is SprintStatus {
  return SPRINT_STATUSES.includes(status as SprintStatus);
}

export function validateGoals(goals: unknown): ValidationResult {
  if (!Array.isArray(goals)) {
    return { valid: false, error: 'goals must be an array' };
  }

  for (let i = 0; i < goals.length; i++) {
    if (typeof goals[i] !== 'string') {
      return { valid: false, error: `goals[${i}] must be a string` };
    }
    if (goals[i].trim() === '') {
      return { valid: false, error: `goals[${i}] cannot be empty` };
    }
  }

  return { valid: true };
}

export function validatePoints(value: number, fieldName: string): ValidationResult {
  if (!Number.isInteger(value) || value < 0) {
    return {
      valid: false,
      error: `${fieldName} must be a non-negative integer`
    };
  }
  return { valid: true };
}

export function validateVelocity(value: number): ValidationResult {
  if (typeof value !== 'number' || value < 0) {
    return {
      valid: false,
      error: 'velocity must be a non-negative number'
    };
  }
  return { valid: true };
}

// ============================================
// CREATE Request Validation
// ============================================

export function validateSprintRequest(request: CreateSprintRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.name) {
    errors.push('name is required');
  } else if (typeof request.name !== 'string' || request.name.trim() === '') {
    errors.push('name must be a non-empty string');
  }

  if (request.description !== undefined && request.description !== null && typeof request.description !== 'string') {
    errors.push('description must be a string');
  }

  if (!request.start_date) {
    errors.push('start_date is required');
  } else {
    const startDateValidation = validateDateFormat(request.start_date, 'start_date');
    if (!startDateValidation.valid) {
      errors.push(startDateValidation.error!);
    }
  }

  if (!request.end_date) {
    errors.push('end_date is required');
  } else {
    const endDateValidation = validateDateFormat(request.end_date, 'end_date');
    if (!endDateValidation.valid) {
      errors.push(endDateValidation.error!);
    }
  }

  if (request.start_date && request.end_date) {
    const dateRangeValidation = validateDateRange(request.start_date, request.end_date);
    if (!dateRangeValidation.valid) {
      errors.push('end_date must be greater than or equal to start_date');
    }
  }

  if (request.status !== undefined) {
    const statusValidation = validateSprintStatus(request.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (request.goals !== undefined) {
    const goalsValidation = validateGoals(request.goals);
    if (!goalsValidation.valid) {
      errors.push(goalsValidation.error!);
    }
  }

  if (request.planned_points !== undefined && request.planned_points !== null) {
    const pointsValidation = validatePoints(request.planned_points, 'planned_points');
    if (!pointsValidation.valid) {
      errors.push(pointsValidation.error!);
    }
  }

  if (request.completed_points !== undefined && request.completed_points !== null) {
    const pointsValidation = validatePoints(request.completed_points, 'completed_points');
    if (!pointsValidation.valid) {
      errors.push(pointsValidation.error!);
    }
  }

  if (request.velocity !== undefined && request.velocity !== null) {
    const velocityValidation = validateVelocity(request.velocity);
    if (!velocityValidation.valid) {
      errors.push(velocityValidation.error!);
    }
  }

  if (request.created_by !== undefined && request.created_by !== null) {
    if (typeof request.created_by !== 'string') {
      errors.push('created_by must be a string');
    } else if (!validateUUID(request.created_by)) {
      errors.push('created_by must be a valid UUID');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// GET Request Validation
// ============================================

export function validateGetRequest(request: GetSprintRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.sprint_id) {
    errors.push('sprint_id is required');
  } else if (!validateUUID(request.sprint_id)) {
    errors.push('sprint_id must be a valid UUID');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// LIST Request Validation
// ============================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function validatePagination(page?: number, limit?: number): ValidationResult {
  if (page !== undefined) {
    if (!Number.isInteger(page) || page < 1) {
      return { valid: false, error: 'page must be a positive integer (minimum: 1)' };
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

  const statusValidation = validateSprintStatuses(statuses as string[]);
  if (!statusValidation.valid) {
    return { valid: false, error: `filters.status: ${statusValidation.error}` };
  }

  return { valid: true };
}

export function validateListRequest(request: ListSprintsRequest): ValidationErrors {
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

export function validateUpdateRequest(request: UpdateSprintRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.sprint_id) {
    errors.push('sprint_id is required');
  } else if (!validateUUID(request.sprint_id)) {
    errors.push('sprint_id must be a valid UUID');
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

  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('name must be a non-empty string');
    }
  }

  if (data.description !== undefined && data.description !== null && typeof data.description !== 'string') {
    errors.push('description must be a string or null');
  }

  if (data.start_date !== undefined) {
    const startDateValidation = validateDateFormat(data.start_date, 'start_date');
    if (!startDateValidation.valid) {
      errors.push(startDateValidation.error!);
    }
  }

  if (data.end_date !== undefined) {
    const endDateValidation = validateDateFormat(data.end_date, 'end_date');
    if (!endDateValidation.valid) {
      errors.push(endDateValidation.error!);
    }
  }

  if (data.start_date !== undefined && data.end_date !== undefined) {
    const dateRangeValidation = validateDateRange(data.start_date, data.end_date);
    if (!dateRangeValidation.valid) {
      errors.push('end_date must be greater than or equal to start_date');
    }
  }

  if (data.status !== undefined) {
    const statusValidation = validateSprintStatus(data.status);
    if (!statusValidation.valid) {
      errors.push(statusValidation.error!);
    }
  }

  if (data.goals !== undefined) {
    const goalsValidation = validateGoals(data.goals);
    if (!goalsValidation.valid) {
      errors.push(goalsValidation.error!);
    }
  }

  if (data.planned_points !== undefined && data.planned_points !== null) {
    const pointsValidation = validatePoints(data.planned_points, 'planned_points');
    if (!pointsValidation.valid) {
      errors.push(pointsValidation.error!);
    }
  }

  if (data.completed_points !== undefined && data.completed_points !== null) {
    const pointsValidation = validatePoints(data.completed_points, 'completed_points');
    if (!pointsValidation.valid) {
      errors.push(pointsValidation.error!);
    }
  }

  if (data.velocity !== undefined && data.velocity !== null) {
    const velocityValidation = validateVelocity(data.velocity);
    if (!velocityValidation.valid) {
      errors.push(velocityValidation.error!);
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
