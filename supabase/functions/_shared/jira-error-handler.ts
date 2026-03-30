/**
 * JIRA Error Handler for Supabase Edge Functions
 *
 * Comprehensive error handling system with categorization, severity levels,
 * context capture, and formatting for different consumers.
 *
 * @module jira-error-handler
 */

// Error severity levels
export enum ErrorSeverity {
  CRITICAL = 'critical', // System failure, immediate attention required
  ERROR = 'error',       // Operation failure, needs resolution
  WARNING = 'warning',   // Degraded performance or partial failure
  INFO = 'info'         // Informational, no action required
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'NETWORK',         // Network-related errors (timeout, connection)
  AUTHENTICATION = 'AUTH',     // Authentication and authorization errors
  RATE_LIMIT = 'RATE_LIMIT',  // Rate limiting errors
  VALIDATION = 'VALIDATION',   // Client-side validation errors
  SERVER = 'SERVER',          // Server errors (5xx)
  DATABASE = 'DATABASE',      // Database operation errors
  BUSINESS_LOGIC = 'BUSINESS', // Business rule violations
  CONFIGURATION = 'CONFIG',    // Configuration errors
  UNKNOWN = 'UNKNOWN'         // Unknown or unclassified errors
}

// Error codes with structured naming (JIRA_XXX)
export enum ErrorCode {
  // Network errors (001-099)
  JIRA_001 = 'JIRA_001', // Connection timeout
  JIRA_002 = 'JIRA_002', // Connection refused
  JIRA_003 = 'JIRA_003', // DNS resolution failed
  JIRA_004 = 'JIRA_004', // Network unreachable

  // Authentication errors (100-199)
  JIRA_100 = 'JIRA_100', // Invalid credentials
  JIRA_101 = 'JIRA_101', // Token expired
  JIRA_102 = 'JIRA_102', // Insufficient permissions
  JIRA_103 = 'JIRA_103', // Account suspended

  // Rate limiting errors (200-299)
  JIRA_200 = 'JIRA_200', // Rate limit exceeded
  JIRA_201 = 'JIRA_201', // Quota exceeded
  JIRA_202 = 'JIRA_202', // Too many requests

  // Validation errors (300-399)
  JIRA_300 = 'JIRA_300', // Invalid input format
  JIRA_301 = 'JIRA_301', // Required field missing
  JIRA_302 = 'JIRA_302', // Invalid field value
  JIRA_303 = 'JIRA_303', // Entity not found

  // Server errors (400-499)
  JIRA_400 = 'JIRA_400', // Internal server error
  JIRA_401 = 'JIRA_401', // Service unavailable
  JIRA_402 = 'JIRA_402', // Gateway timeout

  // Database errors (500-599)
  JIRA_500 = 'JIRA_500', // Database connection failed
  JIRA_501 = 'JIRA_501', // Query execution failed
  JIRA_502 = 'JIRA_502', // Transaction failed
  JIRA_503 = 'JIRA_503', // Constraint violation

  // Business logic errors (600-699)
  JIRA_600 = 'JIRA_600', // Invalid state transition
  JIRA_601 = 'JIRA_601', // Duplicate operation
  JIRA_602 = 'JIRA_602', // Conflict detected
  JIRA_603 = 'JIRA_603', // Operation not allowed

  // Configuration errors (700-799)
  JIRA_700 = 'JIRA_700', // Missing configuration
  JIRA_701 = 'JIRA_701', // Invalid configuration
  JIRA_702 = 'JIRA_702', // Environment variable not set
}

// Retry hint for error recovery
export enum RetryHint {
  RETRYABLE = 'RETRYABLE',                       // Can be retried immediately
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF',    // Retry with exponential backoff
  RETRY_AFTER_DELAY = 'RETRY_AFTER_DELAY',      // Retry after specific delay
  NON_RETRYABLE = 'NON_RETRYABLE',              // Should not be retried
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION'     // Requires manual intervention
}

// Error context interface
export interface ErrorContext {
  requestId?: string;
  timestamp: string;
  userId?: string;
  projectId?: string;
  taskId?: string;
  jiraIssueKey?: string;
  operation?: string;
  endpoint?: string;
  httpMethod?: string;
  httpStatus?: number;
  retryCount?: number;
  maxRetries?: number;
  additionalData?: Record<string, any>;
}

