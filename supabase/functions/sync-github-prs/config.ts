/**
 * GitHub PR Synchronization Edge Function Configuration
 *
 * Defines configuration constants, types, and default settings
 * for the GitHub PR synchronization Edge Function.
 *
 * @module sync-github-prs/config
 */

// =============================================================================
// Operation Constants
// =============================================================================

/**
 * Edge Function operation identifier for logging and tracking
 */
export const OPERATION = 'sync-github-prs';

// =============================================================================
// Sync Configuration Defaults
// =============================================================================

/**
 * Default number of pages to fetch per entity type
 */
export const DEFAULT_MAX_PAGES_PER_ENTITY = 5;

/**
 * Default number of items per page (GitHub API max is 100)
 */
export const DEFAULT_ITEMS_PER_PAGE = 100;

/**
 * Maximum number of PRs to process in a single sync
 */
export const MAX_PRS_PER_SYNC = 50;

/**
 * Maximum number of concurrent API requests
 */
export const MAX_CONCURRENT_REQUESTS = 5;

/**
 * Delay between batches of requests (milliseconds)
 */
export const BATCH_DELAY_MS = 1000;

// =============================================================================
// GitHub API Endpoints
// =============================================================================

/**
 * GitHub API base URL
 */
export const GITHUB_API_BASE_URL = 'https://api.github.com';

/**
 * Build GitHub API endpoint for pull requests
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Pull requests API endpoint
 */
export function buildPullRequestsEndpoint(owner: string, repo: string): string {
  return `/repos/${owner}/${repo}/pulls`;
}

/**
 * Build GitHub API endpoint for pull request details
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns Pull request details API endpoint
 */
export function buildPullRequestEndpoint(owner: string, repo: string, prNumber: number): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}`;
}

/**
 * Build GitHub API endpoint for PR reviews
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns PR reviews API endpoint
 */
export function buildReviewsEndpoint(owner: string, repo: string, prNumber: number): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
}

/**
 * Build GitHub API endpoint for PR comments
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue/PR number
 * @returns PR comments API endpoint
 */
export function buildCommentsEndpoint(owner: string, repo: string, issueNumber: number): string {
  return `/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
}

/**
 * Build GitHub API endpoint for PR commits
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - Pull request number
 * @returns PR commits API endpoint
 */
export function buildCommitsEndpoint(owner: string, repo: string, prNumber: number): string {
  return `/repos/${owner}/${repo}/pulls/${prNumber}/commits`;
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Sync request body structure
 */
export interface SyncRequest {
  /**
   * Optional repository ID to sync.
   * If not provided, will sync all due repositories.
   */
  repository_id?: string;

  /**
   * Force full synchronization instead of incremental.
   * Ignores last_synced_at and sync_cursor.
   */
  force_full_sync?: boolean;

  /**
   * Maximum number of PRs to sync (overrides default)
   */
  max_prs?: number;

  /**
   * Maximum pages to fetch per entity type (overrides default)
   */
  max_pages?: number;
}

/**
 * Sync response structure
 */
export interface SyncResponse {
  /**
   * Indicates if the sync operation was successful
   */
  success: boolean;

  /**
   * Summary of the sync operation
   */
  summary: SyncSummary;

  /**
   * Error message if sync failed
   */
  error?: string;
}

/**
 * Summary of sync results
 */
export interface SyncSummary {
  /**
   * Number of repositories synchronized
   */
  repositories_synced: number;

  /**
   * Number of pull requests processed
   */
  pull_requests_synced: number;

  /**
   * Number of reviews processed
   */
  reviews_synced: number;

  /**
   * Number of comments processed
   */
  comments_synced: number;

  /**
   * Number of commits processed
   */
  commits_synced: number;

  /**
   * List of errors encountered during sync
   */
  errors: SyncError[];

  /**
   * Timestamp when sync started
   */
  started_at: string;

  /**
   * Timestamp when sync completed
   */
  completed_at: string;

  /**
   * Duration of sync in milliseconds
   */
  duration_ms: number;

  /**
   * Number of API calls made during sync (Issue 6: tracking)
   */
  api_calls_made?: number;

  /**
   * Rate limit remaining after sync
   */
  rate_limit_remaining?: number | null;
}

/**
 * Sync error details
 */
export interface SyncError {
  /**
   * Repository ID where error occurred
   */
  repository_id?: string;

  /**
   * Pull request number where error occurred
   */
  pr_number?: number;

  /**
   * Error message
   */
  message: string;

  /**
   * Error type/category
   */
  type: 'authentication' | 'rate_limit' | 'not_found' | 'validation' | 'network' | 'database' | 'unknown';

  /**
   * Timestamp when error occurred
   */
  timestamp: string;
}

/**
 * Sync configuration from database
 */
export interface SyncConfig {
  /**
   * Configuration ID
   */
  id: string;

  /**
   * Repository ID
   */
  repository_id: string;

  /**
   * Project ID (from repository)
   */
  project_id: string;

  /**
   * Repository URL (from repository)
   */
  repository_url: string;

  /**
   * Encrypted GitHub token
   */
  github_token_encrypted: string;

  /**
   * Whether sync is enabled
   */
  sync_enabled: boolean;

  /**
   * Last sync timestamp
   */
  last_synced_at: string | null;

  /**
   * Sync cursor for incremental sync
   */
  sync_cursor: SyncCursor | null;
}

/**
 * Sync cursor structure for incremental synchronization
 */
export interface SyncCursor {
  /**
   * Timestamp of last successful sync
   */
  last_sync_timestamp: string;

  /**
   * Last processed PR number
   */
  last_pr_number?: number;

  /**
   * Last processed PR updated_at timestamp
   */
  last_pr_updated_at?: string;
}
