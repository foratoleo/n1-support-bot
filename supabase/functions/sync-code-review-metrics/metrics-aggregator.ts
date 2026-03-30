/**
 * Code Review Metrics Aggregator
 *
 * Encapsulates the logic for refreshing materialized views that aggregate
 * code review metrics. Executes the database function `refresh_code_review_metrics()`
 * which performs REFRESH MATERIALIZED VIEW CONCURRENTLY on all metrics views.
 *
 * Handles timeout enforcement, lock conflict detection, and structured
 * error reporting for monitoring.
 *
 * @module sync-code-review-metrics/metrics-aggregator
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  OPERATION,
  REFRESH_TIMEOUT_MS,
  REFRESH_FUNCTION_NAME,
  MATERIALIZED_VIEWS,
} from './config.ts';
import type { MetricsRefreshResponse } from './types.ts';

// =============================================================================
// MetricsAggregator Class
// =============================================================================

/**
 * Manages the refresh of code review metrics materialized views.
 *
 * Responsibilities:
 * - Execute the database refresh function via RPC
 * - Enforce timeout limits to prevent long-running queries
 * - Detect and handle lock conflicts (concurrent refresh attempts)
 * - Return structured results with timing information
 *
 * @example
 * ```typescript
 * const supabase = createSupabaseClient();
 * const aggregator = new MetricsAggregator(supabase);
 * const result = await aggregator.refreshMetrics();
 *
 * if (result.success) {
 *   console.log(`Refreshed ${result.views_refreshed.length} views in ${result.duration_ms}ms`);
 * }
 * ```
 */
export class MetricsAggregator {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Refresh all code review metrics materialized views.
   *
   * Calls the database function `refresh_code_review_metrics()` which executes
   * REFRESH MATERIALIZED VIEW CONCURRENTLY for each view. The operation is
   * wrapped with a timeout to prevent blocking other database operations.
   *
   * @returns Structured response with refresh results and timing
   */
  async refreshMetrics(): Promise<MetricsRefreshResponse> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    console.log(`[${OPERATION}] Starting materialized view refresh`);
    console.log(`[${OPERATION}] Views to refresh: ${MATERIALIZED_VIEWS.join(', ')}`);
    console.log(`[${OPERATION}] Timeout: ${REFRESH_TIMEOUT_MS}ms`);

    try {
      // Execute refresh with timeout enforcement
      await this.executeWithTimeout(
        () => this.executeRefresh(),
        REFRESH_TIMEOUT_MS
      );

      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      console.log(`[${OPERATION}] Refresh completed successfully in ${durationMs}ms`);

      return {
        success: true,
        views_refreshed: [...MATERIALIZED_VIEWS],
        duration_ms: durationMs,
        started_at: startedAt,
        completed_at: completedAt,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.error(`[${OPERATION}] Refresh failed after ${durationMs}ms:`, errorMessage);

      return {
        success: false,
        views_refreshed: [],
        duration_ms: durationMs,
        error: errorMessage,
        started_at: startedAt,
        completed_at: completedAt,
      };
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Execute the database refresh function via Supabase RPC.
   *
   * Calls `refresh_code_review_metrics()` which internally runs
   * REFRESH MATERIALIZED VIEW CONCURRENTLY for each metrics view.
   *
   * @throws Error if the RPC call fails (database error, function not found, etc.)
   */
  private async executeRefresh(): Promise<void> {
    console.log(`[${OPERATION}] Calling RPC: ${REFRESH_FUNCTION_NAME}`);

    const { error } = await this.supabase.rpc(REFRESH_FUNCTION_NAME);

    if (error) {
      // Detect specific PostgreSQL error conditions
      const errorMessage = error.message || '';
      const errorCode = error.code || '';

      // Lock conflict: another refresh is already running
      if (
        errorMessage.includes('could not obtain lock') ||
        errorMessage.includes('lock timeout') ||
        errorCode === '55P03' // lock_not_available
      ) {
        throw new Error(
          `Lock conflict: another refresh operation is in progress. ` +
          `Details: ${errorMessage}`
        );
      }

      // Function does not exist (migration not applied)
      if (
        errorMessage.includes('function') &&
        errorMessage.includes('does not exist')
      ) {
        throw new Error(
          `Database function '${REFRESH_FUNCTION_NAME}' not found. ` +
          `Ensure the database migration has been applied. ` +
          `Details: ${errorMessage}`
        );
      }

      // Statement timeout
      if (
        errorMessage.includes('statement timeout') ||
        errorCode === '57014' // query_canceled
      ) {
        throw new Error(
          `Database statement timeout exceeded during refresh. ` +
          `Details: ${errorMessage}`
        );
      }

      // Generic database error
      throw new Error(
        `Database error during metrics refresh: ${errorMessage} (code: ${errorCode})`
      );
    }

    console.log(`[${OPERATION}] RPC ${REFRESH_FUNCTION_NAME} executed successfully`);
  }

  /**
   * Execute an async operation with a timeout limit.
   *
   * If the operation exceeds the specified timeout, it is rejected
   * with a timeout error. Note that the underlying database query
   * may continue running - this only controls the Edge Function's
   * wait time.
   *
   * @param operation - Async function to execute
   * @param timeoutMs - Maximum allowed execution time in milliseconds
   * @throws Error if the operation exceeds the timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Operation timed out after ${timeoutMs}ms. ` +
            `The materialized view refresh may still be running in the database.`
          )
        );
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}
