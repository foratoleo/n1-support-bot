/**
 * GitHub API Types for Supabase Edge Functions
 *
 * Provides comprehensive TypeScript interfaces for GitHub REST API v3 interactions,
 * including pull requests, reviews, comments, commits, and rate limiting.
 *
 * @module github/types
 */

// =============================================================================
// User Types
// =============================================================================

/**
 * GitHub user representation (simplified)
 */
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  type: 'User' | 'Bot' | 'Organization';
  site_admin?: boolean;
}

// =============================================================================
// Label Types
// =============================================================================

/**
 * GitHub issue/PR label
 */
export interface GitHubLabel {
  id: number;
  name: string;
  description: string | null;
  color: string;
  default: boolean;
}

// =============================================================================
// Milestone Types
// =============================================================================

/**
 * GitHub milestone
 */
export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  creator: GitHubUser;
  html_url: string;
}

// =============================================================================
// Branch Types
// =============================================================================

/**
 * GitHub branch reference (for PRs)
 */
export interface GitHubBranchRef {
  label: string;
  ref: string;
  sha: string;
  user: GitHubUser;
  repo: GitHubRepository;
}

/**
 * Simplified repository info (used in branch refs)
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  default_branch: string;
}

// =============================================================================
// Pull Request Types
// =============================================================================

/**
 * Pull request state
 */
export type PullRequestState = 'open' | 'closed';

/**
 * Pull request merge state
 */
export interface GitHubPullRequestMergeState {
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: 'clean' | 'dirty' | 'blocked' | 'unknown' | 'unstable';
  merged_by: GitHubUser | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
}

/**
 * GitHub Pull Request - complete representation
 */
export interface GitHubPullRequest {
  // Identity
  id: number;
  number: number;
  node_id: string;

  // Content
  title: string;
  body: string | null;
  state: PullRequestState;

  // URLs
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  comments_url: string;
  statuses_url: string;

  // Users
  user: GitHubUser;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];

  // Branches
  head: GitHubBranchRef;
  base: GitHubBranchRef;

  // Metadata
  labels: GitHubLabel[];
  milestone: GitHubMilestone | null;
  locked: boolean;
  active_lock_reason: string | null;
  draft: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  closed_at: string | null;

  // Merge state (may be null in list endpoints)
  merged?: boolean;
  mergeable?: boolean | null;
  mergeable_state?: string;
  merged_by?: GitHubUser | null;
  merged_at?: string | null;
  merge_commit_sha?: string | null;
  rebaseable?: boolean | null;

  // Statistics
  commits?: number;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  comments?: number;
  review_comments?: number;

  // Auto-merge
  auto_merge: GitHubAutoMerge | null;
}

/**
 * Auto-merge configuration
 */
export interface GitHubAutoMerge {
  enabled_by: GitHubUser;
  merge_method: 'merge' | 'squash' | 'rebase';
  commit_title: string | null;
  commit_message: string | null;
}

/**
 * Pull request list item (simplified for list endpoints)
 */
export interface GitHubPullRequestListItem {
  id: number;
  number: number;
  title: string;
  state: PullRequestState;
  user: GitHubUser;
  head: GitHubBranchRef;
  base: GitHubBranchRef;
  labels: GitHubLabel[];
  draft: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  html_url: string;
}

// =============================================================================
// Review Types
// =============================================================================

/**
 * Review state
 */
export type ReviewState =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'DISMISSED'
  | 'PENDING';

/**
 * GitHub Pull Request Review
 */
export interface GitHubReview {
  id: number;
  node_id: string;
  user: GitHubUser;
  body: string | null;
  state: ReviewState;
  html_url: string;
  pull_request_url: string;
  commit_id: string;
  submitted_at: string;
  author_association: AuthorAssociation;
}

/**
 * Author association with repository
 */
export type AuthorAssociation =
  | 'COLLABORATOR'
  | 'CONTRIBUTOR'
  | 'FIRST_TIMER'
  | 'FIRST_TIME_CONTRIBUTOR'
  | 'MANNEQUIN'
  | 'MEMBER'
  | 'NONE'
  | 'OWNER';

// =============================================================================
// Comment Types
// =============================================================================

/**
 * GitHub Issue/PR Comment (top-level comment)
 */
export interface GitHubComment {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  issue_url: string;
  author_association: AuthorAssociation;
  performed_via_github_app: boolean | null;
  reactions?: GitHubReactions;
}

/**
 * GitHub Review Comment (inline comment on code)
 */
export interface GitHubReviewComment {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  pull_request_review_id: number | null;
  diff_hunk: string;
  path: string;
  position: number | null;
  original_position: number | null;
  commit_id: string;
  original_commit_id: string;
  in_reply_to_id?: number;
  user: GitHubUser;
  body: string;
  created_at: string;
  updated_at: string;
  author_association: AuthorAssociation;
  start_line: number | null;
  original_start_line: number | null;
  start_side: 'LEFT' | 'RIGHT' | null;
  line: number | null;
  original_line: number | null;
  side: 'LEFT' | 'RIGHT';
  subject_type?: 'line' | 'file';
  reactions?: GitHubReactions;
}

