/**
 * GitHub API Client for Supabase Edge Functions
 *
 * Provides a robust client for interacting with GitHub REST API v3
 * with rate limiting, pagination, retry logic, and comprehensive error handling.
 *
 * @module github/client
 */

import {
  GitHubPullRequest,
  GitHubPullRequestListItem,
  GitHubReview,
  GitHubComment,
  GitHubReviewComment,
  GitHubCommit,
  GitHubClientError,
  GitHubApiError,
  GitHubRequestOptions,
  GitHubListOptions,
  FetchAllPagesOptions,
  PaginatedResponse,
  GitHubRateLimitInfo,
} from './types.ts';

import { RateLimiter, calculateBackoff } from './rate-limiter.ts';
import {
  parseLinkHeader,
  fetchAllPages,
  collectAllPages,
  buildPaginatedUrl,
} from './pagination.ts';

// =============================================================================
// Constants
// =============================================================================

/** Default GitHub API base URL */
const DEFAULT_BASE_URL = 'https://api.github.com';

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30000;

/** Default number of retries for failed requests */
const DEFAULT_RETRIES = 3;

/** Default results per page */
const DEFAULT_PER_PAGE = 100;

/** GitHub API version header */
const GITHUB_API_VERSION = '2022-11-28';

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * GitHub client configuration
 */
export interface GitHubClientConfig {
  /** Personal access token for authentication */
  token: string;
  /** Base URL for GitHub API (default: https://api.github.com) */
  baseUrl?: string;
  /** Default request timeout in ms */
  timeout?: number;
  /** Default number of retries */
  retries?: number;
  /** User agent string */
  userAgent?: string;
}

// =============================================================================
// GitHub Client Class
// =============================================================================

/**
 * GitHubClient provides methods for interacting with GitHub REST API
 *
 * Features:
 * - Token-based authentication
 * - Automatic rate limit handling
 * - Pagination support with async generators
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 *
 * @example
 * ```typescript
 * const client = new GitHubClient({
 *   token: 'ghp_xxxx',
 * });
 *
 * // Get single PR
 * const pr = await client.getPullRequest('owner', 'repo', 123);
 *
 * // Get all PRs with pagination
 * const prs = await client.getPullRequests('owner', 'repo', { state: 'all' });
 * ```
 */
