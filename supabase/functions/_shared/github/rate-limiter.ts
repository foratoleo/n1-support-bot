/**
 * GitHub API Rate Limiter for Supabase Edge Functions
 *
 * Provides rate limit tracking, exponential backoff, and intelligent
 * request throttling for GitHub API interactions.
 *
 * @module github/rate-limiter
 */

import {
  GitHubRateLimitInfo,
  RateLimitState,
} from './types.ts';

// =============================================================================
// Constants
// =============================================================================

/** Minimum backoff delay in milliseconds */
const MIN_BACKOFF_MS = 1000;

/** Maximum backoff delay in milliseconds */
const MAX_BACKOFF_MS = 32000;

/** Backoff multiplier for exponential increase */
const BACKOFF_MULTIPLIER = 2;

/** Buffer time before rate limit reset (in ms) */
const RESET_BUFFER_MS = 1000;

/** Threshold percentage for proactive rate limiting */
const RATE_LIMIT_THRESHOLD = 0.1; // 10% remaining

// =============================================================================
// Rate Limiter Class
// =============================================================================

/**
 * RateLimiter manages GitHub API rate limits with exponential backoff
 *
 * Features:
 * - Tracks rate limit info from response headers
 * - Implements exponential backoff (1s, 2s, 4s, 8s, 16s, 32s max)
 * - Proactively waits when approaching rate limits
 * - Thread-safe state management
 *
 * @example
 * ```typescript
 * const limiter = new RateLimiter();
 *
 * // Check before making request
 * if (limiter.shouldWait()) {
 *   await limiter.wait();
 * }
 *
 * const response = await fetch(url);
 *
 * // Update with response headers
 * limiter.updateFromHeaders(response.headers);
 * ```
 */
export class RateLimiter {
  private state: RateLimitState;
  private consecutiveErrors: number = 0;
  private currentBackoff: number = MIN_BACKOFF_MS;

