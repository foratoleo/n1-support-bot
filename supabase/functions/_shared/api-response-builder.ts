import { formatSuccessResponse, formatErrorResponse } from './response-formatter.ts';

// ============================================
// CORS Configuration
// ============================================

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// Common Response Types
// ============================================

export interface PaginationMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BasePaginatedResponseMetadata<TFilters> {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  appliedFilters: TFilters;
}

// ============================================
// CORS Response
// ============================================

export function createCorsResponse(): Response {
  return new Response('ok', { headers: CORS_HEADERS });
}

// ============================================
// Success Response
// ============================================

export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  processingTimeMs: number,
  statusCode = 201
): Response {
  return new Response(
    JSON.stringify({ ...formatSuccessResponse(data), requestId }),
    {
      status: statusCode,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'X-Processing-Time-Ms': processingTimeMs.toString(),
      }
    }
  );
}

// ============================================
// Error Response
// ============================================

export function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  statusCode: number,
  retryable = false,
  details?: unknown,
  processingTimeMs?: number
): Response {
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
  };

  if (processingTimeMs !== undefined) {
    headers['X-Processing-Time-Ms'] = processingTimeMs.toString();
  }

  return new Response(
    JSON.stringify(formatErrorResponse(code, message, requestId, retryable, details)),
    { status: statusCode, headers }
  );
}

// ============================================
// Paginated Response Factory
// ============================================

export function createPaginatedResponseFactory<TFilters>(itemsKey: string) {
  return function createPaginatedResponse<T>(
    items: T[],
    requestId: string,
    processingTimeMs: number,
    metadata: BasePaginatedResponseMetadata<TFilters>
  ): Response {
    const totalPages = Math.ceil(metadata.totalCount / metadata.pageSize);
    const hasNextPage = metadata.currentPage < totalPages;
    const hasPreviousPage = metadata.currentPage > 1;

    const pagination: PaginationMetadata = {
      totalCount: metadata.totalCount,
      currentPage: metadata.currentPage,
      pageSize: metadata.pageSize,
      totalPages,
      hasNextPage,
      hasPreviousPage
    };

    const responseData = {
      [itemsKey]: items,
      pagination,
      appliedFilters: metadata.appliedFilters
    };

    return new Response(
      JSON.stringify({ ...formatSuccessResponse(responseData), requestId }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTimeMs.toString(),
        }
      }
    );
  };
}
