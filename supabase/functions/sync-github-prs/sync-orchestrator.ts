/**
 * GitHub PR Sync Orchestrator
 *
 * Orchestrates the synchronization workflow for GitHub pull requests,
 * reviews, comments, and commits with support for incremental sync
 * and parallel processing.
 *
 * Following Single Responsibility Principle, this class only handles
 * orchestration logic. All database operations are delegated to
 * dedicated repository classes.
 *
 * @module sync-github-prs/sync-orchestrator
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { GitHubClient } from '../_shared/github/client.ts';
import { parseGitHubUrl } from '../_shared/github/url-parser.ts';
import { GitHubPullRequestListItem } from '../_shared/github/types.ts';
import {
  SyncConfig,
  SyncSummary,
  SyncError,
  SyncCursor,
  DEFAULT_MAX_PAGES_PER_ENTITY,
  DEFAULT_ITEMS_PER_PAGE,
  MAX_PRS_PER_SYNC,
  MAX_CONCURRENT_REQUESTS,
  BATCH_DELAY_MS,
  OPERATION,
} from './config.ts';
import {
  SyncConfigRepository,
  PullRequestRepository,
  ReviewRepository,
  CommentRepository,
  CommitRepository,
  SyncLogRepository,
} from './repositories/index.ts';

// =============================================================================
// Sync Orchestrator Class
// =============================================================================

/**
 * Orchestrates the GitHub PR synchronization workflow
 *
 * Responsibilities:
 * - Coordinate sync workflow steps
 * - Manage parallel processing of PRs
 * - Track API call statistics
 * - Handle errors and build summary
 *
 * Database operations are delegated to repository classes.
 */
export class SyncOrchestrator {
  private readonly supabase: SupabaseClient;
  private readonly maxPages: number;
  private readonly maxPrs: number;
  private apiCallCount: number = 0;
  private rateLimitRemaining: number | null = null;

  // Repositories (Single Responsibility)
  private readonly configRepo: SyncConfigRepository;
  private readonly prRepo: PullRequestRepository;
  private readonly reviewRepo: ReviewRepository;
  private readonly commentRepo: CommentRepository;
  private readonly commitRepo: CommitRepository;
  private readonly logRepo: SyncLogRepository;

  constructor(
    supabase: SupabaseClient,
    options: {
      maxPages?: number;
      maxPrs?: number;
    } = {}
  ) {
    this.supabase = supabase;
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES_PER_ENTITY;
    this.maxPrs = options.maxPrs ?? MAX_PRS_PER_SYNC;

    // Initialize repositories
    this.configRepo = new SyncConfigRepository(supabase);
    this.prRepo = new PullRequestRepository(supabase);
    this.reviewRepo = new ReviewRepository(supabase);
    this.commentRepo = new CommentRepository(supabase);
    this.commitRepo = new CommitRepository(supabase);
    this.logRepo = new SyncLogRepository(supabase);
  }

  /**
   * Track API call and update rate limit info
   */
  private trackApiCall<T>(result: T, rateLimitRemaining?: number): T {
    this.apiCallCount++;
    if (rateLimitRemaining !== undefined) {
      this.rateLimitRemaining = rateLimitRemaining;
    }
    return result;
  }

  /**
   * Reset API call tracking for a new sync operation
   */
  private resetApiTracking(): void {
    this.apiCallCount = 0;
    this.rateLimitRemaining = null;
  }

  /**
   * Get current API call statistics
   */
  getApiStats(): { apiCallCount: number; rateLimitRemaining: number | null } {
    return {
      apiCallCount: this.apiCallCount,
      rateLimitRemaining: this.rateLimitRemaining,
    };
  }

