/**
 * Type definitions for Service Call to Markdown Edge Function
 */

export interface ServiceCallToMarkdownRequest {
  id: string;
  serviceName?: string;
  serviceCategory?: string;
  resultType?: ServiceType;
}

export type ServiceType = 'accessibility' | 'performance';

export interface ServiceCallToMarkdownResponse {
  success: boolean;
  markdown?: string;
  metadata?: ServiceCallMetadata;
  error?: string;
  code?: string;
}

export interface ServiceCallMetadata {
  id: string;
  serviceName: string;
  serviceCategory: string;
  generatedAt: string;
  requestUrl?: string;
  timestamp?: string;
}

export interface ExternalServiceCall {
  id: string;
  project_id: string;
  service_name: string;
  service_category: string;
  endpoint_path: string;
  operation_type: string;
  request_method: string;
  request_url: string;
  request_headers: Record<string, any>;
  request_parameters: Record<string, any>;
  response_body: Record<string, any>;
  response_status: number;
  execution_time_ms: number;
  created_at: string;
}

// Accessibility Test Types
export interface AccessibilityAudit {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  details?: {
    type: string;
    items: any[];
    headings?: any[];
    debugData?: {
      type: string;
      impact: string;
      tags?: string[];
    };
  };
}

export interface AccessibilityResult {
  score: number;
  audits: Record<string, AccessibilityAudit>;
  finalUrl: string;
  fetchTime: string;
  timestamp: string;
  categories?: {
    accessibility?: {
      score: number;
      title: string;
    };
  };
}

// Formatter Interface
export interface MarkdownFormatter {
  format(responseBody: any, metadata: ServiceCallMetadata): string;
}
