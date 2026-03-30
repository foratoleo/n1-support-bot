/**
 * Sync Log Repository
 *
 * Handles database operations for sync logging and completion tracking.
 *
 * @module sync-github-prs/repositories/sync-log-repository
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SyncSummary, OPERATION } from '../config.ts';

/**
 * Sync type for logging
 */
export type SyncType = 'full_sync' | 'incremental_sync' | 'single_pr' | 'webhook';

/**
 * Repository for sync log database operations
 */
export class SyncLogRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Log sync completion
   *
   * @param repositoryId - Repository ID
   * @param summary - Sync summary
   * @param syncType - Type of sync performed
   */
  async logCompletion(
    repositoryId: string,
    summary: SyncSummary,
    syncType: SyncType = 'incremental_sync'
  ): Promise<void> {
    // Convert repository_id to number as the database column is bigint
    const repoIdNumber = parseInt(repositoryId, 10);
    if (isNaN(repoIdNumber)) {
      console.error(`[${OPERATION}] Invalid repository_id for sync log: ${repositoryId}`);
      return;
    }

    const { error } = await this.supabase.from('github_sync_log').insert({
      repository_id: repoIdNumber,
      sync_type: syncType,
      status: summary.errors.length > 0 ? 'partial_success' : 'success',
      started_at: summary.started_at,
      completed_at: summary.completed_at,
      duration_ms: summary.duration_ms,
      prs_synced: summary.pull_requests_synced,
      reviews_synced: summary.reviews_synced,
      comments_synced: summary.comments_synced,
      commits_synced: summary.commits_synced,
      api_calls_made: summary.api_calls_made ?? 0,
      rate_limit_remaining: summary.rate_limit_remaining ?? null,
      error_message: summary.errors.length > 0 ? summary.errors[0].message : null,
      error_details: summary.errors.length > 0 ? { errors: summary.errors } : null,
      metadata: {},
    });

    if (error) {
      console.error(`[${OPERATION}] Failed to log sync completion:`, error);
    }
  }
}
