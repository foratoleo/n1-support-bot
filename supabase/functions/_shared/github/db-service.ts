/**
 * GitHub Pull Request Database Service
 *
 * Manages database operations for GitHub Pull Requests, reviews, comments, and commits.
 * Uses batch operations and idempotent upserts for efficient synchronization.
 *
 * @module github/db-service
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import type {
  GitHubPullRequest,
  GitHubReview,
  GitHubComment,
  GitHubReviewComment,
  GitHubCommit,
} from './types.ts';

/**
 * PR upsert parameters
 */
export interface UpsertPullRequestParams {
  repository_id: number;
  project_id: string;
  pr: GitHubPullRequest;
}

/**
 * PR record (database format)
 */
export interface PullRequestRecord {
  id: string;
  repository_id: number;
  project_id: string;
  github_pr_id: number;
  github_pr_number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed' | 'merged';
  author_login: string;
  author_id: number;
  author_avatar_url: string | null;
  head_branch: string;
  base_branch: string;
  head_sha: string;
  base_sha: string;
  labels: unknown;
  assignees: unknown;
  reviewers: unknown;
  milestone: unknown;
  is_draft: boolean;
  mergeable: boolean | null;
  merged: boolean;
  created_at_github: string;
  updated_at_github: string;
  closed_at_github: string | null;
  merged_at_github: string | null;
  html_url: string;
  diff_url: string | null;
  patch_url: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  commits_count: number;
  comments_count: number;
  review_comments_count: number;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

/**
 * Review record (database format)
 */
export interface ReviewRecord {
  id: string;
  pull_request_id: string;
  github_review_id: number;
  reviewer_login: string;
  reviewer_id: number;
  reviewer_avatar_url: string | null;
  state: string;
  body: string | null;
  submitted_at: string;
  commit_id: string;
  html_url: string;
  metadata: unknown;
}

/**
 * Comment record (database format)
 */
export interface CommentRecord {
  id: string;
  pull_request_id: string;
  github_comment_id: number;
  comment_type: 'issue_comment' | 'review_comment';
  author_login: string;
  author_id: number;
  author_avatar_url: string | null;
  body: string;
  in_reply_to_id: number | null;
  path: string | null;
  position: number | null;
  diff_hunk: string | null;
  commit_id: string | null;
  created_at_github: string;
  updated_at_github: string;
  html_url: string;
  metadata: unknown;
}

/**
 * Commit record (database format)
 */
export interface CommitRecord {
  id: string;
  pull_request_id: string;
  sha: string;
  author_name: string | null;
  author_email: string | null;
  author_date: string | null;
  committer_name: string | null;
  committer_email: string | null;
  committer_date: string | null;
  message: string;
  committed_at: string;
  html_url: string;
  additions: number;
  deletions: number;
  total_changes: number;
  metadata: unknown;
}

/**
 * Sync log record
 */
export interface SyncLogRecord {
  id: string;
  repository_id: number;
  sync_type: 'full_sync' | 'incremental_sync' | 'single_pr' | 'webhook';
  status: 'pending' | 'in_progress' | 'success' | 'partial_success' | 'failed';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  prs_synced: number;
  reviews_synced: number;
  comments_synced: number;
  commits_synced: number;
  api_calls_made: number;
  rate_limit_remaining: number | null;
  error_message: string | null;
  error_details: unknown;
  metadata: unknown;
}

/**
 * Sync statistics
 */
export interface SyncStats {
  prs_synced: number;
  reviews_synced: number;
  comments_synced: number;
  commits_synced: number;
  api_calls_made: number;
  rate_limit_remaining: number | null;
}

/**
 * PR filter options
 */
export interface PRFilterOptions {
  state?: 'open' | 'closed' | 'merged' | 'all';
  is_draft?: boolean;
  author_login?: string;
  limit?: number;
  offset?: number;
}

/**
 * Upsert result with affected row count
 */
export interface UpsertResult {
  success: boolean;
  affected_count: number;
  error?: Error;
}

/**
 * Service for managing GitHub PR database operations.
 * Implements idempotent upserts and batch operations for efficiency.
 */
export class GitHubPRDatabaseService {
  constructor(
    private supabaseClient: SupabaseClient,
    private operation: string
  ) {}

