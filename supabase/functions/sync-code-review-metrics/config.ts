/**
 * Code Review Metrics Refresh - Configuration
 *
 * Defines configuration constants for the sync-code-review-metrics
 * Edge Function including operation identifiers, timeout settings,
 * and materialized view names.
 *
 * @module sync-code-review-metrics/config
 */

// =============================================================================
// Operation Constants
// =============================================================================

/**
 * Edge Function operation identifier for logging and tracking.
 * Used as prefix in all console.log/console.error statements.
 */
export const OPERATION = 'sync-code-review-metrics';

// =============================================================================
// Timeout Configuration
// =============================================================================

/**
 * Maximum time (in milliseconds) allowed for the materialized view refresh.
 * If exceeded, the operation is aborted to prevent long-running queries
 * from blocking other database operations.
 *
 * Default: 30 seconds
 */
export const REFRESH_TIMEOUT_MS = 30_000;

// =============================================================================
// Materialized View Names
// =============================================================================

/**
 * Name of the materialized view that aggregates metrics by reviewer.
 * Tracks total reviews, approvals, changes requested, response times, etc.
 */
export const MV_METRICS_BY_REVIEWER = 'mv_code_review_metrics_by_reviewer';

/**
 * Name of the materialized view that aggregates metrics by PR author.
 * Tracks first-review approval rate, comments received, changes requested, etc.
 */
export const MV_METRICS_BY_AUTHOR = 'mv_code_review_metrics_by_author';

/**
 * Ordered list of all materialized views to be refreshed.
 * Order matters: reviewer view is refreshed first as it has fewer dependencies.
 */
export const MATERIALIZED_VIEWS = [
  MV_METRICS_BY_REVIEWER,
  MV_METRICS_BY_AUTHOR,
] as const;

/**
 * Name of the SQL function that performs the REFRESH MATERIALIZED VIEW CONCURRENTLY
 * for all code review metrics views. Created in the database migration.
 */
export const REFRESH_FUNCTION_NAME = 'refresh_code_review_metrics';
