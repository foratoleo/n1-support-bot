/**
 * GitHub API Pagination Utilities for Supabase Edge Functions
 *
 * Provides pagination parsing and async generators for fetching
 * all pages of GitHub API responses.
 *
 * @module github/pagination
 */

import {
  GitHubPaginationInfo,
  FetchAllPagesOptions,
  GitHubRequestOptions,
} from './types.ts';

// =============================================================================
// Constants
// =============================================================================

/** Default number of results per page */
const DEFAULT_PER_PAGE = 100;

/** Maximum pages to fetch by default */
const DEFAULT_MAX_PAGES = 10;

/** Default delay between paginated requests (ms) */
const DEFAULT_DELAY_MS = 0;

// =============================================================================
// Link Header Parsing
// =============================================================================

/**
 * Parse GitHub Link header into pagination info
 *
 * The Link header format:
 * <url>; rel="next", <url>; rel="last", <url>; rel="first", <url>; rel="prev"
 *
 * @param header - Link header value from response
 * @returns Parsed pagination information
 *
 * @example
 * ```typescript
 * const pagination = parseLinkHeader(response.headers.get('Link'));
 * if (pagination.next) {
 *   // Fetch next page
 * }
 * ```
 */
export function parseLinkHeader(header: string | null): GitHubPaginationInfo {
  const pagination: GitHubPaginationInfo = {};

  if (!header) {
    return pagination;
  }

  // Split by comma and process each link
  const links = header.split(',');

  for (const link of links) {
    // Match URL and rel
    const urlMatch = link.match(/<([^>]+)>/);
    const relMatch = link.match(/rel="([^"]+)"/);

    if (urlMatch && relMatch) {
      const url = urlMatch[1];
      const rel = relMatch[1] as 'first' | 'prev' | 'next' | 'last';

      switch (rel) {
        case 'first':
          pagination.first = url;
          break;
        case 'prev':
          pagination.prev = url;
          break;
        case 'next':
          pagination.next = url;
          break;
        case 'last':
          pagination.last = url;
          // Extract total pages from last URL
          const lastPageMatch = url.match(/[?&]page=(\d+)/);
          if (lastPageMatch) {
            pagination.totalPages = parseInt(lastPageMatch[1], 10);
          }
          break;
      }
    }
  }

  // Extract current page from URLs if possible
  const currentPageUrl = pagination.prev || pagination.first;
  if (currentPageUrl) {
    const pageMatch = currentPageUrl.match(/[?&]page=(\d+)/);
    if (pageMatch) {
      const prevPage = parseInt(pageMatch[1], 10);
      pagination.currentPage = pagination.prev ? prevPage + 1 : 1;
    }
  } else if (pagination.next) {
    // If we have next but no prev, we're on page 1
    pagination.currentPage = 1;
  }

  return pagination;
}

/**
 * Check if there are more pages available
 *
 * @param pagination - Pagination info from parseLinkHeader
 * @returns true if there is a next page
 */
export function hasNextPage(pagination: GitHubPaginationInfo): boolean {
  return !!pagination.next;
}

/**
 * Get next page URL from pagination info
 *
 * @param pagination - Pagination info from parseLinkHeader
 * @returns Next page URL or null
 */
export function getNextPageUrl(pagination: GitHubPaginationInfo): string | null {
  return pagination.next ?? null;
}

/**
 * Extract page number from URL
 *
 * @param url - URL containing page parameter
 * @returns Page number or null
 */