  /**
   * Upsert a pull request record (idempotent)
   *
   * @param params - Upsert parameters
   * @returns Pull request record ID
   */
  async upsertPullRequest(params: UpsertPullRequestParams): Promise<string> {
    try {
      const { repository_id, project_id, pr } = params;

      // Determine state based on GitHub PR data
      let state: 'open' | 'closed' | 'merged' = pr.state;
      if (pr.merged || pr.merged_at) {
        state = 'merged';
      }

      const prRecord = {
        repository_id,
        project_id,
        github_pr_id: pr.id,
        github_pr_number: pr.number,
        title: pr.title,
        description: pr.body,
        state,
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
        is_draft: pr.draft,
        mergeable: pr.mergeable !== undefined ? pr.mergeable : null,
        merged: pr.merged || false,
        created_at_github: pr.created_at,
        updated_at_github: pr.updated_at,
        closed_at_github: pr.closed_at,
        merged_at_github: pr.merged_at || null,
        html_url: pr.html_url,
        diff_url: pr.diff_url,
        patch_url: pr.patch_url,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits_count: pr.commits || 0,
        comments_count: pr.comments || 0,
        review_comments_count: pr.review_comments || 0,
        metadata: {
          node_id: pr.node_id,
          locked: pr.locked,
          active_lock_reason: pr.active_lock_reason,
          auto_merge: pr.auto_merge,
        },
      };

      // Upsert using ON CONFLICT for idempotency
      const { data, error } = await this.supabaseClient
        .from('github_pull_requests')
        .upsert(prRecord, {
          onConflict: 'repository_id,github_pr_number',
          ignoreDuplicates: false,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to upsert PR #${pr.number}:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Upserted PR #${pr.number}: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error(`[${this.operation}] Error upserting pull request:`, error);
      throw error;
    }
  }

  /**
   * Upsert multiple reviews for a pull request (batch operation)
   *
   * @param prId - Pull request database ID
   * @param reviews - Array of GitHub review objects
   * @returns Affected row count
   */
  async upsertReviews(prId: string, reviews: GitHubReview[]): Promise<UpsertResult> {
    try {
      if (reviews.length === 0) {
        return { success: true, affected_count: 0 };
      }

      const reviewRecords = reviews.map((review) => ({
        pull_request_id: prId,
        github_review_id: review.id,
        reviewer_login: review.user.login,
        reviewer_id: review.user.id,
        reviewer_avatar_url: review.user.avatar_url,
        state: review.state,
        body: review.body,
        submitted_at: review.submitted_at,
        commit_id: review.commit_id,
        html_url: review.html_url,
        metadata: {
          node_id: review.node_id,
          author_association: review.author_association,
        },
      }));

      const { error, count } = await this.supabaseClient
        .from('github_pr_reviews')
        .upsert(reviewRecords, {
          onConflict: 'github_review_id',
          ignoreDuplicates: false,
        })
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error(`[${this.operation}] Failed to upsert reviews:`, error);
        return { success: false, affected_count: 0, error };
      }

      console.log(`[${this.operation}] Upserted ${count || 0} reviews for PR ${prId}`);
      return { success: true, affected_count: count || 0 };
    } catch (error) {
      console.error(`[${this.operation}] Error upserting reviews:`, error);
      return { success: false, affected_count: 0, error: error as Error };
    }
  }

  /**
   * Upsert multiple comments for a pull request (batch operation)
   *
   * @param prId - Pull request database ID
   * @param issueComments - Array of issue comments
   * @param reviewComments - Array of review comments
   * @returns Affected row count
   */
  async upsertComments(
    prId: string,
    issueComments: GitHubComment[],
    reviewComments: GitHubReviewComment[]
  ): Promise<UpsertResult> {
    try {
      const commentRecords = [
        ...issueComments.map((comment) => ({
          pull_request_id: prId,
          github_comment_id: comment.id,
          comment_type: 'issue_comment' as const,
          author_login: comment.user.login,
          author_id: comment.user.id,
          author_avatar_url: comment.user.avatar_url,
          body: comment.body,
          in_reply_to_id: null,
          path: null,
          position: null,
          diff_hunk: null,
          commit_id: null,
          created_at_github: comment.created_at,
          updated_at_github: comment.updated_at,
          html_url: comment.html_url,
          metadata: {
            node_id: comment.node_id,
            author_association: comment.author_association,
            reactions: comment.reactions,
          },
        })),
        ...reviewComments.map((comment) => ({
          pull_request_id: prId,
          github_comment_id: comment.id,
          comment_type: 'review_comment' as const,
          author_login: comment.user.login,
          author_id: comment.user.id,
          author_avatar_url: comment.user.avatar_url,
          body: comment.body,
          in_reply_to_id: comment.in_reply_to_id || null,
          path: comment.path,
          position: comment.position,
          diff_hunk: comment.diff_hunk,
          commit_id: comment.commit_id,
          created_at_github: comment.created_at,
          updated_at_github: comment.updated_at,
          html_url: comment.html_url,
          metadata: {
            node_id: comment.node_id,
            author_association: comment.author_association,
            reactions: comment.reactions,
            pull_request_review_id: comment.pull_request_review_id,
          },
        })),
      ];

      if (commentRecords.length === 0) {
        return { success: true, affected_count: 0 };
      }

      const { error, count } = await this.supabaseClient
        .from('github_pr_comments')
        .upsert(commentRecords, {
          onConflict: 'github_comment_id',
          ignoreDuplicates: false,
        })
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error(`[${this.operation}] Failed to upsert comments:`, error);
        return { success: false, affected_count: 0, error };
      }

      console.log(`[${this.operation}] Upserted ${count || 0} comments for PR ${prId}`);
      return { success: true, affected_count: count || 0 };
    } catch (error) {
      console.error(`[${this.operation}] Error upserting comments:`, error);
      return { success: false, affected_count: 0, error: error as Error };
    }
  }

