import { AccessibilityTestRequest, Strategy } from '../types.ts';
import { ALLOWED_STRATEGIES, DEFAULT_LOCALE, DEFAULT_TIMEOUT, MAX_TIMEOUT, MIN_TIMEOUT } from '../config.ts';
import { isValidUrl } from './url-validator.ts';

/**
 * Custom error classes for different error scenarios
 */

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isRetryable: boolean,
    public apiResponse?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public constraint?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Validates UUID format
 */
function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates locale format (e.g., en-US, pt-BR)
 */
function isValidLocale(locale: string): boolean {
  const localeRegex = /^[a-z]{2}-[A-Z]{2}$/;
  return localeRegex.test(locale);
}

/**
 * Validates the accessibility test request body
 * Throws ValidationError if validation fails
 */
export function validateTestRequest(body: unknown): asserts body is AccessibilityTestRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object', 'body');
  }

  const request = body as Record<string, unknown>;

  // Validate projectId (required, must be UUID)
  if (!request.projectId || typeof request.projectId !== 'string') {
    throw new ValidationError('projectId is required and must be a string', 'projectId');
  }
  if (!request.projectId.trim()) {
    throw new ValidationError('projectId cannot be empty', 'projectId');
  }
  if (!isValidUUID(request.projectId)) {
    throw new ValidationError('projectId must be a valid UUID', 'projectId');
  }

  // Validate targetUrl (required, must be valid HTTP/HTTPS URL)
  if (!request.targetUrl || typeof request.targetUrl !== 'string') {
    throw new ValidationError('targetUrl is required and must be a string', 'targetUrl');
  }
  if (!request.targetUrl.trim()) {
    throw new ValidationError('targetUrl cannot be empty', 'targetUrl');
  }
  if (!isValidUrl(request.targetUrl)) {
    throw new ValidationError(
      'targetUrl must be a valid HTTP or HTTPS URL (localhost and private IPs are not allowed)',
      'targetUrl'
    );
  }

  // Validate strategy (required, must be valid strategy)
  if (!request.strategy || typeof request.strategy !== 'string') {
    throw new ValidationError('strategy is required and must be a string', 'strategy');
  }
  if (!ALLOWED_STRATEGIES.includes(request.strategy as Strategy)) {
    throw new ValidationError(
      `strategy must be one of: ${ALLOWED_STRATEGIES.join(', ')}`,
      'strategy'
    );
  }

  // Validate locale (optional, must match locale format)
  if (request.locale !== undefined) {
    if (typeof request.locale !== 'string') {
      throw new ValidationError('locale must be a string', 'locale');
    }
    if (!isValidLocale(request.locale)) {
      throw new ValidationError(
        'locale must be in format "xx-XX" (e.g., "en-US", "pt-BR")',
        'locale'
      );
    }
  } else {
    // Set default if not provided
    (request as AccessibilityTestRequest).locale = DEFAULT_LOCALE;
  }

  // Validate timeout (optional, must be between MIN and MAX)
  if (request.timeout !== undefined) {
    if (typeof request.timeout !== 'number') {
      throw new ValidationError('timeout must be a number', 'timeout');
    }
    if (!Number.isInteger(request.timeout)) {
      throw new ValidationError('timeout must be an integer', 'timeout');
    }
    if (request.timeout < MIN_TIMEOUT || request.timeout > MAX_TIMEOUT) {
      throw new ValidationError(
        `timeout must be between ${MIN_TIMEOUT} and ${MAX_TIMEOUT} milliseconds`,
        'timeout'
      );
    }
  } else {
    // Set default if not provided
    (request as AccessibilityTestRequest).timeout = DEFAULT_TIMEOUT;
  }
}
