/**
 * Sync Configuration Repository
 *
 * Handles database operations for GitHub sync configuration,
 * including fetching config and updating sync cursors.
 *
 * @module sync-github-prs/repositories/sync-config-repository
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { SyncConfig, SyncCursor, OPERATION } from '../config.ts';
import { GitHubPullRequestListItem } from '../../_shared/github/types.ts';

/**
 * Raw sync config response from Supabase query with joined repository data
 */
interface SyncConfigRaw {
  id: string;
  repository_id: number;
  github_token_encrypted: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  sync_cursor: SyncCursor | null;
  project_git_repositories: {
    id: number;
    project_id: string;
    url: string;
  };
}

/**
 * Repository for sync configuration database operations
 */
export class SyncConfigRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Get sync configuration from database
   *
   * @param repoId - Repository ID
   * @returns Sync configuration or null if not found
   */
  async getConfig(repoId: string): Promise<SyncConfig | null> {
    // Convert repository_id to number as the database column is bigint
    const repoIdNumber = parseInt(repoId, 10);
    if (isNaN(repoIdNumber)) {
      console.error(`[${OPERATION}] Invalid repository_id: ${repoId}`);
      return null;
    }

    const { data, error } = await this.supabase
      .from('github_sync_config')
      .select(
        `
        id,
        repository_id,
        github_token_encrypted,
        sync_enabled,
        last_synced_at,
        sync_cursor,
        project_git_repositories!inner (
          id,
          project_id,
          url,
          deleted_at,
          project_knowledge_base!inner (
            id,
            deleted_at
          )
        )
      `
      )
      .eq('repository_id', repoIdNumber)
      .eq('is_active', true)
      .is('deleted_at', null)
      .is('project_git_repositories.deleted_at', null)
      .is('project_git_repositories.project_knowledge_base.deleted_at', null)
      .single();

    if (error) {
      console.error(`[${OPERATION}] Failed to fetch sync config:`, error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Type-safe access to joined repository data
    const typedData = data as SyncConfigRaw;
    const repo = typedData.project_git_repositories;

    return {
      id: typedData.id,
      repository_id: String(typedData.repository_id),
      project_id: repo.project_id,
      repository_url: repo.url,
      github_token_encrypted: typedData.github_token_encrypted,
      sync_enabled: typedData.sync_enabled,
      last_synced_at: typedData.last_synced_at,
      sync_cursor: typedData.sync_cursor,
    };
  }

  /**
   * Update sync cursor with latest sync timestamp
   *
   * @param configId - Sync config ID
   * @param latestPr - Most recently updated PR
   * @param syncTimestamp - Timestamp of sync completion
   */
  async updateCursor(
    configId: string,
    latestPr: GitHubPullRequestListItem,
    syncTimestamp: string
  ): Promise<void> {
    const cursor: SyncCursor = {
      last_sync_timestamp: syncTimestamp,
      last_pr_number: latestPr.number,
      last_pr_updated_at: latestPr.updated_at,
    };

    const { error } = await this.supabase
      .from('github_sync_config')
      .update({
        last_synced_at: syncTimestamp,
        sync_cursor: cursor,
        updated_at: syncTimestamp,
      })
      .eq('id', configId);

    if (error) {
      console.error(`[${OPERATION}] Failed to update sync cursor:`, error);
      throw error;
    }
  }
}
