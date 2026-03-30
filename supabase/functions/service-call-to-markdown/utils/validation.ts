import { ServiceCallToMarkdownRequest } from '../types.ts';

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

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public operation: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class UnsupportedServiceError extends Error {
  constructor(
    message: string,
    public serviceName: string,
    public serviceCategory: string
  ) {
    super(message);
    this.name = 'UnsupportedServiceError';
  }
}

/**
 * Validates UUID format
 */
export function isValidUUID(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates the service call to markdown request
 * Throws ValidationError if validation fails
 */
export function validateRequest(body: unknown): asserts body is ServiceCallToMarkdownRequest {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be an object', 'body');
  }

  const request = body as Record<string, unknown>;

  // Validate id (required, must be UUID)
  if (!request.id || typeof request.id !== 'string') {
    throw new ValidationError('id is required and must be a string', 'id');
  }
  if (!request.id.trim()) {
    throw new ValidationError('id cannot be empty', 'id');
  }
  if (!isValidUUID(request.id)) {
    throw new ValidationError('id must be a valid UUID', 'id');
  }

  // Validate serviceName (optional, must be string if provided)
  if (request.serviceName !== undefined && request.serviceName !== null) {
    if (typeof request.serviceName !== 'string') {
      throw new ValidationError('serviceName must be a string', 'serviceName');
    }
    if (!request.serviceName.trim()) {
      throw new ValidationError('serviceName cannot be empty', 'serviceName');
    }
  }

  // Validate serviceCategory (optional, must be string if provided)
  if (request.serviceCategory !== undefined && request.serviceCategory !== null) {
    if (typeof request.serviceCategory !== 'string') {
      throw new ValidationError('serviceCategory must be a string', 'serviceCategory');
    }
    if (!request.serviceCategory.trim()) {
      throw new ValidationError('serviceCategory cannot be empty', 'serviceCategory');
    }
  }
}