  /**
   * Upsert multiple commits for a pull request (batch operation)
   *
   * @param prId - Pull request database ID
   * @param commits - Array of GitHub commit objects
   * @returns Affected row count
   */
  async upsertCommits(prId: string, commits: GitHubCommit[]): Promise<UpsertResult> {
    try {
      if (commits.length === 0) {
        return { success: true, affected_count: 0 };
      }

      const commitRecords = commits.map((commit) => ({
        pull_request_id: prId,
        sha: commit.sha,
        author_name: commit.commit.author.name,
        author_email: commit.commit.author.email,
        author_date: commit.commit.author.date,
        committer_name: commit.commit.committer.name,
        committer_email: commit.commit.committer.email,
        committer_date: commit.commit.committer.date,
        message: commit.commit.message,
        committed_at: commit.commit.committer.date,
        html_url: commit.html_url,
        additions: 0,
        deletions: 0,
        total_changes: 0,
        metadata: {
          node_id: commit.node_id,
          parents: commit.parents,
          verification: commit.commit.verification,
        },
      }));

      const { error, count } = await this.supabaseClient
        .from('github_pr_commits')
        .upsert(commitRecords, {
          onConflict: 'pull_request_id,sha',
          ignoreDuplicates: false,
        })
        .select('id', { count: 'exact', head: true });

      if (error) {
        console.error(`[${this.operation}] Failed to upsert commits:`, error);
        return { success: false, affected_count: 0, error };
      }

      console.log(`[${this.operation}] Upserted ${count || 0} commits for PR ${prId}`);
      return { success: true, affected_count: count || 0 };
    } catch (error) {
      console.error(`[${this.operation}] Error upserting commits:`, error);
      return { success: false, affected_count: 0, error: error as Error };
    }
  }

  /**
   * Get pull requests by repository with optional filters
   *
   * @param repositoryId - Repository ID
   * @param filters - Optional filter criteria
   * @returns Array of pull request records
   */
  async getPRsByRepository(
    repositoryId: number,
    filters: PRFilterOptions = {}
  ): Promise<PullRequestRecord[]> {
    try {
      let query = this.supabaseClient
        .from('github_pull_requests')
        .select('*')
        .eq('repository_id', repositoryId)
        .is('deleted_at', null);

      // Apply filters
      if (filters.state && filters.state !== 'all') {
        query = query.eq('state', filters.state);
      }
      if (filters.is_draft !== undefined) {
        query = query.eq('is_draft', filters.is_draft);
      }
      if (filters.author_login) {
        query = query.eq('author_login', filters.author_login);
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      // Order by most recently updated
      query = query.order('updated_at_github', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error(`[${this.operation}] Failed to get PRs:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Retrieved ${data.length} PRs for repository ${repositoryId}`);
      return data as PullRequestRecord[];
    } catch (error) {
      console.error(`[${this.operation}] Error getting PRs:`, error);
      throw error;
    }
  }

  /**
   * Get detailed PR information with related data
   *
   * @param prId - Pull request database ID
   * @returns Pull request with reviews, comments, and commits
   */
  async getPRDetails(prId: string): Promise<{
    pr: PullRequestRecord;
    reviews: ReviewRecord[];
    comments: CommentRecord[];
    commits: CommitRecord[];
  } | null> {
    try {
      // Get PR
      const { data: pr, error: prError } = await this.supabaseClient
        .from('github_pull_requests')
        .select('*')
        .eq('id', prId)
        .is('deleted_at', null)
        .single();

      if (prError) {
        console.error(`[${this.operation}] Failed to get PR details:`, prError);
        return null;
      }

      // Get reviews
      const { data: reviews, error: reviewsError } = await this.supabaseClient
        .from('github_pr_reviews')
        .select('*')
        .eq('pull_request_id', prId)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false });

      // Get comments
      const { data: comments, error: commentsError } = await this.supabaseClient
        .from('github_pr_comments')
        .select('*')
        .eq('pull_request_id', prId)
        .is('deleted_at', null)
        .order('created_at_github', { ascending: false });

      // Get commits
      const { data: commits, error: commitsError } = await this.supabaseClient
        .from('github_pr_commits')
        .select('*')
        .eq('pull_request_id', prId)
        .is('deleted_at', null)
        .order('committed_at', { ascending: false });

      if (reviewsError || commentsError || commitsError) {
        console.warn(`[${this.operation}] Error fetching related data:`, {
          reviewsError,
          commentsError,
          commitsError,
        });
      }

      console.log(`[${this.operation}] Retrieved PR details for ${prId}`);
      return {
        pr: pr as PullRequestRecord,
        reviews: (reviews || []) as ReviewRecord[],
        comments: (comments || []) as CommentRecord[],
        commits: (commits || []) as CommitRecord[],
      };
    } catch (error) {
      console.error(`[${this.operation}] Error getting PR details:`, error);
      throw error;
    }
  }

