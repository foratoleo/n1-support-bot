/**
 * PDF Extraction Types Module
 *
 * TypeScript interfaces and types for PDF text extraction functionality.
 *
 * @module pdf-extraction/types
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Maximum allowed file size for PDF processing (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// =============================================================================
// CORS Configuration
// =============================================================================

/**
 * Standard CORS headers for PDF extraction endpoints
 */
export const PDF_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
} as const;

// =============================================================================
// Extraction Result Types
// =============================================================================

/**
 * Result of PDF text extraction operation
 */
export interface PDFExtractionResult {
  /** Extracted text content from all pages */
  text: string;
  /** Total number of pages in the PDF */
  pageCount: number;
}

/**
 * Metadata about the extracted PDF
 */
export interface PDFMetadata {
  /** Number of pages in the PDF */
  pageCount: number;
  /** File size in bytes */
  fileSize: number;
  /** Original file name */
  fileName: string;
  /** ISO timestamp of extraction */
  extractedAt: string;
  /** Duration of extraction in milliseconds */
  durationMs: number;
}

/**
 * Successful response from PDF extraction
 */
export interface PDFExtractionSuccessResponse {
  success: true;
  /** Cleaned and processed text content */
  text: string;
  /** Metadata about the extraction */
  metadata: PDFMetadata;
}

/**
 * Error response from PDF extraction
 */
export interface PDFExtractionErrorResponse {
  error: {
    /** Error code for programmatic handling */
    code: PDFExtractionErrorCode;
    /** Human-readable error message */
    message: string;
  };
}

/**
 * Union type for all PDF extraction responses
 */
export type PDFExtractionResponse = PDFExtractionSuccessResponse | PDFExtractionErrorResponse;

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for PDF extraction failures (Server-Side).
 *
 * These codes are returned by the Edge Function in error responses.
 * Client-side code may extend or map these codes for UI-specific handling.
 *
 * **Relationship with Client-Side Errors:**
 * - Client code (e.g., `src/lib/services/pdf-extraction-service.ts`) may define
 *   additional error types like `PdfExtractionErrorType` that extend or wrap
 *   these server codes for network errors, timeout handling, or UI-specific cases.
 * - Server codes focus on extraction-specific failures, while client codes may
 *   include transport-layer errors (NETWORK_ERROR, TIMEOUT, etc.).
 *
 * **Usage Example:**
 * ```typescript
 * // Server returns: { error: { code: "FILE_TOO_LARGE", message: "..." } }
 * // Client may map to: "UPLOAD_SIZE_EXCEEDED" for user-friendly messaging
 * ```
 */
export type PDFExtractionErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_CONTENT_TYPE"
  | "FILE_REQUIRED"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "PDF_EXTRACTION_FAILED"
  | "INTERNAL_ERROR";

/**
 * Custom error class for PDF extraction errors
 */
export class PDFExtractionError extends Error {
  constructor(
    public readonly code: PDFExtractionErrorCode,
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "PDFExtractionError";
  }
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Options for text cleaning/processing
 */
export interface TextCleaningOptions {
  /** Whether to fix LinkedIn URLs (default: true) */
  fixLinkedInUrls?: boolean;
  /** Whether to remove page numbers (default: true) */
  removePageNumbers?: boolean;
  /** Whether to add line breaks after sentences (default: true) */
  addSentenceBreaks?: boolean;
  /** Whether to normalize whitespace (default: true) */
  normalizeWhitespace?: boolean;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  /** Whether the file is valid */
  isValid: boolean;
  /** Error if validation failed */
  error?: {
    code: PDFExtractionErrorCode;
    message: string;
    statusCode: number;
  };
}
