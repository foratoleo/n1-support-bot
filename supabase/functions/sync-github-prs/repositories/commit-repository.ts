/**
 * Commit Repository
 *
 * Handles database operations for GitHub PR commits.
 * Includes optimization to skip fetching stats for commits
 * that already have them in the database.
 *
 * @module sync-github-prs/repositories/commit-repository
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GitHubCommit } from '../../_shared/github/types.ts';
import { GitHubClient } from '../../_shared/github/client.ts';
import { OPERATION } from '../config.ts';

/**
 * Existing commit record from database
 */
interface ExistingCommit {
  id: string;
  sha: string;
  additions: number | null;
  deletions: number | null;
  total_changes: number | null;
}

/**
 * Repository for commit database operations
 */
export class CommitRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Upsert commits for a pull request
   * Fetches individual commit details to get stats (additions, deletions, total)
   * Optimized to skip fetching stats for commits that already have them
   *
   * @param client - GitHub API client
   * @param pullRequestId - Internal PR UUID
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param commits - Commits from GitHub
   */
  async upsertMany(
    client: GitHubClient,
    pullRequestId: string,
    owner: string,
    repo: string,
    commits: GitHubCommit[]
  ): Promise<void> {
    if (commits.length === 0) return;

    // Get existing commits with their stats to avoid unnecessary API calls
    const existingCommitMap = await this.getExistingCommitsMap(pullRequestId, commits);

    // Separate commits that need stats fetch from those that don't
    const { needsStats, hasStats } = this.categorizeCommits(commits, existingCommitMap);

    console.log(
      `[${OPERATION}] Commits: ${commits.length} total, ${needsStats.length} need stats fetch, ${hasStats.length} already have stats`
    );

    // Fetch commit details with stats in batches (only for commits that need it)
    const commitsWithStats = await this.fetchCommitStats(client, owner, repo, needsStats, hasStats);

    // Upsert all commits
    await this.upsertCommitBatch(pullRequestId, commitsWithStats, existingCommitMap);
  }

  /**
   * Get existing commits map with stats info
   */
  private async getExistingCommitsMap(
    pullRequestId: string,
    commits: GitHubCommit[]
  ): Promise<Map<string, { id: string; hasStats: boolean }>> {
    const commitShas = commits.map((c) => c.sha);
    const { data: existingCommits } = await this.supabase
      .from('github_pr_commits')
      .select('id, sha, additions, deletions, total_changes')
      .eq('pull_request_id', pullRequestId)
      .in('sha', commitShas)
      .is('deleted_at', null);

    const existingCommitMap = new Map<string, { id: string; hasStats: boolean }>();
    for (const existing of (existingCommits as ExistingCommit[]) || []) {
      const hasStats =
        (existing.additions ?? 0) > 0 ||
        (existing.deletions ?? 0) > 0 ||
        (existing.total_changes ?? 0) > 0;
      existingCommitMap.set(existing.sha, { id: existing.id, hasStats });
    }

    return existingCommitMap;
  }

  /**
   * Categorize commits into those needing stats and those with existing stats
   */
  private categorizeCommits(
    commits: GitHubCommit[],
    existingCommitMap: Map<string, { id: string; hasStats: boolean }>
  ): { needsStats: GitHubCommit[]; hasStats: GitHubCommit[] } {
    const needsStats: GitHubCommit[] = [];
    const hasStats: GitHubCommit[] = [];

    for (const commit of commits) {
      const existing = existingCommitMap.get(commit.sha);
      if (existing?.hasStats) {
        hasStats.push(commit);
      } else {
        needsStats.push(commit);
      }
    }

    return { needsStats, hasStats };
  }

  /**
   * Fetch commit stats from GitHub API in batches
   */
  private async fetchCommitStats(
    client: GitHubClient,
    owner: string,
    repo: string,
    needsStats: GitHubCommit[],
    hasStats: GitHubCommit[]
  ): Promise<GitHubCommit[]> {
    const COMMIT_BATCH_SIZE = 5;
    const commitsWithStats: GitHubCommit[] = [...hasStats];

    for (let i = 0; i < needsStats.length; i += COMMIT_BATCH_SIZE) {
      const batch = needsStats.slice(i, i + COMMIT_BATCH_SIZE);

      const commitDetailsPromises = batch.map(async (commit) => {
        try {
          const details = await client.getCommit(owner, repo, commit.sha);
          return { ...commit, stats: details.stats };
        } catch (error) {
          console.warn(`[${OPERATION}] Failed to fetch stats for commit ${commit.sha}:`, error);
          return commit;
        }
      });

      const batchResults = await Promise.all(commitDetailsPromises);
      commitsWithStats.push(...batchResults);

      // Add small delay between batches to respect rate limits
      if (i + COMMIT_BATCH_SIZE < needsStats.length) {
        await this.delay(500);
      }
    }

    return commitsWithStats;
  }

  /**
   * Upsert batch of commits to database
   */
  private async upsertCommitBatch(
    pullRequestId: string,
    commits: GitHubCommit[],
    existingCommitMap: Map<string, { id: string; hasStats: boolean }>
  ): Promise<void> {
    for (const commit of commits) {
      const commitData = this.buildCommitData(pullRequestId, commit);
      const existing = existingCommitMap.get(commit.sha);

      if (existing) {
        await this.updateCommit(existing, commitData);
      } else {
        await this.insertCommit(commitData);
      }
    }
  }

  /**
   * Build commit data object for database
   */
  private buildCommitData(
    pullRequestId: string,
    commit: GitHubCommit
  ): Record<string, unknown> {
    return {
      pull_request_id: pullRequestId,
      sha: commit.sha,
      author_name: commit.commit.author?.name ?? null,
      author_email: commit.commit.author?.email ?? null,
      author_date: commit.commit.author?.date ?? null,
      committer_name: commit.commit.committer?.name ?? null,
      committer_email: commit.commit.committer?.email ?? null,
      committer_date: commit.commit.committer?.date ?? null,
      message: commit.commit.message,
      committed_at: commit.commit.committer?.date || commit.commit.author?.date,
      html_url: commit.html_url,
      additions: commit.stats?.additions ?? 0,
      deletions: commit.stats?.deletions ?? 0,
      total_changes: commit.stats?.total ?? 0,
      metadata: {},
    };
  }

  /**
   * Update existing commit
   */
  private async updateCommit(
    existing: { id: string; hasStats: boolean },
    commitData: Record<string, unknown>
  ): Promise<void> {
    // Skip stats fields if commit already has stats
    const updateData = existing.hasStats
      ? { ...commitData, additions: undefined, deletions: undefined, total_changes: undefined }
      : commitData;

    // Remove undefined fields
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([, v]) => v !== undefined)
    );

    const { error } = await this.supabase
      .from('github_pr_commits')
      .update(cleanUpdateData)
      .eq('id', existing.id);

    if (error) {
      console.error(`[${OPERATION}] Failed to update commit ${commitData.sha}:`, error);
    }
  }

  /**
   * Insert new commit
   */
  private async insertCommit(commitData: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.from('github_pr_commits').insert(commitData);

    if (error) {
      console.error(`[${OPERATION}] Failed to insert commit ${commitData.sha}:`, error);
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
