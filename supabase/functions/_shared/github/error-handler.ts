/**
 * GitHub API Error Handler
 *
 * Provides comprehensive error handling for GitHub API interactions
 * with categorization, retry hints, and structured error responses.
 *
 * @module github/error-handler
 */

/**
 * Error severity levels for GitHub API errors
 */
export enum GitHubErrorSeverity {
  /** System failure, immediate attention required */
  CRITICAL = 'critical',
  /** Operation failure, needs resolution */
  ERROR = 'error',
  /** Degraded performance or partial failure */
  WARNING = 'warning',
  /** Informational, no action required */
  INFO = 'info',
}

/**
 * Error categories for GitHub API errors
 */
export enum GitHubErrorCategory {
  /** Authentication and authorization errors */
  AUTHENTICATION = 'AUTHENTICATION',
  /** Rate limiting errors */
  RATE_LIMIT = 'RATE_LIMIT',
  /** Resource not found errors */
  NOT_FOUND = 'NOT_FOUND',
  /** Validation and bad request errors */
  VALIDATION = 'VALIDATION',
  /** Server errors (5xx) */
  SERVER = 'SERVER',
  /** Network errors (timeout, connection) */
  NETWORK = 'NETWORK',
  /** Permission/access errors */
  PERMISSION = 'PERMISSION',
  /** Unknown or unclassified errors */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error codes specific to GitHub API integration
 */
export enum GitHubErrorCode {
  // Authentication errors (100-199)
  GH_100 = 'GH_100', // Invalid or expired token
  GH_101 = 'GH_101', // Token lacks required scopes
  GH_102 = 'GH_102', // Token revoked
  GH_103 = 'GH_103', // SSO authorization required

  // Rate limiting errors (200-299)
  GH_200 = 'GH_200', // Primary rate limit exceeded
  GH_201 = 'GH_201', // Secondary rate limit exceeded
  GH_202 = 'GH_202', // Search rate limit exceeded

  // Not found errors (300-399)
  GH_300 = 'GH_300', // Repository not found
  GH_301 = 'GH_301', // Pull request not found
  GH_302 = 'GH_302', // User/Organization not found
  GH_303 = 'GH_303', // Branch not found

  // Validation errors (400-499)
  GH_400 = 'GH_400', // Invalid request format
  GH_401 = 'GH_401', // Invalid repository URL
  GH_402 = 'GH_402', // Invalid PR number
  GH_403 = 'GH_403', // Missing required parameter

  // Server errors (500-599)
  GH_500 = 'GH_500', // GitHub server error
  GH_501 = 'GH_501', // Service unavailable
  GH_502 = 'GH_502', // Bad gateway

  // Network errors (600-699)
  GH_600 = 'GH_600', // Connection timeout
  GH_601 = 'GH_601', // Connection refused
  GH_602 = 'GH_602', // DNS resolution failed

  // Permission errors (700-799)
  GH_700 = 'GH_700', // Repository access denied
  GH_701 = 'GH_701', // Organization access denied
  GH_702 = 'GH_702', // Resource requires admin access
}

/**
 * Options for configuring GitHubApiError
 */
export interface GitHubApiErrorOptions {
  /** Error code */
  code: GitHubErrorCode;
  /** Error category */
  category: GitHubErrorCategory;
  /** Error severity */
  severity: GitHubErrorSeverity;
  /** Human-readable error message */
  message: string;
  /** User-friendly message for display */
  userMessage: string;
  /** HTTP status code */
  statusCode?: number;
  /** Rate limit reset timestamp (Unix epoch seconds) */
  rateLimitReset?: number;
  /** Whether the error is retryable */
  isRetryable: boolean;
  /** Original error that caused this error */
  cause?: Error;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Custom error class for GitHub API errors.
 *
 * Provides structured error information including:
 * - Error categorization and severity
 * - Retry information
 * - Rate limit reset timing
 * - User-friendly messages
 *
 * @example
 * ```typescript
 * try {
 *   await fetchPullRequests();
 * } catch (error) {
 *   if (error instanceof GitHubApiError) {
 *     if (error.isRetryable && error.rateLimitReset) {
 *       const waitTime = error.getWaitTimeMs();
 *       await sleep(waitTime);
 *       // Retry...
 *     }
 *   }
 * }
 * ```
 */
export class GitHubApiError extends Error {
  /** Error code for identification */
  public readonly code: GitHubErrorCode;
  /** Error category for grouping */
  public readonly category: GitHubErrorCategory;
  /** Severity level */
  public readonly severity: GitHubErrorSeverity;
  /** HTTP status code */
  public readonly statusCode: number;
  /** Rate limit reset timestamp (Unix epoch seconds) */
  public readonly rateLimitReset?: number;
  /** Whether this error is retryable */
  public readonly isRetryable: boolean;
  /** User-friendly error message */
  public readonly userMessage: string;
  /** Additional context data */
  public readonly context?: Record<string, unknown>;