  /**
   * Synchronize a single repository
   *
   * @param repoId - Repository ID to sync
   * @param fullSync - Whether to perform full sync or incremental
   * @returns Sync summary with results
   */
  async syncRepository(repoId: string, fullSync = false): Promise<SyncSummary> {
    const startTime = Date.now();
    this.resetApiTracking();

    const summary: SyncSummary = {
      repositories_synced: 0,
      pull_requests_synced: 0,
      reviews_synced: 0,
      comments_synced: 0,
      commits_synced: 0,
      errors: [],
      started_at: new Date().toISOString(),
      completed_at: '',
      duration_ms: 0,
      api_calls_made: 0,
      rate_limit_remaining: null,
    };

    let config: SyncConfig | null = null;

    try {
      console.log(`[${OPERATION}] Starting sync for repository: ${repoId}`);

      // 1. Get sync configuration
      config = await this.configRepo.getConfig(repoId);
      if (!config) {
        throw new Error(`Sync configuration not found for repository: ${repoId}`);
      }

      if (!config.sync_enabled) {
        console.log(`[${OPERATION}] Sync disabled for repository: ${repoId}`);
        return summary;
      }

      // 2. Parse repository URL
      const parsed = parseGitHubUrl(config.repository_url);
      if (!parsed) {
        throw new Error(`Invalid GitHub URL: ${config.repository_url}`);
      }

      // 3. Create GitHub client
      const githubClient = new GitHubClient({
        token: config.github_token_encrypted, // TODO: Decrypt token
      });

      // 4. Fetch pull requests with incremental sync support
      const prs = await this.fetchPullRequests(
        githubClient,
        parsed.owner,
        parsed.repo,
        fullSync ? null : config.sync_cursor
      );

      console.log(`[${OPERATION}] Fetched ${prs.length} pull requests`);

      if (prs.length === 0) {
        console.log(`[${OPERATION}] No pull requests to sync`);
        summary.repositories_synced = 1;
        return summary;
      }

      // 5. Process each PR with parallel fetching of related data
      await this.processPullRequestBatches(
        githubClient,
        config,
        parsed.owner,
        parsed.repo,
        prs,
        summary
      );

      // Update API stats in summary
      const apiStats = this.getApiStats();
      summary.api_calls_made = apiStats.apiCallCount;
      summary.rate_limit_remaining = apiStats.rateLimitRemaining;

      // 6. Update sync cursor with latest timestamp
      await this.configRepo.updateCursor(
        config.id,
        prs[0], // Most recently updated PR
        new Date().toISOString()
      );

      summary.repositories_synced = 1;
      console.log(`[${OPERATION}] Sync completed for repository: ${repoId}`);

      // Refresh materialized views after successful sync (fallback for trigger)
      try {
        await this.supabase.rpc('refresh_all_pr_views');
        console.log(`[${OPERATION}] PR materialized views refreshed successfully`);
      } catch (refreshErr) {
        console.warn(`[${OPERATION}] Failed to refresh PR views via RPC:`, refreshErr);
      }

      // Fire-and-forget: trigger code review metrics refresh after successful sync
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (supabaseUrl && serviceKey) {
          fetch(`${supabaseUrl}/functions/v1/sync-code-review-metrics`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ project_id: config.project_id }),
          }).catch((err) =>
            console.warn(
              `[${OPERATION}] Code review metrics refresh callback failed:`,
              err.message
            )
          );
          console.log(`[${OPERATION}] Code review metrics refresh triggered (fire-and-forget)`);
        }
      } catch (callbackErr) {
        console.warn(`[${OPERATION}] Failed to trigger metrics refresh:`, callbackErr);
      }
    } catch (error) {
      const syncError: SyncError = {
        repository_id: repoId,
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'unknown',
        timestamp: new Date().toISOString(),
      };
      summary.errors.push(syncError);
      console.error(`[${OPERATION}] Sync failed for repository ${repoId}:`, error);
    } finally {
      summary.completed_at = new Date().toISOString();
      summary.duration_ms = Date.now() - startTime;

      // Log sync completion after timestamps are set
      if (config) {
        try {
          await this.logRepo.logCompletion(
            config.repository_id,
            summary,
            fullSync ? 'full_sync' : 'incremental_sync'
          );
        } catch (logError) {
          console.error(`[${OPERATION}] Failed to log sync completion:`, logError);
        }
      }
    }

    return summary;
  }

  // ===========================================================================
  // Private Methods - Orchestration Logic
  // ===========================================================================

  /**
   * Fetch pull requests with optional incremental sync
   */
  private async fetchPullRequests(
    client: GitHubClient,
    owner: string,
    repo: string,
    cursor: SyncCursor | null
  ): Promise<GitHubPullRequestListItem[]> {
    const prs: GitHubPullRequestListItem[] = [];

    const state = 'all';
    const options = {
      state,
      sort: 'updated' as const,
      direction: 'desc' as const,
      per_page: DEFAULT_ITEMS_PER_PAGE,
    };

    let page = 1;
    let hasMore = true;

    while (hasMore && page <= this.maxPages && prs.length < this.maxPrs) {
      const response = await client.getPullRequests(owner, repo, {
        ...options,
        page,
      });

      if (response.data.length === 0) {
        hasMore = false;
        break;
      }

      // Filter by cursor if incremental sync
      const filteredPRs = cursor
        ? response.data.filter((pr) => {
            const prUpdatedAt = new Date(pr.updated_at).getTime();
            const cursorTime = new Date(cursor.last_sync_timestamp).getTime();
            return prUpdatedAt > cursorTime;
          })
        : response.data;

      prs.push(...filteredPRs);

      hasMore = response.pagination.next !== undefined && prs.length < this.maxPrs;
      page++;
    }

    return prs.slice(0, this.maxPrs);
  }

  /**
   * Process pull requests in batches with parallel execution
   */
  private async processPullRequestBatches(
    client: GitHubClient,
    config: SyncConfig,
    owner: string,
    repo: string,
    prs: GitHubPullRequestListItem[],
    summary: SyncSummary
  ): Promise<void> {
    const batchSize = Math.min(MAX_CONCURRENT_REQUESTS, prs.length);

    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((pr) =>
          this.processPullRequest(client, config, owner, repo, pr)
        )
      );

      // Collect results from batch
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          summary.pull_requests_synced++;
          summary.reviews_synced += result.value.reviews;
          summary.comments_synced += result.value.comments;
          summary.commits_synced += result.value.commits;
        } else {
          summary.errors.push({
            repository_id: config.repository_id,
            message: result.reason?.message || 'Unknown error',
            type: 'unknown',
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < prs.length) {
        await this.delay(BATCH_DELAY_MS);
      }
    }
  }

  /**
   * Process a single pull request and fetch all related data
   */
  private async processPullRequest(
    client: GitHubClient,
    config: SyncConfig,
    owner: string,
    repo: string,
    pr: GitHubPullRequestListItem
  ): Promise<{
    reviews: number;
    comments: number;
    commits: number;
  }> {
    console.log(`[${OPERATION}] Processing PR #${pr.number}: ${pr.title}`);

    // Fetch full PR details and related data in parallel
    const [prDetails, reviews, comments, commits] = await Promise.all([
      client.getPullRequest(owner, repo, pr.number),
      client.getAllPullRequestReviews(owner, repo, pr.number, {
        maxPages: this.maxPages,
      }),
      client.getAllPullRequestComments(owner, repo, pr.number, {
        maxPages: this.maxPages,
      }),
      client.getAllPullRequestCommits(owner, repo, pr.number, {
        maxPages: this.maxPages,
      }),
    ]);

    // Upsert PR data
    await this.prRepo.upsert(config, prDetails);

    // Get internal PR ID for related data
    const prInternalId = await this.prRepo.getInternalId(config.repository_id, pr.number);
    if (!prInternalId) {
      throw new Error(`PR #${pr.number} not found in database after upsert`);
    }

    // Upsert reviews, comments, and commits in parallel
    await Promise.all([
      this.reviewRepo.upsertMany(prInternalId, reviews),
      this.commentRepo.upsertMany(prInternalId, comments),
      this.commitRepo.upsertMany(client, prInternalId, owner, repo, commits),
    ]);

    return {
      reviews: reviews.length,
      comments: comments.length,
      commits: commits.length,
    };
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