// Enhanced error class with full categorization
export class JiraError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly retryHint: RetryHint;
  public readonly context: ErrorContext;
  public readonly userMessage: string;
  public readonly developerMessage: string;
  public readonly originalError?: Error;
  public readonly httpStatus?: number;

  constructor(params: {
    code: ErrorCode;
    category: ErrorCategory;
    severity: ErrorSeverity;
    retryHint: RetryHint;
    userMessage: string;
    developerMessage: string;
    context: ErrorContext;
    originalError?: Error;
    httpStatus?: number;
  }) {
    super(params.developerMessage);
    this.name = 'JiraError';
    this.code = params.code;
    this.category = params.category;
    this.severity = params.severity;
    this.retryHint = params.retryHint;
    this.userMessage = params.userMessage;
    this.developerMessage = params.developerMessage;
    this.context = params.context;
    this.originalError = params.originalError;
    this.httpStatus = params.httpStatus;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, JiraError);
    }
  }

  // Check if error is retryable
  isRetryable(): boolean {
    return this.retryHint !== RetryHint.NON_RETRYABLE &&
           this.retryHint !== RetryHint.MANUAL_INTERVENTION;
  }

  // Get retry delay in milliseconds
  getRetryDelay(attemptNumber: number = 0): number {
    switch (this.retryHint) {
      case RetryHint.RETRYABLE:
        return 0; // Immediate retry
      case RetryHint.RETRY_WITH_BACKOFF:
        return Math.min(1000 * Math.pow(2, attemptNumber), 30000); // Max 30 seconds
      case RetryHint.RETRY_AFTER_DELAY:
        return 5000; // Fixed 5 second delay
      default:
        return 0;
    }
  }

  // Format for logging
  toLogFormat(): Record<string, any> {
    return {
      error_code: this.code,
      category: this.category,
      severity: this.severity,
      retry_hint: this.retryHint,
      message: this.developerMessage,
      context: this.context,
      stack: this.stack,
      original_error: this.originalError?.message,
    };
  }

  // Format for API response
  toApiFormat(): Record<string, any> {
    return {
      error: {
        code: this.code,
        message: this.userMessage,
        category: this.category,
        severity: this.severity,
        retryable: this.isRetryable(),
        request_id: this.context.requestId,
        timestamp: this.context.timestamp,
      }
    };
  }

  // Format for UI display
  toUiFormat(): Record<string, any> {
    return {
      title: this.getUiTitle(),
      message: this.userMessage,
      type: this.getUiType(),
      code: this.code,
      retryable: this.isRetryable(),
    };
  }

  private getUiTitle(): string {
    switch (this.category) {
      case ErrorCategory.NETWORK:
        return 'Connection Error';
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication Failed';
      case ErrorCategory.RATE_LIMIT:
        return 'Rate Limit Exceeded';
      case ErrorCategory.VALIDATION:
        return 'Validation Error';
      case ErrorCategory.SERVER:
        return 'Server Error';
      case ErrorCategory.DATABASE:
        return 'Database Error';
      case ErrorCategory.BUSINESS_LOGIC:
        return 'Operation Failed';
      case ErrorCategory.CONFIGURATION:
        return 'Configuration Error';
      default:
        return 'Error';
    }
  }

  private getUiType(): 'error' | 'warning' | 'info' {
    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        return 'error';
      case ErrorSeverity.WARNING:
        return 'warning';
      case ErrorSeverity.INFO:
        return 'info';
      default:
        return 'error';
    }
  }
}

/**
 * JIRA Error Handler - Main error handling class
 */
export class JiraErrorHandler {
  private static instance: JiraErrorHandler;
  private errorMappings: Map<string, ErrorCode>;

  private constructor() {
    this.initializeErrorMappings();
  }

  static getInstance(): JiraErrorHandler {
    if (!JiraErrorHandler.instance) {
      JiraErrorHandler.instance = new JiraErrorHandler();
    }
    return JiraErrorHandler.instance;
  }

