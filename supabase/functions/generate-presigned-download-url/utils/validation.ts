import { RequestValidation, DOWNLOAD_CONFIG } from "../types.ts";

/**
 * Validate S3 key format and structure
 * @param key S3 object key
 * @returns Validation result
 */
export function validateS3Key(key: string): { valid: boolean; error?: string } {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: "S3 key is required and must be a string" };
  }

  // Trim the key
  const trimmedKey = key.trim();

  if (trimmedKey.length === 0) {
    return { valid: false, error: "S3 key cannot be empty" };
  }

  // Expected format: drai_files/{project}/{filename}
  if (!trimmedKey.startsWith('drai_files/')) {
    return {
      valid: false,
      error: "S3 key must start with 'drai_files/' prefix"
    };
  }

  // Check for invalid characters
  if (/[<>:"|?*]/.test(trimmedKey)) {
    return {
      valid: false,
      error: "S3 key contains invalid characters"
    };
  }

  // Check for path traversal attempts
  if (trimmedKey.includes('../') || trimmedKey.includes('..\\')) {
    return {
      valid: false,
      error: "S3 key contains path traversal characters"
    };
  }

  return { valid: true };
}

/**
 * Validate and normalize expiration time in seconds
 * @param expirationSeconds Requested expiration time
 * @returns Validated expiration time within allowed bounds
 */
export function validateExpiration(expirationSeconds?: number): number {
  // Use default if not provided or invalid
  if (!expirationSeconds || typeof expirationSeconds !== 'number' || expirationSeconds <= 0) {
    return DOWNLOAD_CONFIG.DEFAULT_EXPIRATION;
  }

  // Ensure within bounds
  if (expirationSeconds < DOWNLOAD_CONFIG.MIN_EXPIRATION) {
    return DOWNLOAD_CONFIG.MIN_EXPIRATION;
  }

  if (expirationSeconds > DOWNLOAD_CONFIG.MAX_EXPIRATION) {
    return DOWNLOAD_CONFIG.MAX_EXPIRATION;
  }

  return Math.floor(expirationSeconds);
}

/**
 * Validate presigned download request
 * @param body Request body
 * @returns Validation result
 */
export function validateRequest(body: unknown): RequestValidation {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      errors: ['Request body is required and must be an object']
    };
  }

  const request = body as Record<string, unknown>;

  // Validate key
  if (!request.key) {
    errors.push('Missing required field: key');
  } else if (typeof request.key !== 'string') {
    errors.push('Field "key" must be a string');
  } else {
    const keyValidation = validateS3Key(request.key);
    if (!keyValidation.valid) {
      errors.push(`Invalid key: ${keyValidation.error}`);
    }
  }

  // Validate optional expirationSeconds
  if (request.expirationSeconds !== undefined && request.expirationSeconds !== null) {
    if (typeof request.expirationSeconds !== 'number') {
      errors.push('Field "expirationSeconds" must be a number');
    } else if (request.expirationSeconds <= 0) {
      errors.push('Field "expirationSeconds" must be positive');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
