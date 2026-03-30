// ============================================
// Database Configuration
// ============================================

export const QUERY_TIMEOUT_MS = 10000;

// ============================================
// Query Timeout Wrapper
// ============================================

export async function executeWithTimeout<T>(
  query: PromiseLike<T>,
  operationName: string,
  timeoutMs: number = QUERY_TIMEOUT_MS
): Promise<T> {
  const startTime = Date.now();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  try {
    const result = await Promise.race([query, timeoutPromise]);
    console.log(`[DatabaseService] ${operationName} completed in ${Date.now() - startTime}ms`);
    return result;
  } catch (error) {
    console.error(`[DatabaseService] ${operationName} error:`, error);
    throw error;
  }
}

// ============================================
// Database Error Handler
// ============================================

export interface DatabaseError {
  code?: string;
  message: string;
}

export function handleDatabaseError(error: DatabaseError): never {
  if (error.code === '23503') {
    throw new Error('FOREIGN_KEY_VIOLATION: Referenced record does not exist');
  }
  if (error.code === '42501') {
    throw new Error('PERMISSION_DENIED: Insufficient permissions');
  }
  if (error.code === '23505') {
    throw new Error('UNIQUE_VIOLATION: Duplicate record');
  }
  throw new Error(`DATABASE_ERROR: ${error.message}`);
}

// ============================================
// Pagination Utilities
// ============================================

export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 50,
  maxLimit: 100
} as const;

export function calculatePaginationRange(
  page: number,
  limit: number
): { start: number; end: number } {
  const start = (page - 1) * limit;
  const end = start + limit - 1;
  return { start, end };
}
