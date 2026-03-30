/**
 * GitHub API Client Module for Supabase Edge Functions
 *
 * Provides comprehensive GitHub REST API v3 integration with:
 * - TypeScript interfaces for all GitHub entities
 * - Rate limiting with exponential backoff
 * - Pagination helpers and async generators
 * - Full client with authentication and retry logic
 *
 * @module github
 *
 * @example
 * ```typescript
 * import {
 *   GitHubClient,
 *   createGitHubClient,
 *   GitHubPullRequest,
 * } from '../_shared/github/index.ts';
 *
 * const client = createGitHubClient({ token: 'ghp_xxx' });
 * const pr = await client.getPullRequest('owner', 'repo', 123);
 * ```
 */

// =============================================================================
// Types Export
// =============================================================================

export type {
  // User types
  GitHubUser,

  // Label and milestone types
  GitHubLabel,
  GitHubMilestone,

  // Branch and repository types
  GitHubBranchRef,
  GitHubRepository,

  // Pull request types
  PullRequestState,
  GitHubPullRequestMergeState,
  GitHubPullRequest,
  GitHubPullRequestListItem,
  GitHubAutoMerge,

  // Review types
  ReviewState,
  GitHubReview,
  AuthorAssociation,

  // Comment types
  GitHubComment,
  GitHubReviewComment,
  GitHubReactions,

  // Commit types
  GitCommitPerson,
  GitCommit,
  GitHubCommit,

  // Error types
  GitHubApiError,

  // Rate limit types
  GitHubRateLimitInfo,
  RateLimitState,

  // Pagination types
  GitHubPaginationInfo,
  PaginatedResponse,

  // Request options types
  GitHubRequestOptions,
  GitHubListOptions,
  FetchAllPagesOptions,
} from './types.ts';

export { GitHubClientError } from './types.ts';

// =============================================================================
// Rate Limiter Export
// =============================================================================

export {
  RateLimiter,
  calculateBackoff,
  createRateLimiter,
} from './rate-limiter.ts';

// =============================================================================
// Pagination Export
// =============================================================================

export {
  parseLinkHeader,
  hasNextPage,
  getNextPageUrl,
  extractPageNumber,
  fetchAllPages,
  collectAllPages,
  addPerPageToUrl,
  addPageToUrl,
  buildPaginatedUrl,
  createPaginationInfo,
} from './pagination.ts';

// =============================================================================
// Client Export
// =============================================================================

export type { GitHubClientConfig } from './client.ts';

export {
  GitHubClient,
  createGitHubClient,
  createGitHubClientFromEnv,
} from './client.ts';

// =============================================================================
// Database Services Export
// =============================================================================

export type {
  SyncFrequency,
  CreateSyncConfigParams,
  UpdateSyncConfigParams,
  SyncConfigRecord,
} from './sync-config-service.ts';

export { GitHubSyncConfigService } from './sync-config-service.ts';

export type {
  UpsertPullRequestParams,
  PullRequestRecord,
  ReviewRecord,
  CommentRecord,
  CommitRecord,
  SyncLogRecord,
  SyncStats,
  PRFilterOptions,
  UpsertResult,
} from './db-service.ts';

export { GitHubPRDatabaseService } from './db-service.ts';

// =============================================================================
// Default Export
// =============================================================================

export { default } from './client.ts';
