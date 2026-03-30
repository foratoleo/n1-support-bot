/**
 * Storage Provider abstraction types and interfaces.
 * Defines the unified contract for S3 and GCS providers.
 */

// ─────────────────────────────────────────────
// Provider identification
// ─────────────────────────────────────────────

export type StorageProviderName = 's3' | 'gcs';

// ─────────────────────────────────────────────
// Upload (direct / server-side)
// ─────────────────────────────────────────────

export interface UploadParams {
  /** File object to upload */
  file: File;
  /** Object key (path) inside the bucket */
  key: string;
  /** MIME content type */
  contentType: string;
  /** Target bucket name */
  bucket: string;
}

export interface UploadResult {
  /** Sanitized filename used for the object */
  filename: string;
  /** Public or canonical URL of the uploaded object */
  location: string;
  /** Object key (path) inside the bucket */
  key: string;
  /** ETag returned by the storage provider (may be undefined for GCS streaming) */
  etag?: string;
}

// ─────────────────────────────────────────────
// Presigned upload (client-side upload)
// ─────────────────────────────────────────────

export interface PresignedUploadParams {
  /** Object key (path) inside the bucket */
  key: string;
  /** MIME content type of the file to be uploaded */
  contentType: string;
  /** File size in bytes (used for S3 conditions) */
  fileSize: number;
  /** Target bucket name */
  bucket: string;
  /** URL expiration time in seconds */
  expiresIn: number;
}

/** HTTP method the client must use when uploading to the presigned URL */
export type PresignedUploadMethod = 'POST' | 'PUT';

export interface PresignedUploadResult {
  /** Presigned URL the client should upload to */
  url: string;
  /**
   * Form fields that must be included in the multipart/form-data POST.
   * Empty object for GCS (which uses a plain PUT instead).
   */
  fields: Record<string, string>;
  /** Object key (path) inside the bucket */
  key: string;
  /**
   * HTTP method the client must use.
   * - 'POST' for S3 (multipart/form-data)
   * - 'PUT' for GCS (binary body)
   */
  method: PresignedUploadMethod;
  /** ISO-8601 timestamp when the URL expires */
  expiresAt: string;
}

// ─────────────────────────────────────────────
// Presigned download
// ─────────────────────────────────────────────

export interface PresignedDownloadParams {
  /** Object key (path) inside the bucket */
  key: string;
  /** Source bucket name */
  bucket: string;
  /** URL expiration time in seconds */
  expiresIn: number;
}

export interface PresignedDownloadResult {
  /** Presigned URL the client can use to download the file */
  downloadUrl: string;
  /** ISO-8601 timestamp when the URL expires */
  expiresAt: string;
  /** Object key (path) inside the bucket */
  key: string;
}

// ─────────────────────────────────────────────
// Configuration validation
// ─────────────────────────────────────────────

export interface StorageConfigValidationResult {
  /** Whether all required environment variables are present */
  valid: boolean;
  /** Names of missing environment variables (empty when valid) */
  missingVars: string[];
  /** Human-readable error description (present when not valid) */
  error?: string;
}

// ─────────────────────────────────────────────
// Provider interface (contract)
// ─────────────────────────────────────────────

export interface StorageProvider {
  /**
   * Upload a file directly from the Edge Function to the storage bucket.
   * Used by the `upload-to-s3` Edge Function.
   */
  upload(params: UploadParams): Promise<UploadResult>;

  /**
   * Generate a presigned URL so the browser can upload directly to storage.
   * Used by the `upload-to-presigned-s3` Edge Function.
   */
  generatePresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;

  /**
   * Generate a presigned URL so the browser can download a file from storage.
   * Used by the `generate-presigned-download-url` Edge Function.
   */
  generatePresignedDownloadUrl(params: PresignedDownloadParams): Promise<PresignedDownloadResult>;

  /**
   * Delete an object from the storage bucket.
   * @param key - Object key (path) to delete
   */
  deleteObject(key: string): Promise<void>;
}

// ─────────────────────────────────────────────
// Provider-specific configuration types
// ─────────────────────────────────────────────

/** Configuration for the AWS S3 provider */
export interface S3Config {
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  /** AWS region (defaults to 'us-east-1' when not set) */
  AWS_REGION: string;
  /** Default bucket name */
  bucket: string;
  /** S3 Access Point alias (optional) */
  AWS_S3_ACCESS_POINT?: string;
  /** S3 Access Point ARN (optional) */
  AWS_S3_ACCESS_POINT_ARN?: string;
}

/** Configuration for the Google Cloud Storage provider */
export interface GCSConfig {
  /** GCP project ID */
  GCS_PROJECT_ID: string;
  /** Default GCS bucket name */
  bucket: string;
  /** Service account client email (used for OAuth2 JWT and Signed URLs) */
  GCS_CLIENT_EMAIL: string;
  /** RSA private key in PEM format (newlines already processed) */
  GCS_PRIVATE_KEY: string;
}
