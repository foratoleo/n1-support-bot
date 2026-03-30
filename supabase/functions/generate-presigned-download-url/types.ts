// TypeScript interfaces for the generate-presigned-download-url Edge Function

/**
 * Request to generate a presigned download URL
 */
export interface PresignedDownloadRequest {
  /**
   * S3 object key (file path) for the file to download
   * Example: "drai_files/project-name/document_1234567890.pdf"
   */
  key: string;

  /**
   * Optional expiration time in seconds
   * Default: 3600 (1 hour)
   * Maximum: 604800 (7 days per AWS limits)
   */
  expirationSeconds?: number;
}

/**
 * Response with presigned download URL
 */
export interface PresignedDownloadResponse {
  /**
   * Whether the operation was successful
   */
  success: boolean;

  /**
   * Presigned download URL (only present if success=true)
   */
  downloadUrl?: string;

  /**
   * ISO timestamp when the URL expires
   */
  expiresAt?: string;

  /**
   * S3 object key that was requested
   */
  key?: string;

  /**
   * Status message
   */
  message: string;

  /**
   * Error details (only present if success=false)
   */
  error?: string;
}

/**
 * Environment configuration for AWS credentials
 * Reuses the same interface from upload-to-presigned-s3
 */
export interface EnvironmentConfig {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  AWS_S3_BUCKET: string;
  AWS_S3_ACCESS_POINT?: string;
  AWS_S3_ACCESS_POINT_ARN?: string;
}

/**
 * Request validation result
 */
export interface RequestValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Constants for presigned download URL configuration
 */
export const DOWNLOAD_CONFIG = {
  /**
   * Default expiration time: 1 hour
   */
  DEFAULT_EXPIRATION: 3600,

  /**
   * Maximum expiration time: 7 days (AWS S3 limit)
   */
  MAX_EXPIRATION: 604800,

  /**
   * Minimum expiration time: 1 minute
   */
  MIN_EXPIRATION: 60,
} as const;