  constructor() {
    this.state = {
      info: null,
      lastUpdated: 0,
      isLimited: false,
      waitUntil: null,
    };
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Update rate limit state from response headers
   *
   * Extracts and processes X-RateLimit-* headers from GitHub API responses.
   *
   * @param headers - Response headers from GitHub API
   */
  updateFromHeaders(headers: Headers): void {
    const limit = this.parseHeaderInt(headers.get('X-RateLimit-Limit'));
    const remaining = this.parseHeaderInt(headers.get('X-RateLimit-Remaining'));
    const reset = this.parseHeaderInt(headers.get('X-RateLimit-Reset'));
    const used = this.parseHeaderInt(headers.get('X-RateLimit-Used'));
    const resource = headers.get('X-RateLimit-Resource') || 'core';

    if (limit !== null && remaining !== null && reset !== null) {
      this.state.info = {
        limit,
        remaining,
        reset,
        used: used ?? (limit - remaining),
        resource,
      };
      this.state.lastUpdated = Date.now();
      this.state.isLimited = remaining === 0;

      // Calculate wait time if rate limited
      if (remaining === 0) {
        this.state.waitUntil = (reset * 1000) + RESET_BUFFER_MS;
      } else {
        this.state.waitUntil = null;
      }

      // Reset backoff on successful response
      this.resetBackoff();
    }
  }

  /**
   * Check current rate limit status
   *
   * @returns Current rate limit information or null if not available
   */
  checkRateLimit(): GitHubRateLimitInfo | null {
    return this.state.info;
  }

  /**
   * Determine if request should wait before proceeding
   *
   * Returns true if:
   * - Rate limit is exhausted
   * - Approaching rate limit threshold
   * - In backoff period due to errors
   *
   * @returns true if caller should wait before making request
   */
  shouldWait(): boolean {
    // Check if in backoff due to errors
    if (this.state.waitUntil && Date.now() < this.state.waitUntil) {
      return true;
    }

    // Check if rate limited
    if (this.state.isLimited) {
      return true;
    }

    // Check if approaching rate limit
    if (this.state.info) {
      const threshold = Math.floor(this.state.info.limit * RATE_LIMIT_THRESHOLD);
      if (this.state.info.remaining <= threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get time to wait in milliseconds
   *
   * Returns the appropriate wait time based on:
   * - Rate limit reset time (if rate limited)
   * - Exponential backoff (if in error recovery)
   * - Proactive delay (if approaching limit)
   *
   * @returns Wait time in milliseconds, 0 if no wait needed
   */
  getWaitTime(): number {
    const now = Date.now();

    // If we have a specific wait time, use it
    if (this.state.waitUntil && this.state.waitUntil > now) {
      return this.state.waitUntil - now;
    }

    // If rate limited, calculate from reset time
    if (this.state.isLimited && this.state.info?.reset) {
      const resetTime = (this.state.info.reset * 1000) + RESET_BUFFER_MS;
      if (resetTime > now) {
        return resetTime - now;
      }
    }

    // If in backoff due to errors
    if (this.consecutiveErrors > 0) {
      return this.currentBackoff;
    }

    // Proactive delay when approaching limit
    if (this.state.info && this.state.info.remaining > 0) {
      const threshold = Math.floor(this.state.info.limit * RATE_LIMIT_THRESHOLD);
      if (this.state.info.remaining <= threshold) {
        // Calculate remaining time until reset
        const resetTime = this.state.info.reset * 1000;
        const timeUntilReset = resetTime - now;
        if (timeUntilReset > 0 && this.state.info.remaining > 0) {
          // Spread remaining requests over remaining time
          return Math.ceil(timeUntilReset / this.state.info.remaining);
        }
      }
    }

    return 0;
  }

  /**
   * Wait for the appropriate time before making next request
   *
   * @returns Promise that resolves when wait is complete
   */
  async wait(): Promise<void> {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      console.log(`[RateLimiter] Waiting ${waitTime}ms before next request`);
      await this.delay(waitTime);
    }
  }

  /**
   * Record a successful request (resets error state)
   */
  recordSuccess(): void {
    this.resetBackoff();
  }

  /**
   * Record a failed request (increases backoff)
   *
   * @param isRateLimitError - true if error was due to rate limiting
   */
  recordError(isRateLimitError: boolean = false): void {
    this.consecutiveErrors++;

    if (isRateLimitError) {
      // For rate limit errors, use reset time if available
      if (this.state.info?.reset) {
        this.state.waitUntil = (this.state.info.reset * 1000) + RESET_BUFFER_MS;
        this.state.isLimited = true;
      } else {
        // Default to longer wait for rate limits
        this.state.waitUntil = Date.now() + MAX_BACKOFF_MS;
      }
    } else {
      // For other errors, use exponential backoff
      this.currentBackoff = Math.min(
        this.currentBackoff * BACKOFF_MULTIPLIER,
        MAX_BACKOFF_MS
      );
      this.state.waitUntil = Date.now() + this.currentBackoff;
    }
  }

  /**
   * Get current rate limit state for inspection
   *
   * @returns Current rate limit state
   */
  getState(): Readonly<RateLimitState> {
    return { ...this.state };
  }

  /**
   * Get remaining requests before rate limit
   *
   * @returns Number of remaining requests, or null if unknown
   */
  getRemainingRequests(): number | null {
    return this.state.info?.remaining ?? null;
  }

  /**
   * Get time until rate limit resets
   *
   * @returns Milliseconds until reset, or null if not rate limited
   */
  getTimeUntilReset(): number | null {
    if (!this.state.info?.reset) return null;

    const resetTime = this.state.info.reset * 1000;
    const now = Date.now();

    if (resetTime > now) {
      return resetTime - now;
    }

    return 0;
  }

  /**
   * Reset rate limiter state
   *
   * Useful for testing or when starting fresh.
   */
  reset(): void {
    this.state = {
      info: null,
      lastUpdated: 0,
      isLimited: false,
      waitUntil: null,
    };
    this.resetBackoff();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Parse integer from header value
   */
  private parseHeaderInt(value: string | null): number | null {
    if (value === null) return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Reset backoff state
   */
  private resetBackoff(): void {
    this.consecutiveErrors = 0;
    this.currentBackoff = MIN_BACKOFF_MS;
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate exponential backoff delay
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseMs - Base delay in milliseconds (default: 1000)
 * @param maxMs - Maximum delay in milliseconds (default: 32000)
 * @returns Calculated backoff delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseMs: number = MIN_BACKOFF_MS,
  maxMs: number = MAX_BACKOFF_MS
): number {
  const delay = baseMs * Math.pow(BACKOFF_MULTIPLIER, attempt);
  return Math.min(delay, maxMs);
}

/**
 * Create a rate limiter instance with custom configuration
 *
 * @returns Configured RateLimiter instance
 */
export function createRateLimiter(): RateLimiter {
  return new RateLimiter();
}

// =============================================================================
// Default Export
// =============================================================================

export default RateLimiter;