/**
 * GitHub reactions on comments/reviews
 */
export interface GitHubReactions {
  url: string;
  total_count: number;
  '+1': number;
  '-1': number;
  laugh: number;
  hooray: number;
  confused: number;
  heart: number;
  rocket: number;
  eyes: number;
}

// =============================================================================
// Commit Types
// =============================================================================

/**
 * Git commit author/committer
 */
export interface GitCommitPerson {
  name: string;
  email: string;
  date: string;
}

/**
 * Git commit details
 */
export interface GitCommit {
  sha: string;
  message: string;
  author: GitCommitPerson;
  committer: GitCommitPerson;
  tree: {
    sha: string;
    url: string;
  };
  url: string;
  comment_count: number;
  verification?: {
    verified: boolean;
    reason: string;
    signature: string | null;
    payload: string | null;
  };
}

/**
 * GitHub commit statistics (additions, deletions, total)
 * Only available when fetching individual commit details
 */
export interface GitHubCommitStats {
  additions: number;
  deletions: number;
  total: number;
}

/**
 * GitHub Commit (PR commit)
 */
export interface GitHubCommit {
  sha: string;
  node_id: string;
  commit: GitCommit;
  url: string;
  html_url: string;
  comments_url: string;
  author: GitHubUser | null;
  committer: GitHubUser | null;
  parents: Array<{
    sha: string;
    url: string;
    html_url: string;
  }>;
  /** Stats are only available when fetching individual commit details */
  stats?: GitHubCommitStats;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * GitHub API error response
 */
export interface GitHubApiError {
  message: string;
  documentation_url?: string;
  errors?: Array<{
    resource: string;
    field: string;
    code: string;
    message?: string;
  }>;
  status?: number;
}

/**
 * Custom error class for GitHub API errors
 */
export class GitHubClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly apiError?: GitHubApiError,
    public readonly apiRequest?: { url: string; method: string; body?: unknown },
    public readonly apiResponse?: { status: number; body?: unknown }
  ) {
    super(message);
    this.name = 'GitHubClientError';
  }

  /**
   * Check if error is due to rate limiting
   */
  isRateLimitError(): boolean {
    return this.statusCode === 403 && (
      this.apiError?.message?.includes('rate limit') ||
      this.apiError?.message?.includes('API rate limit')
    );
  }

  /**
   * Check if error is due to authentication
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    if (!this.statusCode) return true; // Network errors are retryable
    if (this.statusCode >= 500) return true; // Server errors
    if (this.statusCode === 429) return true; // Too many requests
    if (this.isRateLimitError()) return true;
    return false;
  }

  /**
   * Format error for logging
   */
  toLogFormat(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status_code: this.statusCode,
      api_error: this.apiError,
      request: this.apiRequest,
      stack: this.stack,
    };
  }
}

// =============================================================================
// Rate Limit Types
// =============================================================================

/**
 * GitHub rate limit information from response headers
 */
export interface GitHubRateLimitInfo {
  /** Maximum number of requests allowed */
  limit: number;
  /** Number of requests remaining */
  remaining: number;
  /** Unix timestamp when the rate limit resets */
  reset: number;
  /** Number of requests used in current window */
  used: number;
  /** Resource type (core, search, etc.) */
  resource: string;
}

/**
 * Rate limit state for tracking
 */
export interface RateLimitState {
  info: GitHubRateLimitInfo | null;
  lastUpdated: number;
  isLimited: boolean;
  waitUntil: number | null;
}

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * GitHub pagination information from Link header
 */
export interface GitHubPaginationInfo {
  /** URL for first page */
  first?: string;
  /** URL for previous page */
  prev?: string;
  /** URL for next page */
  next?: string;
  /** URL for last page */
  last?: string;
  /** Current page number (extracted from URL) */
  currentPage?: number;
  /** Total pages (extracted from last URL) */
  totalPages?: number;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: GitHubPaginationInfo;
  totalCount?: number;
}

// =============================================================================
// Request Options Types
// =============================================================================

/**
 * Options for GitHub API requests
 */
export interface GitHubRequestOptions {
  /** Request method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Request body */
  body?: unknown;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retries for failed requests */
  retries?: number;
  /** Skip rate limit checking */
  skipRateLimit?: boolean;
}

/**
 * Options for list endpoints with pagination
 */
export interface GitHubListOptions {
  /** Number of results per page (max 100) */
  per_page?: number;
  /** Page number to fetch */
  page?: number;
  /** Sort field */
  sort?: string;
  /** Sort direction */
  direction?: 'asc' | 'desc';
  /** State filter for PRs/issues */
  state?: 'open' | 'closed' | 'all';
}

/**
 * Options for fetching all pages
 */
export interface FetchAllPagesOptions {
  /** Maximum pages to fetch (default: 10) */
  maxPages?: number;
  /** Results per page (default: 100) */
  perPage?: number;
  /** Delay between requests in ms */
  delayBetweenRequests?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}