  private initializeErrorMappings(): void {
    this.errorMappings = new Map([
      // Network error mappings
      ['ETIMEDOUT', ErrorCode.JIRA_001],
      ['ECONNREFUSED', ErrorCode.JIRA_002],
      ['ENOTFOUND', ErrorCode.JIRA_003],
      ['ENETUNREACH', ErrorCode.JIRA_004],

      // HTTP status mappings
      ['401', ErrorCode.JIRA_100],
      ['403', ErrorCode.JIRA_102],
      ['429', ErrorCode.JIRA_200],
      ['400', ErrorCode.JIRA_300],
      ['404', ErrorCode.JIRA_303],
      ['500', ErrorCode.JIRA_400],
      ['503', ErrorCode.JIRA_401],
      ['504', ErrorCode.JIRA_402],
    ]);
  }

  /**
   * Handle and categorize an error
   */
  handleError(
    error: any,
    context: Partial<ErrorContext> = {},
    operation: string = 'Unknown Operation'
  ): JiraError {
    // Add timestamp to context
    const fullContext: ErrorContext = {
      ...context,
      timestamp: new Date().toISOString(),
      operation,
    };

    // Handle existing JiraError
    if (error instanceof JiraError) {
      return error;
    }

    // Handle network errors
    if (this.isNetworkError(error)) {
      return this.createNetworkError(error, fullContext);
    }

    // Handle HTTP errors
    if (this.isHttpError(error)) {
      return this.createHttpError(error, fullContext);
    }

    // Handle database errors
    if (this.isDatabaseError(error)) {
      return this.createDatabaseError(error, fullContext);
    }

    // Handle validation errors
    if (this.isValidationError(error)) {
      return this.createValidationError(error, fullContext);
    }

    // Default unknown error
    return this.createUnknownError(error, fullContext);
  }

  private isNetworkError(error: any): boolean {
    const networkErrorCodes = ['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'];
    return networkErrorCodes.includes(error.code) ||
           error.message?.toLowerCase().includes('network') ||
           error.message?.toLowerCase().includes('timeout');
  }

  private isHttpError(error: any): boolean {
    return error.statusCode !== undefined ||
           error.status !== undefined ||
           error.response?.status !== undefined;
  }

  private isDatabaseError(error: any): boolean {
    const dbErrorCodes = ['23503', '23505', '42501', 'PGRST'];
    return dbErrorCodes.some(code => error.code?.startsWith(code)) ||
           error.message?.toLowerCase().includes('database') ||
           error.message?.toLowerCase().includes('constraint');
  }

  private isValidationError(error: any): boolean {
    return error.code === 'VALIDATION_ERROR' ||
           error.message?.toLowerCase().includes('validation') ||
           error.message?.toLowerCase().includes('invalid') ||
           error.message?.toLowerCase().includes('required');
  }

  private createNetworkError(error: any, context: ErrorContext): JiraError {
    const code = this.errorMappings.get(error.code) || ErrorCode.JIRA_001;

    return new JiraError({
      code,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      retryHint: RetryHint.RETRY_WITH_BACKOFF,
      userMessage: 'Unable to connect to JIRA. Please check your network connection and try again.',
      developerMessage: `Network error: ${error.message}`,
      context,
      originalError: error,
    });
  }

