/**
 * PDF Text Processing Module
 *
 * Utilities for cleaning and processing extracted PDF text.
 *
 * @module pdf-extraction/text-processor
 */

import type { TextCleaningOptions } from "./types.ts";

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Returns current timestamp in ISO format
 */
export const nowIso = (): string => new Date().toISOString();

// =============================================================================
// Text Cleaning Functions
// =============================================================================

/**
 * Fixes LinkedIn URLs that may have been broken during extraction
 *
 * @param text - Text containing potentially broken LinkedIn URLs
 * @returns Text with fixed LinkedIn URLs
 */
export function fixLinkedInUrls(text: string): string {
  let result = text;

  // Fix URLs that got split with a dash
  result = result.replace(
    /www\.linkedin\.com\/in\/([a-zA-Z0-9\-]+)\s*\-\s*([a-zA-Z0-9\-]+)/g,
    (match, part1, part2) => `https://www.linkedin.com/in/${part1}-${part2}/`
  );

  // Add https:// to URLs that don't have it
  result = result.replace(
    /(?<!https:\/\/)www\.linkedin\.com\/in\/([a-zA-Z0-9\-]+)\/?/g,
    (match, username) => `https://www.linkedin.com/in/${username}/`
  );

  return result;
}

/**
 * Adds line breaks after sentences for better readability
 *
 * @param text - Text to process
 * @returns Text with line breaks after sentences
 */
export function addSentenceBreaks(text: string): string {
  let result = text;

  // Add double line break after periods followed by multiple spaces
  result = result.replace(/\.\s{2,}/g, ".\n\n");

  // Add single line break after periods followed by single space
  result = result.replace(/\.\s/g, ".\n");

  // Add line break after closing parentheses followed by multiple spaces
  result = result.replace(/\)\s{2,}/g, ")\n");

  return result;
}

/**
 * Removes page number indicators from text
 *
 * @param text - Text containing page numbers
 * @returns Text without page number indicators
 */
export function removePageNumbers(text: string): string {
  return text.replace(/\s*Page\s+\d+\s+of\s+\d+\s*/gi, "");
}

/**
 * Normalizes excessive whitespace in text
 *
 * @param text - Text with potentially excessive whitespace
 * @returns Text with normalized whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s{3,}/g, " ");
}

/**
 * Cleans and processes extracted PDF text
 *
 * Applies multiple cleaning operations:
 * - Fixes broken LinkedIn URLs
 * - Adds line breaks after sentences
 * - Removes page number indicators
 * - Normalizes whitespace
 *
 * @param text - Raw extracted text from PDF
 * @param options - Optional cleaning options
 * @returns Cleaned and formatted text
 *
 * @example
 * ```typescript
 * const cleanedText = cleanExtractedText(rawText);
 *
 * // With custom options
 * const cleanedText = cleanExtractedText(rawText, {
 *   fixLinkedInUrls: true,
 *   removePageNumbers: true,
 *   addSentenceBreaks: false,
 *   normalizeWhitespace: true,
 * });
 * ```
 */
export function cleanExtractedText(
  text: string,
  options: TextCleaningOptions = {}
): string {
  const {
    fixLinkedInUrls: shouldFixLinkedIn = true,
    removePageNumbers: shouldRemovePageNumbers = true,
    addSentenceBreaks: shouldAddBreaks = true,
    normalizeWhitespace: shouldNormalizeWhitespace = true,
  } = options;

  let cleaned = text;

  if (shouldFixLinkedIn) {
    cleaned = fixLinkedInUrls(cleaned);
  }

  if (shouldAddBreaks) {
    cleaned = addSentenceBreaks(cleaned);
  }

  if (shouldRemovePageNumbers) {
    cleaned = removePageNumbers(cleaned);
  }

  if (shouldNormalizeWhitespace) {
    cleaned = normalizeWhitespace(cleaned);
  }

  return cleaned.trim();
}
