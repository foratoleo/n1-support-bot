import {
  CORS_HEADERS,
  createCorsResponse,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponseFactory,
} from '../_shared/api-response-builder.ts';
import type {
  PaginationMetadata,
  BasePaginatedResponseMetadata
} from '../_shared/api-response-builder.ts';
import type { ListFilters } from './types.ts';

// Re-export shared utilities
export {
  CORS_HEADERS,
  createCorsResponse,
  createSuccessResponse,
  createErrorResponse,
};
export type { PaginationMetadata };

// Create endpoint-specific paginated response function
export type PaginatedResponseMetadata = BasePaginatedResponseMetadata<ListFilters>;

export const createPaginatedResponse = createPaginatedResponseFactory<ListFilters>('projects');
