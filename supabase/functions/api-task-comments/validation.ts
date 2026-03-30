import {
  ValidationResult,
  validateUUID
} from '../_shared/validation.ts';
import {
  CreateCommentRequest,
  ListCommentsRequest,
  UpdateCommentRequest,
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

export function validateCreateRequest(request: CreateCommentRequest): ValidationErrors {
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

  if (!request.author_id) {
    errors.push('author_id is required');
  } else if (!validateUUID(request.author_id)) {
    errors.push('author_id must be a valid UUID');
  }

  if (!request.content) {
    errors.push('content is required');
  } else if (typeof request.content !== 'string' || request.content.trim() === '') {
    errors.push('content must be a non-empty string');
  }

  if (request.mentioned_members !== undefined) {
    if (!Array.isArray(request.mentioned_members)) {
      errors.push('mentioned_members must be an array');
    } else {
      for (let i = 0; i < request.mentioned_members.length; i++) {
        if (!validateUUID(request.mentioned_members[i])) {
          errors.push(`mentioned_members[${i}] must be a valid UUID`);
        }
      }
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

export function validateListRequest(request: ListCommentsRequest): ValidationErrors {
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

export function validateUpdateRequest(request: UpdateCommentRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
  }

  if (!request.comment_id) {
    errors.push('comment_id is required');
  } else if (!validateUUID(request.comment_id)) {
    errors.push('comment_id must be a valid UUID');
  }

  if (!request.author_id) {
    errors.push('author_id is required');
  } else if (!validateUUID(request.author_id)) {
    errors.push('author_id must be a valid UUID');
  }

  if (!request.data || typeof request.data !== 'object') {
    errors.push('data is required and must be an object');
    return { valid: false, errors };
  }

  if (!request.data.content) {
    errors.push('data.content is required');
  } else if (typeof request.data.content !== 'string' || request.data.content.trim() === '') {
    errors.push('data.content must be a non-empty string');
  }

  if (request.data.mentioned_members !== undefined) {
    if (!Array.isArray(request.data.mentioned_members)) {
      errors.push('data.mentioned_members must be an array');
    } else {
      for (let i = 0; i < request.data.mentioned_members.length; i++) {
        if (!validateUUID(request.data.mentioned_members[i])) {
          errors.push(`data.mentioned_members[${i}] must be a valid UUID`);
        }
      }
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