  /**
   * Create a new sync log entry
   *
   * @param repositoryId - Repository ID
   * @param syncType - Type of sync operation
   * @returns Sync log ID
   */
  async createSyncLog(
    repositoryId: number,
    syncType: 'full_sync' | 'incremental_sync' | 'single_pr' | 'webhook'
  ): Promise<string> {
    try {
      const { data, error } = await this.supabaseClient
        .from('github_sync_log')
        .insert({
          repository_id: repositoryId,
          sync_type: syncType,
          status: 'pending',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to create sync log:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Created sync log: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error(`[${this.operation}] Error creating sync log:`, error);
      throw error;
    }
  }

  /**
   * Update sync log with progress counts
   *
   * @param logId - Sync log ID
   * @param counts - Sync statistics
   */
  async updateSyncProgress(logId: string, counts: Partial<SyncStats>): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from('github_sync_log')
        .update({
          status: 'in_progress',
          ...counts,
        })
        .eq('id', logId);

      if (error) {
        console.error(`[${this.operation}] Failed to update sync progress:`, error);
      }
    } catch (error) {
      console.error(`[${this.operation}] Error updating sync progress:`, error);
    }
  }

  /**
   * Complete a sync log entry with final statistics
   *
   * @param logId - Sync log ID
   * @param stats - Final sync statistics
   */
  async completeSyncLog(logId: string, stats: SyncStats): Promise<void> {
    try {
      const completedAt = new Date().toISOString();

      // Get started_at to calculate duration
      const { data: logData } = await this.supabaseClient
        .from('github_sync_log')
        .select('started_at')
        .eq('id', logId)
        .single();

      const durationMs = logData
        ? Date.now() - new Date(logData.started_at).getTime()
        : null;

      const { error } = await this.supabaseClient
        .from('github_sync_log')
        .update({
          status: 'success',
          completed_at: completedAt,
          duration_ms: durationMs,
          ...stats,
        })
        .eq('id', logId);

      if (error) {
        console.error(`[${this.operation}] Failed to complete sync log:`, error);
      } else {
        console.log(`[${this.operation}] Completed sync log: ${logId} (${durationMs}ms)`);
      }
    } catch (error) {
      console.error(`[${this.operation}] Error completing sync log:`, error);
    }
  }

  /**
   * Mark a sync log as failed with error details
   *
   * @param logId - Sync log ID
   * @param error - Error object
   */
  async failSyncLog(logId: string, error: Error): Promise<void> {
    try {
      const completedAt = new Date().toISOString();

      // Get started_at to calculate duration
      const { data: logData } = await this.supabaseClient
        .from('github_sync_log')
        .select('started_at')
        .eq('id', logId)
        .single();

      const durationMs = logData
        ? Date.now() - new Date(logData.started_at).getTime()
        : null;

      const { error: updateError } = await this.supabaseClient
        .from('github_sync_log')
        .update({
          status: 'failed',
          completed_at: completedAt,
          duration_ms: durationMs,
          error_message: error.message,
          error_details: {
            name: error.name,
            stack: error.stack,
            timestamp: completedAt,
          },
        })
        .eq('id', logId);

      if (updateError) {
        console.error(`[${this.operation}] Failed to mark sync log as failed:`, updateError);
      } else {
        console.log(`[${this.operation}] Marked sync log as failed: ${logId}`);
      }
    } catch (err) {
      console.error(`[${this.operation}] Error marking sync log as failed:`, err);
    }
  }
}
