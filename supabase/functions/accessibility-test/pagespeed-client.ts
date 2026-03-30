import { PageSpeedResult, Strategy } from './types.ts';
import { ApiError } from './utils/api-error.ts';
import {
  PAGESPEED_API_BASE_URL,
  PAGESPEED_API_HOST,
  RETRY_ATTEMPTS,
  RETRY_BASE_DELAY,
  TEST_CATEGORY,
} from './config.ts';

/**
 * Client for interacting with PageSpeed Insights API via RapidAPI
 */
export class PageSpeedClient {
  private apiKey: string;

  constructor() {
    const apiKey = Deno.env.get('RAPIDAPI_KEY');
    if (!apiKey) {
      throw new Error(
        'RAPIDAPI_KEY environment variable is not configured. Please set it in Supabase Edge Function secrets.'
      );
    }
    this.apiKey = apiKey;
  }

  /**
   * Runs a PageSpeed Insights accessibility test for the given URL
   * @param url - Target URL to test
   * @param strategy - Testing strategy (STRATEGY_UNSPECIFIED, DESKTOP, or MOBILE)
   * @param locale - Locale for the test (e.g., 'en-US', 'pt-BR')
   * @param timeout - Request timeout in milliseconds
   * @returns PageSpeed Insights result
   */
  async runTest(
    url: string,
    strategy: Strategy,
    locale: string,
    timeout: number = 30000
  ): Promise<PageSpeedResult> {
    // Build API request URL with query parameters
    // NOTE: API requires category=ACCESSIBILITY (uppercase) and strategy in specific format
    const params = new URLSearchParams({
      url: url,
      category: TEST_CATEGORY,
      strategy: strategy,
      locale: locale.toLowerCase(), // API expects lowercase locale like 'pt-br'
    });

    const apiUrl = `${PAGESPEED_API_BASE_URL}?${params.toString()}`;

    console.log('PageSpeed API request:', {
      url: url,
      category: TEST_CATEGORY,
      strategy: strategy,
      locale: locale,
    });

    // Configure request headers
    const headers = {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': PAGESPEED_API_HOST,
      Accept: 'application/json',
    };

    // Execute request with retry logic
    return await this.executeWithRetry(apiUrl, headers, timeout);
  }

  /**
   * Executes API request with exponential backoff retry logic
   */
  private async executeWithRetry(
    url: string,
    headers: Record<string, string>,
    timeout: number
  ): Promise<PageSpeedResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        const result = await this.executeRequest(url, headers, timeout);

        // Success - log and return
        console.log('PageSpeed API request succeeded', {
          attempt,
          url: url.split('?')[0], // Log base URL only
        });

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        console.warn('PageSpeed API request failed', {
          attempt,
          maxAttempts: RETRY_ATTEMPTS,
          isRetryable,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Don't retry if not retryable or if this was the last attempt
        if (!isRetryable || attempt === RETRY_ATTEMPTS) {
          break;
        }

        // Calculate delay with exponential backoff: 1s, 2s, 4s
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    // All retries failed
    if (lastError instanceof ApiError) {
      throw lastError;
    }

    throw new ApiError(
      `PageSpeed API request failed after ${RETRY_ATTEMPTS} attempts: ${
        lastError?.message || 'Unknown error'
      }`,
      500,
      false
    );
  }

  /**
   * Executes a single API request with timeout handling
   */
  private async executeRequest(
    url: string,
    headers: Record<string, string>,
    timeout: number
  ): Promise<PageSpeedResult> {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      // Handle HTTP error responses
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // Parse JSON response
      const data = await response.json();

      // Validate response structure
      this.validateResponse(data);

      return data as PageSpeedResult;
    } catch (error) {
      // Handle fetch errors
      if (error instanceof ApiError) {
        throw error;
      }

      if ((error as Error).name === 'AbortError') {
        throw new ApiError(
          `PageSpeed API request timeout after ${timeout}ms`,
          504,
          true
        );
      }

      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        true
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Handles HTTP error responses from the API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `API request failed with status ${response.status}`;
    let responseBody: any = null;

    try {
      responseBody = await response.json();
      if (responseBody.error) {
        errorMessage = responseBody.error;
      } else if (responseBody.message) {
        errorMessage = responseBody.message;
      }
    } catch {
      // Response body is not JSON, use default error message
    }

    // Determine if error is retryable based on status code
    const isRetryable = response.status >= 500 || response.status === 429;

    // Handle specific status codes
    switch (response.status) {
      case 400:
        throw new ApiError(
          `Invalid request: ${errorMessage}`,
          400,
          false,
          responseBody
        );
      case 403:
        throw new ApiError(
          'Invalid API key or unauthorized access',
          403,
          false,
          responseBody
        );
      case 429:
        throw new ApiError(
          'Rate limit exceeded. Please try again later.',
          429,
          true,
          responseBody
        );
      case 504:
        throw new ApiError(
          'PageSpeed Insights service timeout',
          504,
          true,
          responseBody
        );
      default:
        throw new ApiError(errorMessage, response.status, isRetryable, responseBody);
    }
  }

  /**
   * Validates that the API response has the expected structure
   */
  private validateResponse(data: any): void {
    if (!data) {
      throw new ApiError('Empty response from PageSpeed API', 500, false);
    }

    if (!data.status || data.status !== 'success') {
      throw new ApiError(
        `API returned non-success status: ${data.status || 'unknown'}`,
        500,
        false
      );
    }

    if (!data.lighthouseResult) {
      throw new ApiError(
        'Invalid response structure: missing lighthouseResult',
        500,
        false
      );
    }

    if (!data.lighthouseResult.categories?.accessibility) {
      throw new ApiError(
        'Invalid response structure: missing accessibility category',
        500,
        false
      );
    }

    if (!data.id) {
      throw new ApiError('Invalid response structure: missing id', 500, false);
    }
  }

  /**
   * Determines if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof ApiError) {
      return error.isRetryable;
    }

    // Network errors are generally retryable
    if (error instanceof Error) {
      return (
        error.name === 'AbortError' ||
        error.message.includes('network') ||
        error.message.includes('timeout')
      );
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
