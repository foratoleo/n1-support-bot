/**
 * Comment Repository
 *
 * Handles database operations for GitHub PR comments.
 *
 * @module sync-github-prs/repositories/comment-repository
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GitHubComment } from '../../_shared/github/types.ts';
import { OPERATION } from '../config.ts';

/**
 * Repository for comment database operations
 */
export class CommentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Upsert comments for a pull request
   *
   * @param pullRequestId - Internal PR UUID
   * @param comments - Comments from GitHub
   */
  async upsertMany(pullRequestId: string, comments: GitHubComment[]): Promise<void> {
    if (comments.length === 0) return;

    for (const comment of comments) {
      await this.upsertOne(pullRequestId, comment);
    }
  }

  /**
   * Upsert a single comment
   *
   * @param pullRequestId - Internal PR UUID
   * @param comment - Comment from GitHub
   */
  private async upsertOne(pullRequestId: string, comment: GitHubComment): Promise<void> {
    // Check if comment already exists
    const { data: existing } = await this.supabase
      .from('github_pr_comments')
      .select('id')
      .eq('pull_request_id', pullRequestId)
      .eq('github_comment_id', comment.id)
      .single();

    // Determine comment type based on presence of review-specific fields
    const isReviewComment = 'path' in comment || 'diff_hunk' in comment;

    const commentData = {
      pull_request_id: pullRequestId,
      github_comment_id: comment.id,
      comment_type: isReviewComment ? 'review_comment' : 'issue_comment',
      author_login: comment.user.login,
      author_id: comment.user.id,
      author_avatar_url: comment.user.avatar_url,
      body: comment.body,
      in_reply_to_id: (comment as Record<string, unknown>).in_reply_to_id as number | null ?? null,
      path: (comment as Record<string, unknown>).path as string | null ?? null,
      position: (comment as Record<string, unknown>).position as number | null ?? null,
      diff_hunk: (comment as Record<string, unknown>).diff_hunk as string | null ?? null,
      commit_id: (comment as Record<string, unknown>).commit_id as string | null ?? null,
      created_at_github: comment.created_at,
      updated_at_github: comment.updated_at,
      html_url: comment.html_url,
      metadata: {},
    };

    if (existing) {
      const { error } = await this.supabase
        .from('github_pr_comments')
        .update(commentData)
        .eq('id', existing.id);

      if (error) {
        console.error(`[${OPERATION}] Failed to update comment ${comment.id}:`, error);
      }
    } else {
      const { error } = await this.supabase
        .from('github_pr_comments')
        .insert(commentData);

      if (error) {
        console.error(`[${OPERATION}] Failed to insert comment ${comment.id}:`, error);
      }
    }
  }
}