export function extractPageNumber(url: string): number | null {
  const match = url.match(/[?&]page=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// =============================================================================
// Total Count Extraction
// =============================================================================

/**
 * Extract total count from response headers or body
 *
 * Some GitHub endpoints return total_count in the response body (search),
 * while others only indicate through pagination.
 *
 * @param response - Fetch response
 * @param pagination - Parsed pagination info
 * @param perPage - Items per page
 * @returns Estimated total count or null
 */
export async function extractTotalCount(
  response: Response,
  pagination: GitHubPaginationInfo,
  perPage: number = DEFAULT_PER_PAGE
): Promise<number | null> {
  // If we have total pages, estimate total count
  if (pagination.totalPages) {
    // This is an estimate - last page may have fewer items
    return pagination.totalPages * perPage;
  }

  return null;
}

// =============================================================================
// Async Generator for All Pages
// =============================================================================

/**
 * Fetch function type for pagination
 */
type FetchFunction<T> = (url: string, options?: GitHubRequestOptions) => Promise<{
  data: T[];
  response: Response;
}>;

/**
 * Async generator to fetch all pages of paginated results
 *
 * Yields items from each page until all pages are fetched or limit is reached.
 * Handles rate limiting and provides abort capability.
 *
 * @param initialUrl - Starting URL for pagination
 * @param fetchFn - Function to fetch a single page
 * @param options - Pagination options
 *
 * @yields Items from each page
 *
 * @example
 * ```typescript
 * const fetchPage = async (url: string) => {
 *   const response = await client.request(url);
 *   return { data: response.data, response: response.raw };
 * };
 *
 * for await (const pr of fetchAllPages<GitHubPullRequest>(url, fetchPage)) {
 *   console.log(pr.title);
 * }
 * ```
 */
export async function* fetchAllPages<T>(
  initialUrl: string,
  fetchFn: FetchFunction<T>,
  options: FetchAllPagesOptions = {}
): AsyncGenerator<T, void, undefined> {
  const {
    maxPages = DEFAULT_MAX_PAGES,
    perPage = DEFAULT_PER_PAGE,
    delayBetweenRequests = DEFAULT_DELAY_MS,
    signal,
  } = options;

  let currentUrl: string | null = addPerPageToUrl(initialUrl, perPage);
  let pageCount = 0;

  while (currentUrl && pageCount < maxPages) {
    // Check for abort signal
    if (signal?.aborted) {
      console.log('[Pagination] Aborted by signal');
      return;
    }

    // Add delay between requests (except first)
    if (pageCount > 0 && delayBetweenRequests > 0) {
      await delay(delayBetweenRequests);
    }

    try {
      const { data, response } = await fetchFn(currentUrl);

      // Yield each item from the page
      for (const item of data) {
        if (signal?.aborted) {
          console.log('[Pagination] Aborted during yield');
          return;
        }
        yield item;
      }

      // Parse pagination and get next URL
      const linkHeader = response.headers.get('Link');
      const pagination = parseLinkHeader(linkHeader);

      currentUrl = pagination.next ?? null;
      pageCount++;

      // Log progress
      console.log(
        `[Pagination] Fetched page ${pageCount}/${pagination.totalPages || '?'}, ` +
        `items: ${data.length}`
      );

      // Break if no items returned (empty page)
      if (data.length === 0) {
        console.log('[Pagination] Empty page received, stopping');
        break;
      }
    } catch (error) {
      console.error(`[Pagination] Error fetching page ${pageCount + 1}:`, error);
      throw error;
    }
  }

  if (pageCount >= maxPages) {
    console.log(`[Pagination] Reached max pages limit (${maxPages})`);
  }
}

/**
 * Collect all pages into an array
 *
 * Convenience function that collects all items from the async generator
 * into a single array.
 *
 * @param initialUrl - Starting URL for pagination
 * @param fetchFn - Function to fetch a single page
 * @param options - Pagination options
 * @returns Array of all items from all pages
 *
 * @example
 * ```typescript
 * const allPRs = await collectAllPages<GitHubPullRequest>(url, fetchPage);
 * console.log(`Total PRs: ${allPRs.length}`);
 * ```
 */
export async function collectAllPages<T>(
  initialUrl: string,
  fetchFn: FetchFunction<T>,
  options: FetchAllPagesOptions = {}
): Promise<T[]> {
  const items: T[] = [];

  for await (const item of fetchAllPages(initialUrl, fetchFn, options)) {
    items.push(item);
  }

  return items;
}

// =============================================================================
// URL Helpers
// =============================================================================

/**
 * Add or update per_page parameter in URL
 *
 * @param url - Base URL
 * @param perPage - Items per page
 * @returns URL with per_page parameter
 */
export function addPerPageToUrl(url: string, perPage: number): string {
  const urlObj = new URL(url);
  urlObj.searchParams.set('per_page', String(perPage));
  return urlObj.toString();
}

/**
 * Add or update page parameter in URL
 *
 * @param url - Base URL
 * @param page - Page number
 * @returns URL with page parameter
 */
export function addPageToUrl(url: string, page: number): string {
  const urlObj = new URL(url);
  urlObj.searchParams.set('page', String(page));
  return urlObj.toString();
}

/**
 * Build paginated URL with query parameters
 *
 * @param baseUrl - Base API URL
 * @param params - Query parameters
 * @returns Complete URL with parameters
 */
export function buildPaginatedUrl(
  baseUrl: string,
  params: Record<string, string | number | boolean | undefined> = {}
): string {
  const urlObj = new URL(baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      urlObj.searchParams.set(key, String(value));
    }
  }

  return urlObj.toString();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Delay execution for specified milliseconds
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create pagination info from manual values
 *
 * @param currentPage - Current page number
 * @param totalPages - Total number of pages
 * @param baseUrl - Base URL for generating page links
 * @returns Pagination info object
 */
export function createPaginationInfo(
  currentPage: number,
  totalPages: number,
  baseUrl: string
): GitHubPaginationInfo {
  const pagination: GitHubPaginationInfo = {
    currentPage,
    totalPages,
  };

  if (currentPage > 1) {
    pagination.first = addPageToUrl(baseUrl, 1);
    pagination.prev = addPageToUrl(baseUrl, currentPage - 1);
  }

  if (currentPage < totalPages) {
    pagination.next = addPageToUrl(baseUrl, currentPage + 1);
    pagination.last = addPageToUrl(baseUrl, totalPages);
  }

  return pagination;
}
