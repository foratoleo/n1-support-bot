/**
 * Review Repository
 *
 * Handles database operations for GitHub PR reviews.
 *
 * @module sync-github-prs/repositories/review-repository
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GitHubReview } from '../../_shared/github/types.ts';
import { OPERATION } from '../config.ts';

/**
 * Repository for review database operations
 */
export class ReviewRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Upsert reviews for a pull request
   *
   * @param pullRequestId - Internal PR UUID
   * @param reviews - Reviews from GitHub
   */
  async upsertMany(pullRequestId: string, reviews: GitHubReview[]): Promise<void> {
    if (reviews.length === 0) return;

    for (const review of reviews) {
      await this.upsertOne(pullRequestId, review);
    }
  }

  /**
   * Upsert a single review
   *
   * @param pullRequestId - Internal PR UUID
   * @param review - Review from GitHub
   */
  private async upsertOne(pullRequestId: string, review: GitHubReview): Promise<void> {
    // Check if review already exists
    const { data: existing } = await this.supabase
      .from('github_pr_reviews')
      .select('id')
      .eq('pull_request_id', pullRequestId)
      .eq('github_review_id', review.id)
      .single();

    const reviewData = {
      pull_request_id: pullRequestId,
      github_review_id: review.id,
      reviewer_login: review.user.login,
      reviewer_id: review.user.id,
      reviewer_avatar_url: review.user.avatar_url,
      state: review.state,
      body: review.body,
      submitted_at: review.submitted_at,
      commit_id: review.commit_id,
      html_url: review.html_url,
      metadata: {},
    };

    if (existing) {
      const { error } = await this.supabase
        .from('github_pr_reviews')
        .update(reviewData)
        .eq('id', existing.id);

      if (error) {
        console.error(`[${OPERATION}] Failed to update review ${review.id}:`, error);
      }
    } else {
      const { error } = await this.supabase
        .from('github_pr_reviews')
        .insert(reviewData);

      if (error) {
        console.error(`[${OPERATION}] Failed to insert review ${review.id}:`, error);
      }
    }
  }
}
