/**
 * Code Review Metrics Refresh - Type Definitions
 *
 * Defines request/response interfaces for the sync-code-review-metrics
 * Edge Function that refreshes materialized views for code review metrics.
 *
 * @module sync-code-review-metrics/types
 */

// =============================================================================
// Request Types
// =============================================================================

/**
 * Request body for the metrics refresh endpoint.
 *
 * Both fields are optional:
 * - project_id: limits refresh scope (currently unused by REFRESH MATERIALIZED VIEW,
 *   but reserved for future per-project refresh strategies)
 * - force_full: bypasses any skip logic (e.g., if views were recently refreshed)
 */
export interface MetricsRefreshRequest {
  /**
   * Optional project ID to scope the refresh.
   * Currently reserved for future use - materialized views refresh all projects.
   */
  project_id?: string;

  /**
   * Force a full refresh even if views were recently updated.
   * Defaults to false.
   */
  force_full?: boolean;
}

// =============================================================================
// Response Types
// =============================================================================

/**
 * Response returned after a metrics refresh operation.
 *
 * Contains the list of views refreshed, timing information,
 * and any error details if the operation failed.
 */
export interface MetricsRefreshResponse {
  /** Whether the refresh completed successfully */
  success: boolean;

  /** List of materialized view names that were refreshed */
  views_refreshed: string[];

  /** Total duration of the refresh operation in milliseconds */
  duration_ms: number;

  /** Error message if the refresh failed */
  error?: string;

  /** ISO timestamp when the refresh started */
  started_at: string;

  /** ISO timestamp when the refresh completed */
  completed_at: string;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error categories for the metrics refresh operation.
 *
 * Used to map errors to appropriate HTTP status codes:
 * - validation: 400
 * - database: 500
 * - timeout: 504
 * - lock_conflict: 409
 * - unknown: 500
 */
export type MetricsRefreshErrorType =
  | 'validation'
  | 'database'
  | 'timeout'
  | 'lock_conflict'
  | 'unknown';

/**
 * Structured error information for logging and response formatting.
 */
export interface MetricsRefreshError {
  /** Human-readable error message */
  message: string;

  /** Error category for HTTP status mapping */
  type: MetricsRefreshErrorType;

  /** ISO timestamp when the error occurred */
  timestamp: string;
}
