/**
 * Custom error class for API-related errors
 * Extends the base Error class with additional API-specific properties
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRetryable: boolean,
    public apiResponse?: any
  ) {
    super(message);
    this.name = 'ApiError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}
