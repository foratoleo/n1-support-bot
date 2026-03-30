/**
 * Type definitions for the api-rag-search Edge Function
 *
 * This module defines the request/response types and validation logic
 * for the REST API search endpoint that accepts natural language queries
 * and returns enriched search results.
 *
 * @module api-rag-search/types
 */

import { validateUUID, validateEnum } from '../_shared/validation.ts';

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid source tables for search operations.
 */
export const VALID_SOURCE_TABLES = [
  'features',
  'backlog_items',
  'generated_documents',
  'meeting_transcripts',
  'sprints',
] as const;

/**
 * Valid search modes for query processing.
 */
export const VALID_SEARCH_MODES = ['semantic', 'keyword', 'hybrid'] as const;

/**
 * Query constraints.
 */
export const QUERY_MIN_LENGTH = 1;
export const QUERY_MAX_LENGTH = 10000;
export const LIMIT_MIN = 1;
export const LIMIT_MAX = 100;
export const OFFSET_MIN = 0;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Valid source tables for search operations.
 */
export type SourceTable = typeof VALID_SOURCE_TABLES[number];

/**
 * Valid search modes for query processing.
 */
export type SearchMode = typeof VALID_SEARCH_MODES[number];

/**
 * Request payload for the api-rag-search Edge Function.
 */
export interface ApiRagSearchRequest {
  /** The natural language query to search for (required) */
  query: string;
  /** Project ID to scope the search (optional, UUID format) */
  projectId?: string;
  /** Filter by specific source table (optional) */
  sourceTable?: SourceTable;
  /** Filter by content types within the source (optional) */
  contentTypes?: string[];
  /** Search mode: semantic (embeddings), keyword (full-text), or hybrid (optional) */
  searchMode?: SearchMode;
  /** Maximum number of results to return (optional, 1-100, default: 10) */
  limit?: number;
  /** Number of results to skip for pagination (optional, >= 0, default: 0) */
  offset?: number;
}

/**
 * A single enriched search result.
 */
export interface SearchResult {
  /** Unique identifier for this result */
  id: string;
  /** Display title of the result */
  title: string;
  /** Type/category of the result (e.g., 'feature', 'document', 'transcript') */
  type: string;
  /** Relevance score (0-1, higher is more relevant) */
  relevanceScore: number;
  /** Text snippet showing relevant content */
  snippet: string;
  /** Link/URL to the full resource */
  link: string;
  /** Source table where this result originated */
  sourceTable: SourceTable;
  /** ID of the source record in the table */
  sourceId: string;
  /** Project ID this result belongs to */
  projectId: string;
}

/**
 * Pagination metadata for search results.
 */
