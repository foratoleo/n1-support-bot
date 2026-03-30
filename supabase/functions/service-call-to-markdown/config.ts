/**
 * Configuration constants for Service Call to Markdown Edge Function
 */

// Function timeout (55 seconds to stay under Supabase 60s limit)
export const FUNCTION_TIMEOUT = 55000;

// Score thresholds
export const CRITICAL_SCORE_THRESHOLD = 0;
export const WARNING_SCORE_THRESHOLD = 0.9;
export const GOOD_SCORE_THRESHOLD = 0.9;

// WCAG Levels
export const WCAG_LEVEL_AAA_THRESHOLD = 0.95;
export const WCAG_LEVEL_AA_THRESHOLD = 0.80;
export const WCAG_LEVEL_A_THRESHOLD = 0.60;

// Impact levels
export enum ImpactLevel {
  CRITICAL = 'critical',
  SERIOUS = 'serious',
  MODERATE = 'moderate',
  MINOR = 'minor',
}

// Audit categories for accessibility tests
export const AUDIT_CATEGORIES = {
  ARIA: ['aria-', 'role'],
  NAMES_LABELS: ['name', 'label', 'alt', 'title'],
  COLOR_CONTRAST: ['color-contrast'],
  NAVIGATION: ['tabindex', 'bypass', 'skip', 'focus', 'heading'],
  STRUCTURE: ['list', 'table', 'definition', 'landmark'],
  FORMS: ['label', 'select', 'input', 'button'],
  LANGUAGE: ['lang', 'xml-lang'],
  MULTIMEDIA: ['video', 'audio', 'caption', 'image'],
  BEST_PRACTICES: ['meta-', 'document-', 'html-'],
};

// Service formatters mapping
export const SUPPORTED_SERVICES: Record<string, { category: string; name: string }> = {
  'quality:pagespeed': { category: 'quality', name: 'pagespeed' },
  // Future services can be added here
  // 'performance:lighthouse': { category: 'performance', name: 'lighthouse' },
  // 'seo:pagespeed': { category: 'seo', name: 'pagespeed' },
};