  private createHttpError(error: any, context: ErrorContext): JiraError {
    const status = error.statusCode || error.status || error.response?.status;
    const code = this.errorMappings.get(status?.toString()) || ErrorCode.JIRA_400;

    let category = ErrorCategory.SERVER;
    let severity = ErrorSeverity.ERROR;
    let retryHint = RetryHint.NON_RETRYABLE;
    let userMessage = 'An error occurred while communicating with JIRA.';

    // Categorize based on status code
    if (status === 401 || status === 403) {
      category = ErrorCategory.AUTHENTICATION;
      userMessage = 'Authentication failed. Please check your JIRA credentials.';
    } else if (status === 429) {
      category = ErrorCategory.RATE_LIMIT;
      severity = ErrorSeverity.WARNING;
      retryHint = RetryHint.RETRY_AFTER_DELAY;
      userMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (status >= 400 && status < 500) {
      category = ErrorCategory.VALIDATION;
      userMessage = 'Invalid request. Please check your input and try again.';
    } else if (status >= 500) {
      category = ErrorCategory.SERVER;
      severity = ErrorSeverity.CRITICAL;
      retryHint = RetryHint.RETRY_WITH_BACKOFF;
      userMessage = 'JIRA server error. Please try again later.';
    }

    return new JiraError({
      code,
      category,
      severity,
      retryHint,
      userMessage,
      developerMessage: `HTTP ${status}: ${error.message}`,
      context: { ...context, httpStatus: status },
      originalError: error,
      httpStatus: status,
    });
  }

  private createDatabaseError(error: any, context: ErrorContext): JiraError {
    let code = ErrorCode.JIRA_501;
    let userMessage = 'Database operation failed. Please try again.';
    let retryHint = RetryHint.RETRY_WITH_BACKOFF;

    if (error.code === '23503') {
      code = ErrorCode.JIRA_503;
      userMessage = 'Related data constraint violation.';
      retryHint = RetryHint.NON_RETRYABLE;
    } else if (error.code === '23505') {
      code = ErrorCode.JIRA_601;
      userMessage = 'Duplicate entry detected.';
      retryHint = RetryHint.NON_RETRYABLE;
    }

    return new JiraError({
      code,
      category: ErrorCategory.DATABASE,
      severity: ErrorSeverity.ERROR,
      retryHint,
      userMessage,
      developerMessage: `Database error: ${error.message}`,
      context,
      originalError: error,
    });
  }

  private createValidationError(error: any, context: ErrorContext): JiraError {
    return new JiraError({
      code: ErrorCode.JIRA_300,
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.WARNING,
      retryHint: RetryHint.NON_RETRYABLE,
      userMessage: error.userMessage || 'Validation failed. Please check your input.',
      developerMessage: `Validation error: ${error.message}`,
      context,
      originalError: error,
    });
  }

  private createUnknownError(error: any, context: ErrorContext): JiraError {
    return new JiraError({
      code: ErrorCode.JIRA_400,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.ERROR,
      retryHint: RetryHint.RETRY_WITH_BACKOFF,
      userMessage: 'An unexpected error occurred. Please try again.',
      developerMessage: `Unknown error: ${error.message || error}`,
      context,
      originalError: error,
    });
  }

  /**
   * Map JIRA API errors to application errors
   */
  mapJiraApiError(jiraError: any, context: ErrorContext): JiraError {
    // Handle JIRA-specific error format
    const errorMessages = jiraError.errorMessages || [];
    const errors = jiraError.errors || {};

    let userMessage = 'JIRA API error occurred.';
    let developerMessage = 'JIRA API error: ';

    if (errorMessages.length > 0) {
      userMessage = errorMessages[0];
      developerMessage += errorMessages.join(', ');
    } else if (Object.keys(errors).length > 0) {
      const firstError = Object.entries(errors)[0];
      userMessage = `${firstError[0]}: ${firstError[1]}`;
      developerMessage += JSON.stringify(errors);
    }

    return new JiraError({
      code: ErrorCode.JIRA_400,
      category: ErrorCategory.SERVER,
      severity: ErrorSeverity.ERROR,
      retryHint: RetryHint.NON_RETRYABLE,
      userMessage,
      developerMessage,
      context,
      originalError: jiraError,
    });
  }

  /**
   * Log error with appropriate severity
   */
  logError(error: JiraError): void {
    const logData = error.toLogFormat();

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error('[CRITICAL]', logData);
        // In production, send to monitoring service
        this.sendToMonitoring(error);
        break;
      case ErrorSeverity.ERROR:
        console.error('[ERROR]', logData);
        break;
      case ErrorSeverity.WARNING:
        console.warn('[WARNING]', logData);
        break;
      case ErrorSeverity.INFO:
        console.info('[INFO]', logData);
        break;
    }
  }

  /**
   * Send critical errors to monitoring service
   */
  private sendToMonitoring(error: JiraError): void {
    // Implementation would send to actual monitoring service
    // For now, just log that we would send it
    console.log('[MONITORING] Would send critical error to monitoring:', error.code);
  }

  /**
   * Create error response for edge function
   */
  createErrorResponse(error: JiraError): Response {
    this.logError(error);

    return new Response(
      JSON.stringify(error.toApiFormat()),
      {
        status: error.httpStatus || 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Error-Code': error.code,
          'X-Request-Id': error.context.requestId || '',
        },
      }
    );
  }
}

// Export singleton instance
export const errorHandler = JiraErrorHandler.getInstance();