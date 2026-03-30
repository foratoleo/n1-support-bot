/**
 * Type definitions for Performance Test Edge Function
 */

export type Strategy = 'STRATEGY_UNSPECIFIED' | 'DESKTOP' | 'MOBILE';

export interface PerformanceTestRequest {
  projectId: string;
  targetUrl: string;
  strategy: Strategy;
  locale?: string;
  timeout?: number;
}

export interface PerformanceTestResponse {
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
    metrics?: Record<string, any>;
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
    performance: Category;
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
  numericValue?: number;
  numericUnit?: string;
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

export interface CoreWebVital {
  id: string;
  title: string;
  description: string;
  score: number;
  numericValue: number;
  displayValue: string;
  numericUnit: string;
}

export interface FormattedPerformanceResult {
  score: number;
  categories: {
    performance: {
      score: number;
      title: string;
      auditRefs: Array<{
        id: string;
        weight: number;
        group?: string;
      }>;
    };
  };
  metrics: {
    lcp?: CoreWebVital;
    fid?: CoreWebVital;
    cls?: CoreWebVital;
    fcp?: CoreWebVital;
    si?: CoreWebVital;
    tbt?: CoreWebVital;
    tti?: CoreWebVital;
  };
  audits: Record<string, Audit>;
  resourceSummary?: any;
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    score: number;
    numericValue: number;
    overallSavingsMs?: number;
  }>;
  fetchTime: string;
  requestedUrl: string;
  finalUrl: string;
  warnings?: string[];
  timestamp: string;
}
