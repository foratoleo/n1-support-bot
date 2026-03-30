/**
 * PDF Extraction Module for Supabase Edge Functions
 *
 * Provides comprehensive PDF text extraction functionality with:
 * - TypeScript interfaces for extraction results and errors
 * - PDF parsing using pdfjs-serverless
 * - Text cleaning and processing utilities
 * - File validation helpers
 *
 * @module pdf-extraction
 *
 * @example
 * ```typescript
 * import {
 *   extractTextFromPDF,
 *   cleanExtractedText,
 *   validatePDFFile,
 *   PDF_CORS_HEADERS,
 *   type PDFExtractionResult,
 * } from '../_shared/pdf-extraction/index.ts';
 *
 * // Validate and extract
 * const validation = validatePDFFile(file);
 * if (!validation.isValid) {
 *   return Response.json({ error: validation.error }, { status: validation.error.statusCode });
 * }
 *
 * const fileBuffer = await fileToUint8Array(file);
 * const { text, pageCount } = await extractTextFromPDF(fileBuffer);
 * const cleanedText = cleanExtractedText(text);
 * ```
 */

// =============================================================================
// Types Export
// =============================================================================

export type {
  // Result types
  PDFExtractionResult,
  PDFMetadata,
  PDFExtractionSuccessResponse,
  PDFExtractionErrorResponse,
  PDFExtractionResponse,

  // Error types
  PDFExtractionErrorCode,

  // Utility types
  TextCleaningOptions,
  FileValidationResult,
} from "./types.ts";

export {
  // Constants
  MAX_FILE_SIZE,
  PDF_CORS_HEADERS,

  // Error class
  PDFExtractionError,
} from "./types.ts";

// =============================================================================
// PDF Parser Export
// =============================================================================

export {
  extractTextFromPDF,
  validatePDFFile,
  extractFileFromFormData,
  fileToUint8Array,
} from "./pdf-parser.ts";

// =============================================================================
// Text Processor Export
// =============================================================================

export {
  // Main cleaning function
  cleanExtractedText,

  // Utility functions
  nowIso,

  // Individual cleaning functions
  fixLinkedInUrls,
  addSentenceBreaks,
  removePageNumbers,
  normalizeWhitespace,
} from "./text-processor.ts";
