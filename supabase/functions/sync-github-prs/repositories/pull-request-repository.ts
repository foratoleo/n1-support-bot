/**
 * Pull Request Repository
 *
 * Handles database operations for GitHub pull requests.
 *
 * @module sync-github-prs/repositories/pull-request-repository
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GitHubPullRequest } from '../../_shared/github/types.ts';
import { SyncConfig, OPERATION } from '../config.ts';

/**
 * Repository for pull request database operations
 */
export class PullRequestRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Upsert pull request data
   *
   * @param config - Sync configuration
   * @param pr - Pull request data from GitHub
   */
  async upsert(config: SyncConfig, pr: GitHubPullRequest): Promise<void> {
    // Convert repository_id to number as the database column is bigint
    const repoIdNumber = parseInt(config.repository_id, 10);

    const { error } = await this.supabase.from('github_pull_requests').upsert(
      {
        repository_id: repoIdNumber,
        project_id: config.project_id,
        github_pr_id: pr.id,
        github_pr_number: pr.number,
        title: pr.title,
        description: pr.body,
        state: pr.merged ? 'merged' : pr.state,
        author_login: pr.user.login,
        author_id: pr.user.id,
        author_avatar_url: pr.user.avatar_url,
        head_branch: pr.head.ref,
        base_branch: pr.base.ref,
        head_sha: pr.head.sha,
        base_sha: pr.base.sha,
        labels: pr.labels || [],
        assignees: pr.assignees || [],
        reviewers: pr.requested_reviewers || [],
        milestone: pr.milestone || null,
        is_draft: pr.draft || false,
        mergeable: pr.mergeable ?? null,
        merged: pr.merged || false,
        created_at_github: pr.created_at,
        updated_at_github: pr.updated_at,
        closed_at_github: pr.closed_at,
        merged_at_github: pr.merged_at,
        html_url: pr.html_url,
        diff_url: pr.diff_url,
        patch_url: pr.patch_url,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits_count: pr.commits || 0,
        comments_count: pr.comments || 0,
        review_comments_count: pr.review_comments || 0,
        metadata: {},
      },
      {
        onConflict: 'repository_id,github_pr_number',
      }
    );

    if (error) {
      console.error(`[${OPERATION}] Failed to upsert PR #${pr.number}:`, error);
      throw error;
    }
  }

  /**
   * Get internal PR ID by repository and PR number
   *
   * @param repositoryId - Repository ID
   * @param prNumber - PR number
   * @returns Internal PR UUID or null
   */
  async getInternalId(repositoryId: string, prNumber: number): Promise<string | null> {
    // Convert repository_id to number as the database column is bigint
    const repoIdNumber = parseInt(repositoryId, 10);

    const { data } = await this.supabase
      .from('github_pull_requests')
      .select('id')
      .eq('repository_id', repoIdNumber)
      .eq('github_pr_number', prNumber)
      .single();

    return data?.id ?? null;
  }
}
