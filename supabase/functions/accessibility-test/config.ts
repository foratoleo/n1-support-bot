/**
 * Configuration constants for Accessibility Test Edge Function
 */

// Document storage configuration
export const DOCUMENT_TYPE = 'accessibility-test-result';
export const IS_CURRENT_VERSION = false;

// Timeout configuration (milliseconds)
export const DEFAULT_TIMEOUT = 30000;
export const MAX_TIMEOUT = 60000;
export const MIN_TIMEOUT = 5000;

// Retry configuration
export const RETRY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY = 1000;

// PageSpeed Insights configuration
// NOTE: This Edge Function focuses exclusively on ACCESSIBILITY testing
export const TEST_CATEGORY = 'ACCESSIBILITY';

export const DEFAULT_LOCALE = 'en-US';
export const DEFAULT_STRATEGY = 'DESKTOP';
export const ALLOWED_STRATEGIES = ['STRATEGY_UNSPECIFIED', 'DESKTOP', 'MOBILE'] as const;

// API configuration
export const PAGESPEED_API_BASE_URL =
  'https://pagespeed-insights.p.rapidapi.com/run_pagespeed';
export const PAGESPEED_API_HOST = 'pagespeed-insights.p.rapidapi.com';

// AI interaction tracking
export const INTERACTION_TYPE = 'accessibility_test';
export const REQUEST_MODEL = 'pagespeed-insights-api';

// Function execution timeout (55s, just under Supabase 60s limit)
export const FUNCTION_TIMEOUT = 55000;
