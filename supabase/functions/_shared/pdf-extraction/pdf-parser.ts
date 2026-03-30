/**
 * PDF Parser Module
 *
 * Utilities for parsing and extracting text from PDF files.
 * Uses pdfjs-serverless for Deno Edge Function compatibility.
 *
 * @module pdf-extraction/pdf-parser
 */

import type { PDFExtractionResult, FileValidationResult } from "./types.ts";
import { MAX_FILE_SIZE } from "./types.ts";

// =============================================================================
// PDF Extraction
// =============================================================================

/**
 * Extracts text content from a PDF file buffer
 *
 * Uses pdfjs-serverless library optimized for serverless/edge environments.
 * Processes all pages and concatenates text content.
 *
 * @param fileBuffer - PDF file as Uint8Array
 * @returns Extracted text and page count
 * @throws Error if PDF parsing fails
 *
 * @example
 * ```typescript
 * const arrayBuffer = await file.arrayBuffer();
 * const fileBuffer = new Uint8Array(arrayBuffer);
 * const { text, pageCount } = await extractTextFromPDF(fileBuffer);
 * ```
 */
export async function extractTextFromPDF(
  fileBuffer: Uint8Array
): Promise<PDFExtractionResult> {
  try {
    const { resolvePDFJS } = await import(
      "https://esm.sh/pdfjs-serverless@0.4.2"
    );

    const { getDocument } = await resolvePDFJS();

    const doc = await getDocument({ data: fileBuffer, useSystemFonts: true })
      .promise;

    const allText: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const textContent = await page.getTextContent();
      const contents = textContent.items
        .map((item: any) => item.str)
        .join(" ");
      allText.push(contents);
    }

    return {
      text: allText.join("\n").trim(),
      pageCount: doc.numPages,
    };
  } catch (error: any) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

// =============================================================================
// File Validation
// =============================================================================

/**
 * Validates that a file is a valid PDF within size limits
 *
 * @param file - File object to validate
 * @param maxSize - Maximum allowed file size in bytes (default: MAX_FILE_SIZE)
 * @returns Validation result with error details if invalid
 *
 * @example
 * ```typescript
 * const validation = validatePDFFile(file);
 * if (!validation.isValid) {
 *   return Response.json(
 *     { error: validation.error },
 *     { status: validation.error.statusCode }
 *   );
 * }
 * ```
 */
export function validatePDFFile(
  file: File,
  maxSize: number = MAX_FILE_SIZE
): FileValidationResult {
  const fileName = file.name.toLowerCase();
  const fileMimeType = file.type;
  const isPDF = fileName.endsWith(".pdf") || fileMimeType === "application/pdf";

  if (!isPDF) {
    return {
      isValid: false,
      error: {
        code: "INVALID_FILE_TYPE",
        message: `Invalid file type. Expected PDF but got: ${fileMimeType || "unknown"}`,
        statusCode: 415,
      },
    };
  }

  const fileSize = file.size;

  if (fileSize > maxSize) {
    return {
      isValid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum of ${maxSize / 1024 / 1024}MB`,
        statusCode: 413,
      },
    };
  }

  return { isValid: true };
}

/**
 * Extracts file from FormData with support for multiple field names
 *
 * @param formData - FormData object from request
 * @param fieldNames - Array of field names to check (default: ['file', 'pdf'])
 * @returns File object or null if not found
 *
 * @example
 * ```typescript
 * const formData = await req.formData();
 * const file = extractFileFromFormData(formData);
 * if (!file) {
 *   return Response.json({ error: { code: 'FILE_REQUIRED', message: '...' }});
 * }
 * ```
 */
export function extractFileFromFormData(
  formData: FormData,
  fieldNames: string[] = ["file", "pdf"]
): File | null {
  for (const fieldName of fieldNames) {
    const file = formData.get(fieldName);
    if (file && file instanceof File) {
      return file;
    }
  }
  return null;
}

/**
 * Converts a File object to Uint8Array for processing
 *
 * @param file - File object to convert
 * @returns Uint8Array of file contents
 *
 * @example
 * ```typescript
 * const fileBuffer = await fileToUint8Array(file);
 * const { text, pageCount } = await extractTextFromPDF(fileBuffer);
 * ```
 */
export async function fileToUint8Array(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