  constructor(options: GitHubApiErrorOptions) {
    super(options.message);
    this.name = 'GitHubApiError';
    this.code = options.code;
    this.category = options.category;
    this.severity = options.severity;
    this.statusCode = options.statusCode ?? 500;
    this.rateLimitReset = options.rateLimitReset;
    this.isRetryable = options.isRetryable;
    this.userMessage = options.userMessage;
    this.context = options.context;

    // Set the cause if provided
    if (options.cause) {
      this.cause = options.cause;
    }

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GitHubApiError);
    }
  }

  /**
   * Get wait time in milliseconds until rate limit resets.
   * Returns 0 if no rate limit reset time is set.
   */
  getWaitTimeMs(): number {
    if (!this.rateLimitReset) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const waitSeconds = Math.max(0, this.rateLimitReset - now);
    return waitSeconds * 1000;
  }

  /**
   * Convert to a structured log format.
   */
  toLogFormat(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      severity: this.severity,
      statusCode: this.statusCode,
      message: this.message,
      userMessage: this.userMessage,
      isRetryable: this.isRetryable,
      rateLimitReset: this.rateLimitReset,
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * Convert to an API response format.
   */
  toApiFormat(): Record<string, unknown> {
    return {
      success: false,
      error: {
        code: this.code,
        category: this.category,
        message: this.userMessage,
        retryable: this.isRetryable,
        retryAfter: this.rateLimitReset ? this.getWaitTimeMs() / 1000 : undefined,
      },
    };
  }

  /**
   * Create an HTTP Response object from this error.
   */
  toResponse(): Response {
    return new Response(JSON.stringify(this.toApiFormat()), {
      status: this.statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...(this.rateLimitReset ? { 'X-RateLimit-Reset': String(this.rateLimitReset) } : {}),
        'X-Error-Code': this.code,
      },
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a rate limit exceeded error.
 *
 * @param rateLimitReset - Unix timestamp when rate limit resets
 * @param isSecondary - Whether this is a secondary (abuse) rate limit
 * @returns GitHubApiError for rate limiting
 */
export function createRateLimitError(
  rateLimitReset?: number,
  isSecondary: boolean = false
): GitHubApiError {
  return new GitHubApiError({
    code: isSecondary ? GitHubErrorCode.GH_201 : GitHubErrorCode.GH_200,
    category: GitHubErrorCategory.RATE_LIMIT,
    severity: GitHubErrorSeverity.WARNING,
    message: isSecondary
      ? 'GitHub secondary rate limit exceeded (abuse detection)'
      : 'GitHub API rate limit exceeded',
    userMessage: 'GitHub API rate limit exceeded. Please wait a moment and try again.',
    statusCode: 429,
    rateLimitReset,
    isRetryable: true,
  });
}

/**
 * Creates an authentication error.
 *
 * @param message - Specific error message
 * @param requiresSSO - Whether SSO authorization is required
 * @returns GitHubApiError for authentication failures
 */
export function createAuthError(
  message: string = 'Invalid or expired GitHub token',
  requiresSSO: boolean = false
): GitHubApiError {
  return new GitHubApiError({
    code: requiresSSO ? GitHubErrorCode.GH_103 : GitHubErrorCode.GH_100,
    category: GitHubErrorCategory.AUTHENTICATION,
    severity: GitHubErrorSeverity.ERROR,
    message,
    userMessage: requiresSSO
      ? 'This resource requires SSO authorization. Please re-authenticate with GitHub.'
      : 'GitHub authentication failed. Please check your access token and try again.',
    statusCode: 401,
    isRetryable: false,
  });
}

/**
 * Creates a not found error.
 *
 * @param resourceType - Type of resource not found
 * @param resourceId - Identifier of the missing resource
 * @returns GitHubApiError for missing resources
 */
export function createNotFoundError(
  resourceType: 'repository' | 'pull_request' | 'user' | 'branch' = 'repository',
  resourceId?: string
): GitHubApiError {
  const codeMap: Record<string, GitHubErrorCode> = {
    repository: GitHubErrorCode.GH_300,
    pull_request: GitHubErrorCode.GH_301,
    user: GitHubErrorCode.GH_302,
    branch: GitHubErrorCode.GH_303,
  };

  const labelMap: Record<string, string> = {
    repository: 'Repository',
    pull_request: 'Pull request',
    user: 'User/Organization',
    branch: 'Branch',
  };

  const label = labelMap[resourceType] || 'Resource';
  const identifier = resourceId ? ` (${resourceId})` : '';

  return new GitHubApiError({
    code: codeMap[resourceType] || GitHubErrorCode.GH_300,
    category: GitHubErrorCategory.NOT_FOUND,
    severity: GitHubErrorSeverity.ERROR,
    message: `${label} not found${identifier}`,
    userMessage: `${label} not found. Please verify the ${resourceType.replace('_', ' ')} exists and you have access to it.`,
    statusCode: 404,
    isRetryable: false,
    context: { resourceType, resourceId },
  });
}

/**
 * Creates a validation error.
 *
 * @param message - Validation error message
 * @param field - Field that failed validation
 * @returns GitHubApiError for validation failures
 */
export function createValidationError(
  message: string,
  field?: string
): GitHubApiError {
  return new GitHubApiError({
    code: GitHubErrorCode.GH_400,
    category: GitHubErrorCategory.VALIDATION,
    severity: GitHubErrorSeverity.WARNING,
    message,
    userMessage: message,
    statusCode: 400,
    isRetryable: false,
    context: field ? { field } : undefined,
  });
}

/**
 * Creates a permission denied error.
 *
 * @param resourceType - Type of resource with denied access
 * @returns GitHubApiError for permission failures
 */
export function createPermissionError(
  resourceType: 'repository' | 'organization' = 'repository'
): GitHubApiError {
  return new GitHubApiError({
    code: resourceType === 'organization' ? GitHubErrorCode.GH_701 : GitHubErrorCode.GH_700,
    category: GitHubErrorCategory.PERMISSION,
    severity: GitHubErrorSeverity.ERROR,
    message: `Access denied to ${resourceType}`,
    userMessage: `You don't have permission to access this ${resourceType}. Please verify your access token has the required permissions.`,
    statusCode: 403,
    isRetryable: false,
    context: { resourceType },
  });
}

/**
 * Creates a server error.
 *
 * @param statusCode - HTTP status code (500, 502, 503)
 * @param message - Error message
 * @returns GitHubApiError for server failures
 */
export function createServerError(
  statusCode: number = 500,
  message: string = 'GitHub server error'
): GitHubApiError {
  const codeMap: Record<number, GitHubErrorCode> = {
    500: GitHubErrorCode.GH_500,
    502: GitHubErrorCode.GH_502,
    503: GitHubErrorCode.GH_501,
  };

  return new GitHubApiError({
    code: codeMap[statusCode] || GitHubErrorCode.GH_500,
    category: GitHubErrorCategory.SERVER,
    severity: GitHubErrorSeverity.ERROR,
    message,
    userMessage: 'GitHub is experiencing issues. Please try again in a few minutes.',
    statusCode,
    isRetryable: true,
  });
}

/**
 * Creates a network error.
 *
 * @param type - Type of network error
 * @param cause - Original error
 * @returns GitHubApiError for network failures
 */
export function createNetworkError(
  type: 'timeout' | 'connection' | 'dns' = 'connection',
  cause?: Error
): GitHubApiError {
  const codeMap: Record<string, GitHubErrorCode> = {
    timeout: GitHubErrorCode.GH_600,
    connection: GitHubErrorCode.GH_601,
    dns: GitHubErrorCode.GH_602,
  };

  const messageMap: Record<string, string> = {
    timeout: 'Connection to GitHub timed out',
    connection: 'Failed to connect to GitHub',
    dns: 'Failed to resolve GitHub DNS',
  };

  return new GitHubApiError({
    code: codeMap[type],
    category: GitHubErrorCategory.NETWORK,
    severity: GitHubErrorSeverity.ERROR,
    message: messageMap[type],
    userMessage: 'Unable to connect to GitHub. Please check your network connection and try again.',
    statusCode: 0,
    isRetryable: true,
    cause,
  });
}

// ============================================================================
// Response Classification
// ============================================================================

/**
 * Classifies a fetch Response into an appropriate GitHubApiError.
 *
 * Analyzes the response status code and headers to create a properly
 * categorized error with retry information.
 *
 * @param response - The fetch Response object
 * @param context - Additional context for the error
 * @returns GitHubApiError classified from the response
 *
 * @example
 * ```typescript
 * const response = await fetch('https://api.github.com/repos/owner/repo');
 * if (!response.ok) {
 *   throw classifyError(response, { operation: 'fetchRepository' });
 * }
 * ```
 */
export async function classifyError(
  response: Response,
  context?: Record<string, unknown>
): Promise<GitHubApiError> {
  const status = response.status;
  const rateLimitReset = response.headers.get('X-RateLimit-Reset');
  const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
  const retryAfter = response.headers.get('Retry-After');

  // Try to parse response body for additional error info
  let body: Record<string, unknown> | null = null;
  try {
    body = await response.json();
  } catch {
    // Body might not be JSON
  }

  const bodyMessage = (body?.message as string) || '';

  // Rate limiting (429 or 403 with rate limit headers)
  if (status === 429 || (status === 403 && rateLimitRemaining === '0')) {
    const resetTime = rateLimitReset ? parseInt(rateLimitReset, 10) : undefined;
    const isSecondary = bodyMessage.toLowerCase().includes('abuse') ||
                        bodyMessage.toLowerCase().includes('secondary');
    return createRateLimitError(resetTime, isSecondary);
  }

  // Authentication errors
  if (status === 401) {
    const requiresSSO = bodyMessage.toLowerCase().includes('sso');
    return createAuthError(bodyMessage || 'Invalid or expired token', requiresSSO);
  }

  // Permission errors
  if (status === 403) {
    if (bodyMessage.toLowerCase().includes('organization')) {
      return createPermissionError('organization');
    }
    return createPermissionError('repository');
  }

  // Not found errors (Issue 5: categorize by resource type from URL)
  if (status === 404) {
    const url = context?.url as string | undefined;
    if (url) {
      if (url.includes('/pulls/') || url.includes('/pull/')) {
        return createNotFoundError('pull_request');
      } else if (url.includes('/reviews')) {
        return createNotFoundError('review');
      } else if (url.includes('/comments')) {
        return createNotFoundError('comment');
      } else if (url.includes('/commits')) {
        return createNotFoundError('commit');
      } else if (url.includes('/issues/')) {
        return createNotFoundError('issue');
      } else if (url.includes('/repos/')) {
        return createNotFoundError('repository');
      }
    }
    return createNotFoundError('repository');
  }

  // Validation errors
  if (status === 400 || status === 422) {
    return createValidationError(bodyMessage || 'Invalid request');
  }

  // Server errors
  if (status >= 500) {
    return createServerError(status, bodyMessage || `GitHub server error (${status})`);
  }

  // Unknown error
  return new GitHubApiError({
    code: GitHubErrorCode.GH_500,
    category: GitHubErrorCategory.UNKNOWN,
    severity: GitHubErrorSeverity.ERROR,
    message: bodyMessage || `Unknown GitHub API error (${status})`,
    userMessage: 'An unexpected error occurred. Please try again.',
    statusCode: status,
    isRetryable: status >= 500,
    context,
  });
}

/**
 * Checks if an error is a GitHubApiError.
 *
 * @param error - The error to check
 * @returns true if error is a GitHubApiError
 */
export function isGitHubApiError(error: unknown): error is GitHubApiError {
  return error instanceof GitHubApiError;
}

/**
 * Wraps an unknown error as a GitHubApiError.
 *
 * Useful for handling errors from external sources while maintaining
 * consistent error types.
 *
 * @param error - The error to wrap
 * @param context - Additional context
 * @returns GitHubApiError wrapping the original error
 */
export function wrapError(error: unknown, context?: Record<string, unknown>): GitHubApiError {
  if (isGitHubApiError(error)) {
    return error;
  }

  // Handle network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createNetworkError('connection', error);
  }

  // Handle timeout errors
  if (error instanceof Error && error.name === 'AbortError') {
    return createNetworkError('timeout', error);
  }

  // Generic error wrapping
  const message = error instanceof Error ? error.message : String(error);
  return new GitHubApiError({
    code: GitHubErrorCode.GH_500,
    category: GitHubErrorCategory.UNKNOWN,
    severity: GitHubErrorSeverity.ERROR,
    message,
    userMessage: 'An unexpected error occurred. Please try again.',
    statusCode: 500,
    isRetryable: false,
    cause: error instanceof Error ? error : undefined,
    context,
  });
}