export interface PaginationMetadata {
  /** Total number of matching results */
  totalCount: number;
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Number of results per page */
  pageSize: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * Error response structure.
 */
export interface ErrorResponse {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Request ID for correlation and debugging */
  requestId: string;
}

/**
 * Response from the api-rag-search Edge Function.
 */
export interface ApiRagSearchResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** The search results (empty array if no matches) */
  results: SearchResult[];
  /** Pagination metadata */
  pagination: PaginationMetadata;
  /** Query processing time in milliseconds */
  processingTimeMs: number;
  /** Error details if success is false */
  error?: ErrorResponse;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of request validation.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** The validated and typed request if validation passed */
  request?: ApiRagSearchRequest;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates the query string.
 *
 * @param query - The query string to validate
 * @returns ValidationResult indicating success or failure with error message
 */
function validateQuery(query: unknown): ValidationResult {
  if (query === undefined || query === null) {
    return { valid: false, error: 'query is required' };
  }

  if (typeof query !== 'string') {
    return { valid: false, error: 'query must be a string' };
  }

  const trimmedQuery = query.trim();

  if (trimmedQuery.length === 0) {
    return { valid: false, error: 'query cannot be empty or whitespace only' };
  }

  if (trimmedQuery.length > QUERY_MAX_LENGTH) {
    return {
      valid: false,
      error: `query must be ${QUERY_MAX_LENGTH} characters or less (received ${trimmedQuery.length})`,
    };
  }

  return { valid: true };
}

/**
 * Validates the projectId field (UUID format).
 *
 * @param projectId - The project ID to validate
 * @returns ValidationResult indicating success or failure
 */
function validateProjectId(projectId: unknown): ValidationResult {
  if (projectId === undefined || projectId === null) {
    return { valid: true }; // Optional field
  }

  if (typeof projectId !== 'string') {
    return { valid: false, error: 'projectId must be a string' };
  }

  if (!validateUUID(projectId)) {
    return {
      valid: false,
      error: 'projectId must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)',
    };
  }

  return { valid: true };
}

/**
 * Validates the sourceTable field.
 *
 * @param sourceTable - The source table to validate
 * @returns ValidationResult indicating success or failure
 */
function validateSourceTable(sourceTable: unknown): ValidationResult {
  if (sourceTable === undefined || sourceTable === null) {
    return { valid: true }; // Optional field
  }

  if (typeof sourceTable !== 'string') {
    return { valid: false, error: 'sourceTable must be a string' };
  }

  const validTables = VALID_SOURCE_TABLES.join(', ');
  const result = validateEnum(sourceTable, VALID_SOURCE_TABLES, 'sourceTable');

  if (!result.valid) {
    return {
      valid: false,
      error: `Invalid sourceTable: ${sourceTable}. Valid values are: ${validTables}`,
    };
  }

  return { valid: true };
}

/**
 * Validates the searchMode field.
 *
 * @param searchMode - The search mode to validate
 * @returns ValidationResult indicating success or failure
 */
function validateSearchMode(searchMode: unknown): ValidationResult {
  if (searchMode === undefined || searchMode === null) {
    return { valid: true }; // Optional field
  }

  if (typeof searchMode !== 'string') {
    return { valid: false, error: 'searchMode must be a string' };
  }

  const validModes = VALID_SEARCH_MODES.join(', ');
  const result = validateEnum(searchMode, VALID_SEARCH_MODES, 'searchMode');

  if (!result.valid) {
    return {
      valid: false,
      error: `Invalid searchMode: ${searchMode}. Valid values are: ${validModes}`,
    };
  }

  return { valid: true };
}

/**
 * Validates the contentTypes field.
 *
 * @param contentTypes - The content types array to validate
 * @returns ValidationResult indicating success or failure
 */
function validateContentTypes(contentTypes: unknown): ValidationResult {
  if (contentTypes === undefined || contentTypes === null) {
    return { valid: true }; // Optional field
  }

  if (!Array.isArray(contentTypes)) {
    return { valid: false, error: 'contentTypes must be an array of strings' };
  }

  for (let i = 0; i < contentTypes.length; i++) {
    if (typeof contentTypes[i] !== 'string') {
      return { valid: false, error: `contentTypes[${i}] must be a string` };
    }
  }

  return { valid: true };
}

/**
 * Validates pagination parameters (limit and offset).
 *
 * @param limit - The limit value to validate
 * @param offset - The offset value to validate
 * @returns ValidationResult indicating success or failure
 */
function validatePagination(limit: unknown, offset: unknown): ValidationResult {
  // Validate limit
  if (limit !== undefined && limit !== null) {
    if (typeof limit !== 'number' || !Number.isInteger(limit)) {
      return { valid: false, error: 'limit must be an integer' };
    }

    if (limit < LIMIT_MIN) {
      return { valid: false, error: `limit must be at least ${LIMIT_MIN}` };
    }

    if (limit > LIMIT_MAX) {
      return { valid: false, error: `limit must be at most ${LIMIT_MAX}` };
    }
  }

  // Validate offset
  if (offset !== undefined && offset !== null) {
    if (typeof offset !== 'number' || !Number.isInteger(offset)) {
      return { valid: false, error: 'offset must be an integer' };
    }

    if (offset < OFFSET_MIN) {
      return { valid: false, error: `offset must be at least ${OFFSET_MIN}` };
    }
  }

  return { valid: true };
}

/**
 * Validates an API search request.
 *
 * This function performs comprehensive validation of all request fields,
 * returning clear error messages for invalid or missing values.
 *
 * @param body - The raw request body to validate
 * @returns ValidationResult with validated request or error message
 *
 * @example
 * ```typescript
 * const result = validateRequest({
 *   query: 'authentication issues',
 *   projectId: '123e4567-e89b-12d3-a456-426614174000',
 *   limit: 20
 * });
 *
 * if (result.valid) {
 *   console.log('Valid request:', result.request);
 * } else {
 *   console.log('Validation error:', result.error);
 * }
 * ```
 */
export function validateRequest(body: unknown): ValidationResult {
  // Check if body is an object
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const request = body as Record<string, unknown>;

  // Validate required query field
  const queryResult = validateQuery(request.query);
  if (!queryResult.valid) {
    return queryResult;
  }

  // Validate optional projectId
  const projectIdResult = validateProjectId(request.projectId);
  if (!projectIdResult.valid) {
    return projectIdResult;
  }

  // Validate optional sourceTable
  const sourceTableResult = validateSourceTable(request.sourceTable);
  if (!sourceTableResult.valid) {
    return sourceTableResult;
  }

  // Validate optional searchMode
  const searchModeResult = validateSearchMode(request.searchMode);
  if (!searchModeResult.valid) {
    return searchModeResult;
  }

  // Validate optional contentTypes
  const contentTypesResult = validateContentTypes(request.contentTypes);
  if (!contentTypesResult.valid) {
    return contentTypesResult;
  }

  // Validate pagination parameters
  const paginationResult = validatePagination(request.limit, request.offset);
  if (!paginationResult.valid) {
    return paginationResult;
  }

  // Build the validated request object
  const validatedRequest: ApiRagSearchRequest = {
    query: (request.query as string).trim(),
  };

  // Add optional fields if present
  if (request.projectId !== undefined && request.projectId !== null) {
    validatedRequest.projectId = request.projectId as string;
  }

  if (request.sourceTable !== undefined && request.sourceTable !== null) {
    validatedRequest.sourceTable = request.sourceTable as SourceTable;
  }

  if (request.searchMode !== undefined && request.searchMode !== null) {
    validatedRequest.searchMode = request.searchMode as SearchMode;
  }

  if (request.contentTypes !== undefined && request.contentTypes !== null) {
    validatedRequest.contentTypes = request.contentTypes as string[];
  }

  if (request.limit !== undefined && request.limit !== null) {
    validatedRequest.limit = request.limit as number;
  }

  if (request.offset !== undefined && request.offset !== null) {
    validatedRequest.offset = request.offset as number;
  }

  return { valid: true, request: validatedRequest };
}
