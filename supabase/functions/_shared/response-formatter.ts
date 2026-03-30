export interface ResponseMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  appliedFilters: Record<string, any>;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetails;
  requestId: string;
  timestamp: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  metadata?: ResponseMetadata;
}

export function formatSuccessResponse<T>(
  data: T,
  totalCount?: number,
  currentPage?: number,
  pageSize?: number,
  appliedFilters?: Record<string, any>
): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data
  };

  if (totalCount !== undefined && currentPage !== undefined && pageSize !== undefined) {
    const totalPages = Math.ceil(totalCount / pageSize);

    response.metadata = {
      totalCount,
      currentPage,
      pageSize,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      appliedFilters: appliedFilters || {}
    };
  }

  return response;
}

export function formatErrorResponse(
  code: string,
  message: string,
  requestId: string,
  retryable: boolean = true,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      retryable
    },
    requestId,
    timestamp: new Date().toISOString()
  };
}

export function generateCacheKey(...args: any[]): string {
  return args.map(arg => {
    if (Array.isArray(arg)) {
      return arg.sort().join(',');
    }
    return arg?.toString() || 'null';
  }).join(':');
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);

  const result: any = {};
  for (const key in obj) {
    const camelKey = toCamelCase(key);
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}
