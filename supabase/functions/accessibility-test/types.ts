/**
 * Type definitions for Accessibility Test Edge Function
 */

export type Strategy = 'STRATEGY_UNSPECIFIED' | 'DESKTOP' | 'MOBILE';

export interface AccessibilityTestRequest {
  projectId: string;
  targetUrl: string;
  strategy: Strategy;
  locale?: string;
  timeout?: number;
}

export interface AccessibilityTestResponse {
  success: boolean;
  documentId?: string;
  result?: PageSpeedResult;
  error?: string;
}

export interface PageSpeedResult {
  status: string;
  captchaResult: string;
  kind: string;
  id: string;
  loadingExperience?: {
    initial_url: string;
  };
  lighthouseResult: LighthouseResult;
}

export interface LighthouseResult {
  requestedUrl: string;
  finalUrl: string;
  mainDocumentUrl?: string;
  finalDisplayedUrl?: string;
  lighthouseVersion: string;
  userAgent: string;
  fetchTime: string;
  environment: {
    networkUserAgent: string;
    hostUserAgent: string;
    benchmarkIndex: number;
    credits?: Record<string, string>;
  };
  runWarnings?: string[];
  configSettings: {
    emulatedFormFactor: string;
    formFactor: string;
    locale: string;
    onlyCategories: string[];
    channel?: string;
  };
  audits: Record<string, Audit>;
  categories: {
    accessibility: Category;
  };
  categoryGroups?: Record<string, any>;
  timing?: {
    total: number;
  };
}

export interface Audit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  details?: any;
  warnings?: string[];
}

export interface Category {
  id: string;
  title: string;
  description: string;
  score: number;
  manualDescription: string;
  auditRefs: Array<{
    id: string;
    weight: number;
    group?: string;
  }>;
}

export interface ValidationResults {
  accessibility_score: number | null;
  total_audits: number;
  passed_audits: number;
  failed_audits: number;
  wcag_violations?: Array<{
    id: string;
    title: string;
    description: string;
    impact: string;
  }>;
}
