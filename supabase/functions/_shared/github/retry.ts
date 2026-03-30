/**
 * Retry Logic for GitHub API Operations
 *
 * Provides robust retry functionality with exponential backoff,
 * jitter, and configurable retry conditions.
 *
 * @module github/retry
 */

import { GitHubApiError, isGitHubApiError } from './error-handler.ts';

/**
 * Options for configuring retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Jitter factor (0-1, default: 0.2) */
  jitterFactor?: number;
  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback for logging retry attempts */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
  /** Operation name for logging (optional) */
  operationName?: string;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry' | 'operationName'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  jitterFactor: 0.2,
};

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result value (if success) */
  data?: T;
  /** The error (if failure) */
  error?: unknown;
  /** Number of attempts made */
  attempts: number;
  /** Total time spent in ms */
  totalTimeMs: number;
}

/**
 * Calculates delay with exponential backoff and optional jitter.
 *
 * @param attempt - Current attempt number (0-based)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @param jitter - Whether to add jitter
 * @param jitterFactor - Jitter factor (0-1)
 * @returns Delay in milliseconds
 */
export function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: boolean = true,
  jitterFactor: number = 0.2
): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Add jitter if enabled
  if (jitter) {
    const jitterRange = cappedDelay * jitterFactor;
    const jitterValue = (Math.random() * 2 - 1) * jitterRange;
    return Math.max(0, Math.floor(cappedDelay + jitterValue));
  }

  return Math.floor(cappedDelay);
}

/**
 * Default function to determine if an error should be retried.
 *
 * @param error - The error to check
 * @param attempt - Current attempt number
 * @returns true if the error should be retried
 */
export function defaultShouldRetry(error: unknown, _attempt: number): boolean {
  // GitHubApiError has explicit retry information
  if (isGitHubApiError(error)) {
    return error.isRetryable;
  }

  // Network errors are generally retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Abort errors (timeouts) are retryable
  if (error instanceof Error && error.name === 'AbortError') {
    return true;
  }

  // Generic errors - don't retry by default
  return false;
}

/**
 * Default logging callback for retry attempts.
 *
 * @param error - The error that triggered the retry
 * @param attempt - Current attempt number
 * @param delay - Delay before next attempt
 * @param operationName - Optional operation name
 */
function defaultOnRetry(
  error: unknown,
  attempt: number,
  delay: number,
  operationName?: string
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = isGitHubApiError(error) ? ` [${error.code}]` : '';
  const opName = operationName ? `[${operationName}] ` : '';

  console.warn(
    `${opName}Retry attempt ${attempt} after ${delay}ms${errorCode}: ${errorMessage}`
  );
}

/**
 * Sleep for a specified duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after the duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes an async function with retry logic using exponential backoff.
 *
 * Features:
 * - Exponential backoff with configurable base and max delay
 * - Optional jitter to prevent thundering herd
 * - Custom retry conditions via shouldRetry predicate
 * - Logging of retry attempts
 * - Rate limit awareness for GitHubApiError
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to the function result
 * @throws The last error if all retries fail
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await withRetry(
 *   () => fetchPullRequests(owner, repo),
 *   { maxRetries: 3 }
 * );
 *
 * // With custom retry logic
 * const result = await withRetry(
 *   () => fetchPullRequests(owner, repo),
 *   {
 *     maxRetries: 5,
 *     shouldRetry: (error, attempt) => {
 *       if (isGitHubApiError(error) && error.category === 'RATE_LIMIT') {
 *         return attempt < 3;
 *       }
 *       return defaultShouldRetry(error, attempt);
 *     },
 *     onRetry: (error, attempt, delay) => {
 *       logger.warn(`Retry ${attempt} in ${delay}ms`, { error });
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_RETRY_OPTIONS.maxRetries,
    baseDelay = DEFAULT_RETRY_OPTIONS.baseDelay,
    maxDelay = DEFAULT_RETRY_OPTIONS.maxDelay,
    jitter = DEFAULT_RETRY_OPTIONS.jitter,
    jitterFactor = DEFAULT_RETRY_OPTIONS.jitterFactor,
    shouldRetry = defaultShouldRetry,
    onRetry,
    operationName,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we've exhausted all retries
      if (attempt >= maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        break;
      }

      // Calculate delay
      let delay: number;

      // For rate limit errors, use the provided reset time if available
      if (isGitHubApiError(error) && error.rateLimitReset) {
        const waitTime = error.getWaitTimeMs();
        // Cap rate limit wait time at maxDelay
        delay = Math.min(waitTime, maxDelay);
      } else {
        delay = calculateDelay(attempt, baseDelay, maxDelay, jitter, jitterFactor);
      }

      // Log retry attempt
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      } else {
        defaultOnRetry(error, attempt + 1, delay, operationName);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // All retries exhausted, throw the last error
  throw lastError;
}

/**
 * Executes an async function with retry logic and returns a result object
 * instead of throwing on failure.
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns RetryResult with success status, data/error, and metrics
 *
 * @example
 * ```typescript
 * const result = await withRetrySafe(() => fetchPullRequests(owner, repo));
 *
 * if (result.success) {
 *   console.log('Got PRs:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function withRetrySafe<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  const wrappedOptions: RetryOptions = {
    ...options,
    onRetry: (error, attempt, delay) => {
      attempts = attempt;
      if (options.onRetry) {
        options.onRetry(error, attempt, delay);
      }
    },
  };

  try {
    const data = await withRetry(fn, wrappedOptions);
    return {
      success: true,
      data,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error,
      attempts: attempts + 1,
      totalTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Creates a retryable version of an async function.
 *
 * @param fn - The async function to make retryable
 * @param options - Default retry options for all calls
 * @returns A new function that automatically retries on failure
 *
 * @example
 * ```typescript
 * const retryableFetch = retryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * );
 *
 * // Now calls will automatically retry
 * const data = await retryableFetch('https://api.github.com/...');
 * ```
 */
export function retryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Wraps multiple async operations to run with individual retry logic.
 *
 * Unlike Promise.all, this function will retry individual operations
 * that fail without affecting successful ones.
 *
 * @param operations - Array of async functions to execute
 * @param options - Retry options for each operation
 * @returns Array of results in the same order as input
 *
 * @example
 * ```typescript
 * const results = await retryAll([
 *   () => fetchPR(1),
 *   () => fetchPR(2),
 *   () => fetchPR(3),
 * ], { maxRetries: 2 });
 *
 * results.forEach((result, i) => {
 *   if (result.success) {
 *     console.log(`PR ${i + 1}:`, result.data);
 *   } else {
 *     console.error(`PR ${i + 1} failed:`, result.error);
 *   }
 * });
 * ```
 */
export async function retryAll<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<RetryResult<T>>> {
  return Promise.all(
    operations.map(op => withRetrySafe(op, options))
  );
}
