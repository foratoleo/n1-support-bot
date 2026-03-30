/**
 * Formatter Factory for Normalized Generated Document Record
 *
 * Maps document_type strings to their corresponding formatter instances.
 * Falls back to defaultFormatter for any unmapped type.
 *
 * @module get-generated-document-normalized-record/formatters/index
 */

import { DocumentFormatter } from '../types.ts';

import { defaultFormatter } from './default-formatter.ts';
import { prdFormatter } from './prd-formatter.ts';
import { userStoryFormatter } from './user-story-formatter.ts';
import { meetingNotesFormatter } from './meeting-notes-formatter.ts';
import { testCasesFormatter } from './test-cases-formatter.ts';
import { unitTestsFormatter } from './unit-tests-formatter.ts';
import { specsFormatter } from './specs-formatter.ts';
import { resultsFormatter } from './results-formatter.ts';
import { aiSuggestedTasksFormatter } from './ai-suggested-tasks-formatter.ts';
import { aiSuggestedBacklogFormatter } from './ai-suggested-backlog-formatter.ts';
import { aiSuggestedFeaturesFormatter } from './ai-suggested-features-formatter.ts';

/**
 * Maps document_type values to their formatter implementations.
 * Includes both hyphenated and underscore variants plus common aliases.
 */
const FORMATTER_MAP: Record<string, DocumentFormatter> = {
  // PRD
  'prd': prdFormatter,

  // User Story
  'user-story': userStoryFormatter,
  'user_story': userStoryFormatter,

  // Meeting Notes
  'meeting-notes': meetingNotesFormatter,
  'meeting_notes': meetingNotesFormatter,

  // Technical Specs (with alias)
  'technical-specs': specsFormatter,
  'technical_specs': specsFormatter,

  // Test Cases
  'test-cases': testCasesFormatter,
  'test_cases': testCasesFormatter,

  // Unit Tests
  'unit-tests': unitTestsFormatter,
  'unit_tests': unitTestsFormatter,

  // Test Results
  'accessibility-test-result': resultsFormatter,
  'accessibility_test_result': resultsFormatter,
  'performance-test-result': resultsFormatter,
  'performance_test_result': resultsFormatter,

  // AI-Suggested Items (JSON content)
  'tasks': aiSuggestedTasksFormatter,
  'product-backlog-items': aiSuggestedBacklogFormatter,
  'product_backlog_items': aiSuggestedBacklogFormatter,
  'features': aiSuggestedFeaturesFormatter
};

/**
 * Returns the appropriate formatter for the given document type.
 * Falls back to defaultFormatter if no mapping exists.
 *
 * @param documentType - The document_type string from the database
 * @returns DocumentFormatter implementation for the type
 */
export function getFormatter(documentType: string | null): DocumentFormatter {
  if (!documentType) {
    return defaultFormatter;
  }
  return FORMATTER_MAP[documentType] ?? defaultFormatter;
}

export { defaultFormatter };
