import { ValidationResult, validateUUID, validatePositiveInteger, validateTags } from '../_shared/validation.ts';
import {
  CreateProjectRequest,
  GetProjectRequest,
  ListProjectsRequest,
  UpdateProjectRequest,
  SORT_FIELDS,
  SORT_ORDERS,
  SortField,
  SortOrder
} from './types.ts';

// ============================================
// URL Validation
// ============================================

const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function validateUrl(url: string, fieldName: string = 'url'): ValidationResult {
  if (!URL_REGEX.test(url)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid URL (http or https)`
    };
  }
  return { valid: true };
}

// ============================================
// JSONB Array Validation
// ============================================

export function validateJsonbArray(value: unknown, fieldName: string): ValidationResult {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      error: `${fieldName} must be an array`
    };
  }
  return { valid: true };
}

// ============================================
// Validation Errors Interface
// ============================================

export interface ValidationErrors {
  valid: boolean;
  errors: string[];
}

// ============================================
// CREATE Request Validation
// ============================================

export function validateProjectRequest(request: CreateProjectRequest): ValidationErrors {
  const errors: string[] = [];

  // Required fields
  if (!request.name) {
    errors.push('name is required');
  } else if (typeof request.name !== 'string' || request.name.trim() === '') {
    errors.push('name must be a non-empty string');
  }

  if (!request.description) {
    errors.push('description is required');
  } else if (typeof request.description !== 'string' || request.description.trim() === '') {
    errors.push('description must be a non-empty string');
  }

  // Optional fields validation
  if (request.category !== undefined && request.category !== null) {
    if (typeof request.category !== 'string') {
      errors.push('category must be a string');
    }
  }

  if (request.tags !== undefined) {
    const tagsValidation = validateTags(request.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (request.context_data !== undefined) {
    if (typeof request.context_data !== 'object' || request.context_data === null || Array.isArray(request.context_data)) {
      errors.push('context_data must be an object');
    }
  }

  if (request.is_active !== undefined && typeof request.is_active !== 'boolean') {
    errors.push('is_active must be a boolean');
  }

  if (request.owner !== undefined && request.owner !== null) {
    if (typeof request.owner !== 'string') {
      errors.push('owner must be a string');
    } else if (!validateUUID(request.owner)) {
      errors.push('owner must be a valid UUID');
    }
  }

  if (request.leaders_managers !== undefined) {
    const leadersValidation = validateJsonbArray(request.leaders_managers, 'leaders_managers');
    if (!leadersValidation.valid) {
      errors.push(leadersValidation.error!);
    }
  }

  if (request.team_member_links !== undefined) {
    const linksValidation = validateJsonbArray(request.team_member_links, 'team_member_links');
    if (!linksValidation.valid) {
      errors.push(linksValidation.error!);
    }
  }

  if (request.git_repository_url !== undefined && request.git_repository_url !== null && request.git_repository_url !== '') {
    const urlValidation = validateUrl(request.git_repository_url, 'git_repository_url');
    if (!urlValidation.valid) {
      errors.push(urlValidation.error!);
    }
  }

  if (request.jira_url !== undefined && request.jira_url !== null && request.jira_url !== '') {
    const urlValidation = validateUrl(request.jira_url, 'jira_url');
    if (!urlValidation.valid) {
      errors.push(urlValidation.error!);
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

export function validateGetRequest(request: GetProjectRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
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

export function validateListRequest(request: ListProjectsRequest): ValidationErrors {
  const errors: string[] = [];

  // Filters validation
  if (request.filters) {
    if (request.filters.is_active !== undefined && typeof request.filters.is_active !== 'boolean') {
      errors.push('filters.is_active must be a boolean');
    }

    if (request.filters.category !== undefined && request.filters.category !== null) {
      if (typeof request.filters.category !== 'string') {
        errors.push('filters.category must be a string');
      }
    }

    if (request.filters.tags !== undefined) {
      const tagsValidation = validateTags(request.filters.tags);
      if (!tagsValidation.valid) {
        errors.push(`filters.${tagsValidation.error!}`);
      }
    }
  }

  // Pagination validation
  if (request.pagination) {
    const paginationValidation = validatePagination(request.pagination.page, request.pagination.limit);
    if (!paginationValidation.valid) {
      errors.push(paginationValidation.error!);
    }
  }

  // Sort validation
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

export function validateUpdateRequest(request: UpdateProjectRequest): ValidationErrors {
  const errors: string[] = [];

  if (!request.project_id) {
    errors.push('project_id is required');
  } else if (!validateUUID(request.project_id)) {
    errors.push('project_id must be a valid UUID');
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

  if (data.description !== undefined) {
    if (typeof data.description !== 'string' || data.description.trim() === '') {
      errors.push('description must be a non-empty string');
    }
  }

  if (data.category !== undefined && data.category !== null) {
    if (typeof data.category !== 'string') {
      errors.push('category must be a string or null');
    }
  }

  if (data.tags !== undefined) {
    const tagsValidation = validateTags(data.tags);
    if (!tagsValidation.valid) {
      errors.push(tagsValidation.error!);
    }
  }

  if (data.context_data !== undefined) {
    if (typeof data.context_data !== 'object' || data.context_data === null || Array.isArray(data.context_data)) {
      errors.push('context_data must be an object');
    }
  }

  if (data.is_active !== undefined && typeof data.is_active !== 'boolean') {
    errors.push('is_active must be a boolean');
  }

  if (data.owner !== undefined && data.owner !== null) {
    if (typeof data.owner !== 'string') {
      errors.push('owner must be a string or null');
    } else if (!validateUUID(data.owner)) {
      errors.push('owner must be a valid UUID');
    }
  }

  if (data.leaders_managers !== undefined) {
    const leadersValidation = validateJsonbArray(data.leaders_managers, 'leaders_managers');
    if (!leadersValidation.valid) {
      errors.push(leadersValidation.error!);
    }
  }

  if (data.team_member_links !== undefined) {
    const linksValidation = validateJsonbArray(data.team_member_links, 'team_member_links');
    if (!linksValidation.valid) {
      errors.push(linksValidation.error!);
    }
  }

  if (data.git_repository_url !== undefined && data.git_repository_url !== null && data.git_repository_url !== '') {
    const urlValidation = validateUrl(data.git_repository_url, 'git_repository_url');
    if (!urlValidation.valid) {
      errors.push(urlValidation.error!);
    }
  }

  if (data.jira_url !== undefined && data.jira_url !== null && data.jira_url !== '') {
    const urlValidation = validateUrl(data.jira_url, 'jira_url');
    if (!urlValidation.valid) {
      errors.push(urlValidation.error!);
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
