import {
  ValidationResult,
  validateUUID,
  validateTimestamp,
  validateTimestampRange,
  validateTags as validateTagsShared
} from '../_shared/validation.ts';
import {
  CreateMeetingRequest,
  GetMeetingRequest,
  ListMeetingsRequest,
  UpdateMeetingRequest,
  SORT_FIELDS,
  SORT_ORDERS,
  SortField,
  SortOrder
} from './types.ts';

// ============================================
// Shared Validation Helpers
// ============================================

export interface ValidationErrors {
  valid: boolean;
  errors: string[];
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function validateTags(tags: unknown): ValidationResult {
  return validateTagsShared(tags);
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

export function validateDateRange(dateFrom?: string, dateTo?: string): ValidationResult {
  if (dateFrom !== undefined) {
    const fromValidation = validateTimestamp(dateFrom, 'date_from');
    if (!fromValidation.valid) {
      return fromValidation;
    }
  }

  if (dateTo !== undefined) {
    const toValidation = validateTimestamp(dateTo, 'date_to');
    if (!toValidation.valid) {
      return toValidation;
    }
  }

  if (dateFrom !== undefined && dateTo !== undefined) {
    return validateTimestampRange(dateFrom, dateTo);
  }

  return { valid: true };
}

// ============================================
// CREATE Request Validation
// ============================================

export function validateMeetingRequest(request: CreateMeetingRequest): ValidationErrors {
  const errors: string[] = [];

  // project_id is optional but must be valid UUID if provided
  if (request.project_id !== undefined && request.project_id !== null) {
    if (!validateUUID(request.project_id)) {
      errors.push('project_id must be a valid UUID');
    }
  }

  // title is required
  if (!request.title) {
    errors.push('title is required');
  } else if (typeof request.title !== 'string' || request.title.trim() === '') {
    errors.push('title must be a non-empty string');
  }

  // transcript_text is required
  if (!request.transcript_text) {
    errors.push('transcript_text is required');
  } else if (typeof request.transcript_text !== 'string') {
    errors.push('transcript_text must be a string');
  }

  // description is optional
  if (request.description !== undefined && typeof request.description !== 'string') {
    errors.push('description must be a string');
  }

  // meeting_date is optional, defaults to now
  if (request.meeting_date !== undefined) {
    const dateValidation = validateTimestamp(request.meeting_date, 'meeting_date');
    if (!dateValidation.valid) {
      errors.push(dateValidation.error!);
    }
  }

  // transcript_metadata is optional
  if (request.transcript_metadata !== undefined) {
    if (typeof request.transcript_metadata !== 'object' || request.transcript_metadata === null || Array.isArray(request.transcript_metadata)) {
      errors.push('transcript_metadata must be an object');
    }
  }

  // tags is optional
  if (request.tags !== undefined) {
    const tagsValidation = validateTags(request.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  // is_public is optional
  if (request.is_public !== undefined && typeof request.is_public !== 'boolean') {
    errors.push('is_public must be a boolean');
  }

  // created_by is optional
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

export function validateGetRequest(request: GetMeetingRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.meeting_id) {
    errors.push('meeting_id is required');
  } else if (!validateUUID(request.meeting_id)) {
    errors.push('meeting_id must be a valid UUID');
  }

  // project_id is optional but must be valid UUID if provided
  if (request.project_id !== undefined && request.project_id !== null) {
    if (typeof request.project_id === 'string' && request.project_id !== '' && !validateUUID(request.project_id)) {
      errors.push('project_id must be a valid UUID');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ============================================
// LIST Request Validation
// ============================================

export function validateListRequest(request: ListMeetingsRequest): ValidationErrors {
  const errors: string[] = [];

  // project_id in request root is optional
  if (request.project_id !== undefined && request.project_id !== null) {
    if (typeof request.project_id === 'string' && request.project_id !== '' && !validateUUID(request.project_id)) {
      errors.push('project_id must be a valid UUID');
    }
  }

  if (request.filters) {
    // date_from and date_to validation
    const dateRangeValidation = validateDateRange(request.filters.date_from, request.filters.date_to);
    if (!dateRangeValidation.valid) {
      errors.push(dateRangeValidation.error!);
    }

    // is_public validation
    if (request.filters.is_public !== undefined && typeof request.filters.is_public !== 'boolean') {
      errors.push('filters.is_public must be a boolean');
    }

    // tags validation
    if (request.filters.tags !== undefined) {
      const tagsValidation = validateTags(request.filters.tags);
      if (!tagsValidation.valid) {
        errors.push(`filters.${tagsValidation.error!}`);
      }
    }

    // project_id in filters is optional
    if (request.filters.project_id !== undefined && request.filters.project_id !== null) {
      if (typeof request.filters.project_id === 'string' && request.filters.project_id !== '' && !validateUUID(request.filters.project_id)) {
        errors.push('filters.project_id must be a valid UUID');
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

export function validateUpdateRequest(request: UpdateMeetingRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.meeting_id) {
    errors.push('meeting_id is required');
  } else if (!validateUUID(request.meeting_id)) {
    errors.push('meeting_id must be a valid UUID');
  }

  // project_id is optional but must be valid UUID if provided
  if (request.project_id !== undefined && request.project_id !== null) {
    if (typeof request.project_id === 'string' && request.project_id !== '' && !validateUUID(request.project_id)) {
      errors.push('project_id must be a valid UUID');
    }
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

  if (data.transcript_text !== undefined) {
    if (typeof data.transcript_text !== 'string') {
      errors.push('transcript_text must be a string');
    }
  }

  if (data.transcript_metadata !== undefined) {
    if (typeof data.transcript_metadata !== 'object' || data.transcript_metadata === null || Array.isArray(data.transcript_metadata)) {
      errors.push('transcript_metadata must be an object');
    }
  }

  if (data.meeting_date !== undefined) {
    const dateValidation = validateTimestamp(data.meeting_date, 'meeting_date');
    if (!dateValidation.valid) {
      errors.push(dateValidation.error!);
    }
  }

  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (data.is_public !== undefined && typeof data.is_public !== 'boolean') {
    errors.push('is_public must be a boolean');
  }

  if (data.project_id !== undefined && data.project_id !== null) {
    if (typeof data.project_id !== 'string' || !validateUUID(data.project_id)) {
      errors.push('project_id must be a valid UUID or null');
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