export class GitHubClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly userAgent: string;
  private readonly rateLimiter: RateLimiter;

  constructor(config: GitHubClientConfig) {
    this.token = config.token;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT_MS;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.userAgent = config.userAgent ?? 'DR-AI-Workforce-GitHubClient';
    this.rateLimiter = new RateLimiter();
  }

  // ===========================================================================
  // Pull Request Methods
  // ===========================================================================

  /**
   * Get a list of pull requests for a repository
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - List options (state, sort, direction, pagination)
   * @returns Paginated response with pull requests
   *
   * @example
   * ```typescript
   * const prs = await client.getPullRequests('owner', 'repo', {
   *   state: 'open',
   *   sort: 'updated',
   *   direction: 'desc',
   * });
   * ```
   */
  async getPullRequests(
    owner: string,
    repo: string,
    options: GitHubListOptions = {}
  ): Promise<PaginatedResponse<GitHubPullRequestListItem>> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls`;

    const params: Record<string, string | number | boolean | undefined> = {
      state: options.state ?? 'open',
      sort: options.sort ?? 'updated',
      direction: options.direction ?? 'desc',
      per_page: options.per_page ?? DEFAULT_PER_PAGE,
      page: options.page ?? 1,
    };

    const response = await this.request<GitHubPullRequestListItem[]>(url, {
      params,
    });

    const pagination = parseLinkHeader(response.headers.get('Link'));

    return {
      data: response.data,
      pagination,
    };
  }

  /**
   * Get all pull requests using async iteration
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param options - List options
   * @param fetchOptions - Pagination options
   * @yields Pull requests from all pages
   */
  async *getAllPullRequests(
    owner: string,
    repo: string,
    options: GitHubListOptions = {},
    fetchOptions: FetchAllPagesOptions = {}
  ): AsyncGenerator<GitHubPullRequestListItem, void, undefined> {
    const url = buildPaginatedUrl(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls`,
      {
        state: options.state ?? 'open',
        sort: options.sort ?? 'updated',
        direction: options.direction ?? 'desc',
      }
    );

    const fetchFn = async (pageUrl: string) => {
      const response = await this.request<GitHubPullRequestListItem[]>(pageUrl);
      return {
        data: response.data,
        response: response.raw,
      };
    };

    yield* fetchAllPages(url, fetchFn, fetchOptions);
  }

  /**
   * Get a single pull request by number
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @returns Pull request details
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubPullRequest> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}`;
    const response = await this.request<GitHubPullRequest>(url);
    return response.data;
  }

  // ===========================================================================
  // Review Methods
  // ===========================================================================

  /**
   * Get reviews for a pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @param options - Pagination options
   * @returns Paginated response with reviews
   */
  async getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
    options: GitHubListOptions = {}
  ): Promise<PaginatedResponse<GitHubReview>> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`;

    const params = {
      per_page: options.per_page ?? DEFAULT_PER_PAGE,
      page: options.page ?? 1,
    };

    const response = await this.request<GitHubReview[]>(url, { params });
    const pagination = parseLinkHeader(response.headers.get('Link'));

    return {
      data: response.data,
      pagination,
    };
  }

  /**
   * Get all reviews for a pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @param fetchOptions - Pagination options
   * @returns Array of all reviews
   */
  async getAllPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number,
    fetchOptions: FetchAllPagesOptions = {}
  ): Promise<GitHubReview[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`;

    const fetchFn = async (pageUrl: string) => {
      const response = await this.request<GitHubReview[]>(pageUrl);
      return {
        data: response.data,
        response: response.raw,
      };
    };

    return collectAllPages(url, fetchFn, fetchOptions);
  }

  // ===========================================================================
  // Comment Methods
  // ===========================================================================

  /**
   * Get issue/PR comments (top-level comments)
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue/PR number
   * @param options - Pagination options
   * @returns Paginated response with comments
   */
  async getPullRequestComments(
    owner: string,
    repo: string,
    issueNumber: number,
    options: GitHubListOptions = {}
  ): Promise<PaginatedResponse<GitHubComment>> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;

    const params = {
      per_page: options.per_page ?? DEFAULT_PER_PAGE,
      page: options.page ?? 1,
    };

    const response = await this.request<GitHubComment[]>(url, { params });
    const pagination = parseLinkHeader(response.headers.get('Link'));

    return {
      data: response.data,
      pagination,
    };
  }

  /**
   * Get all issue/PR comments
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param issueNumber - Issue/PR number
   * @param fetchOptions - Pagination options
   * @returns Array of all comments
   */
  async getAllPullRequestComments(
    owner: string,
    repo: string,
    issueNumber: number,
    fetchOptions: FetchAllPagesOptions = {}
  ): Promise<GitHubComment[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`;

    const fetchFn = async (pageUrl: string) => {
      const response = await this.request<GitHubComment[]>(pageUrl);
      return {
        data: response.data,
        response: response.raw,
      };
    };

    return collectAllPages(url, fetchFn, fetchOptions);
  }

  /**
   * Get review comments (inline code comments)
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @param options - Pagination options
   * @returns Paginated response with review comments
   */
  async getReviewComments(
    owner: string,
    repo: string,
    pullNumber: number,
    options: GitHubListOptions = {}
  ): Promise<PaginatedResponse<GitHubReviewComment>> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;

    const params = {
      per_page: options.per_page ?? DEFAULT_PER_PAGE,
      page: options.page ?? 1,
      sort: options.sort ?? 'created',
      direction: options.direction ?? 'desc',
    };

    const response = await this.request<GitHubReviewComment[]>(url, { params });
    const pagination = parseLinkHeader(response.headers.get('Link'));

    return {
      data: response.data,
      pagination,
    };
  }

  /**
   * Get all review comments for a PR
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @param fetchOptions - Pagination options
   * @returns Array of all review comments
   */
  async getAllReviewComments(
    owner: string,
    repo: string,
    pullNumber: number,
    fetchOptions: FetchAllPagesOptions = {}
  ): Promise<GitHubReviewComment[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;

    const fetchFn = async (pageUrl: string) => {
      const response = await this.request<GitHubReviewComment[]>(pageUrl);
      return {
        data: response.data,
        response: response.raw,
      };
    };

    return collectAllPages(url, fetchFn, fetchOptions);
  }

  // ===========================================================================
  // Commit Methods
  // ===========================================================================

  /**
   * Get commits for a pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @param options - Pagination options
   * @returns Paginated response with commits
   */
  async getPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
    options: GitHubListOptions = {}
  ): Promise<PaginatedResponse<GitHubCommit>> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/commits`;

    const params = {
      per_page: options.per_page ?? DEFAULT_PER_PAGE,
      page: options.page ?? 1,
    };

    const response = await this.request<GitHubCommit[]>(url, { params });
    const pagination = parseLinkHeader(response.headers.get('Link'));

    return {
      data: response.data,
      pagination,
    };
  }

  /**
   * Get all commits for a pull request
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pullNumber - Pull request number
   * @param fetchOptions - Pagination options
   * @returns Array of all commits
   */
  async getAllPullRequestCommits(
    owner: string,
    repo: string,
    pullNumber: number,
    fetchOptions: FetchAllPagesOptions = {}
  ): Promise<GitHubCommit[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${pullNumber}/commits`;

    const fetchFn = async (pageUrl: string) => {
      const response = await this.request<GitHubCommit[]>(pageUrl);
      return {
        data: response.data,
        response: response.raw,
      };
    };

    return collectAllPages(url, fetchFn, fetchOptions);
  }

  /**
   * Get a single commit with full details including stats
   *
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param commitSha - Commit SHA
   * @returns Commit details with stats (additions, deletions, total)
   */
  async getCommit(
    owner: string,
    repo: string,
    commitSha: string
  ): Promise<GitHubCommit> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/commits/${commitSha}`;
    const response = await this.request<GitHubCommit>(url);
    return response.data;
  }

  // ===========================================================================
  // Rate Limit Methods
  // ===========================================================================

  /**
   * Get current rate limit status
   *
   * @returns Rate limit information or null
   */
  getRateLimitInfo(): GitHubRateLimitInfo | null {
    return this.rateLimiter.checkRateLimit();
  }

  /**
   * Get explicit rate limit status from API
   *
   * @returns Rate limit information from GitHub API
   */
  async fetchRateLimitStatus(): Promise<{
    resources: {
      core: GitHubRateLimitInfo;
      search: GitHubRateLimitInfo;
      graphql: GitHubRateLimitInfo;
    };
    rate: GitHubRateLimitInfo;
  }> {
    const url = `${this.baseUrl}/rate_limit`;
    const response = await this.request<{
      resources: {
        core: GitHubRateLimitInfo;
        search: GitHubRateLimitInfo;
        graphql: GitHubRateLimitInfo;
      };
      rate: GitHubRateLimitInfo;
    }>(url, { skipRateLimit: true });

    return response.data;
  }

  // ===========================================================================
  // Core Request Method
  // ===========================================================================

  /**
   * Make an authenticated request to GitHub API
   *
   * @param url - Full URL or path
   * @param options - Request options
   * @returns Response data and raw response
   */
  async request<T>(
    url: string,
    options: GitHubRequestOptions = {}
  ): Promise<{ data: T; headers: Headers; raw: Response }> {
    const {
      method = 'GET',
      body,
      headers: customHeaders = {},
      params,
      timeout = this.timeout,
      retries = this.retries,
      skipRateLimit = false,
    } = options;

    // Build URL with params
    let fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
    if (params) {
      fullUrl = buildPaginatedUrl(fullUrl, params);
    }

    // Check rate limit before request
    if (!skipRateLimit && this.rateLimiter.shouldWait()) {
      console.log('[GitHubClient] Rate limit check - waiting');
      await this.rateLimiter.wait();
    }

    // Build headers
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': this.userAgent,
      ...customHeaders,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    // Execute with retry logic
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        console.log(`[GitHubClient] ${method} ${fullUrl} (attempt ${attempt + 1}/${retries + 1})`);

        const response = await fetch(fullUrl, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Update rate limiter from response headers
        this.rateLimiter.updateFromHeaders(response.headers);

        // Handle response
        if (response.ok) {
          this.rateLimiter.recordSuccess();
          const data = await response.json() as T;
          return { data, headers: response.headers, raw: response };
        }

        // Handle error responses
        const errorBody = await this.parseErrorResponse(response);
        const error = new GitHubClientError(
          `GitHub API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody,
          { url: fullUrl, method, body },
          { status: response.status, body: errorBody }
        );

        // Handle rate limit errors
        if (error.isRateLimitError() || response.status === 429) {
          this.rateLimiter.recordError(true);

          if (attempt < retries) {
            const waitTime = this.rateLimiter.getWaitTime();
            console.log(`[GitHubClient] Rate limited, waiting ${waitTime}ms`);
            await this.delay(waitTime);
            continue;
          }
        }

        // Handle retryable errors
        if (error.isRetryable() && attempt < retries) {
          this.rateLimiter.recordError(false);
          const backoff = calculateBackoff(attempt);
          console.log(`[GitHubClient] Retryable error, waiting ${backoff}ms`);
          await this.delay(backoff);
          continue;
        }

        throw error;
      } catch (error) {
        if (error instanceof GitHubClientError) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // Handle timeout/network errors
        if (attempt < retries) {
          this.rateLimiter.recordError(false);
          const backoff = calculateBackoff(attempt);
          console.log(`[GitHubClient] Network error, retrying in ${backoff}ms: ${lastError.message}`);
          await this.delay(backoff);
          continue;
        }
      }
    }

    // All retries exhausted
    throw new GitHubClientError(
      `Request failed after ${retries + 1} attempts: ${lastError?.message}`,
      undefined,
      undefined,
      { url: fullUrl, method, body }
    );
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Parse error response body
   */
  private async parseErrorResponse(response: Response): Promise<GitHubApiError> {
    try {
      const body = await response.json();
      return body as GitHubApiError;
    } catch {
      return {
        message: response.statusText,
        status: response.status,
      };
    }
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a GitHub client from environment configuration
 *
 * @returns Configured GitHubClient instance
 * @throws Error if GITHUB_TOKEN is not set
 */
export function createGitHubClientFromEnv(): GitHubClient {
  const token = Deno.env.get('GITHUB_TOKEN');

  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required');
  }

  const baseUrl = Deno.env.get('GITHUB_API_URL') || DEFAULT_BASE_URL;

  return new GitHubClient({
    token,
    baseUrl,
  });
}

/**
 * Create a GitHub client with explicit configuration
 *
 * @param config - Client configuration
 * @returns Configured GitHubClient instance
 */
export function createGitHubClient(config: GitHubClientConfig): GitHubClient {
  return new GitHubClient(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default GitHubClient;
