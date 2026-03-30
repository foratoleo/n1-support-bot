/**
 * TypeScript types for External Service Calls tracking system
 *
 * This module provides comprehensive type definitions for tracking
 * external API calls and responses across all services.
 */

/**
 * Service names for known external services
 */
export type ServiceName =
  | 'aws-s3'
  | 'cloudinary'
  | 'elevenlabs'
  | 'github'
  | 'microsoft_graph'
  | 'openai'
  | 'pagespeed'
  | 'recall'
  | 'sendgrid'
  | 'stripe'
  | 'twilio'
  | 'other';

/**
 * Service categories for classification
 */
export type ServiceCategory =
  | 'quality'        // Quality testing services (PageSpeed, etc.)
  | 'ai'            // AI/ML services (OpenAI, etc.)
  | 'integration'   // Third-party integrations (GitHub, JIRA, etc.)
  | 'audio'         // Audio processing (ElevenLabs, etc.)
  | 'payment'       // Payment processing (Stripe, etc.)
  | 'communication' // Email, SMS (SendGrid, Twilio, etc.)
  | 'storage'       // File storage (S3, Cloudinary, etc.)
  | 'performance'   // Performance testing services (PageSpeed, etc.)
  | 'accessibility' // Accessibility testing services (Accessibility Insights, etc.)
  | 'security'      // Security testing services (OWASP, etc.)
  | 'compliance'    // Compliance testing services (PCI DSS, GDPR, etc.)
  | 'usability'     // Usability testing services (UserTesting, etc.)
  | 'localization'  // Localization testing services (Localization Toolkit, etc.)
  | 'internationalization' // Internationalization testing services (Internationalization Toolkit, etc.)
  | 'other';

/**
 * HTTP methods for API calls
 */
export type RequestMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS';

/**
 * Status of the service call
 */
export type ServiceCallStatus =
  | 'pending'      // Call initiated but not started
  | 'in_progress'  // Call in progress
  | 'completed'    // Call completed successfully
  | 'failed'       // Call failed with error
  | 'timeout';     // Call exceeded timeout

/**
 * Operation types for different service calls
 */
export type OperationType =
  | 'test'         // Testing/validation operation
  | 'generate'     // Content generation
  | 'validate'     // Data validation
  | 'sync'         // Data synchronization
  | 'upload'       // File upload
  | 'download'     // File download
  | 'process'      // Data processing
  | 'query'        // Data query
  | 'other';

/**
 * Request data for creating a service call record
 */
export interface CreateServiceCallRequest {
  projectId: string;
  serviceName: ServiceName;
  serviceCategory: ServiceCategory;
  endpointPath: string;
  operationType?: OperationType;
  requestMethod: RequestMethod;
  requestUrl: string;
  requestHeaders?: Record<string, string>;
  requestBody?: Record<string, any>;
  requestParameters?: Record<string, any>;
  aiInteractionId?: string;
}

/**
 * Data for updating a service call with response
 */
export interface UpdateServiceCallResponse {
  status: ServiceCallStatus;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: Record<string, any>;
  responseMetadata?: Record<string, any>;
  completedAt?: string;
  durationMs?: number;
  costUsd?: number;
  tokensUsed?: number;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  retryCount?: number;
}

/**
 * Complete external service call record
 */
export interface ExternalServiceCall {
  // Identity
  id: string;
  projectId: string;

  // Service classification
  serviceName: ServiceName;
  serviceCategory: ServiceCategory;
  endpointPath: string;
  operationType?: OperationType;

  // Request details
  requestMethod: RequestMethod;
  requestUrl: string;
  requestHeaders?: Record<string, string>;
  requestBody?: Record<string, any>;
  requestParameters?: Record<string, any>;

  // Response details
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: Record<string, any>;
  responseMetadata?: Record<string, any>;

  // Performance & cost tracking
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  costUsd?: number;
  tokensUsed?: number;

  // Status & error tracking
  status: ServiceCallStatus;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  retryCount: number;

  // Relationships & context
  aiInteractionId?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/**
 * Filters for querying service calls
 */
export interface ServiceCallFilters {
  projectId?: string;
  serviceName?: ServiceName | ServiceName[];
  serviceCategory?: ServiceCategory | ServiceCategory[];
  status?: ServiceCallStatus | ServiceCallStatus[];
  operationType?: OperationType;
  dateFrom?: string;
  dateTo?: string;
  aiInteractionId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Aggregated metrics for service calls
 */
export interface ServiceCallMetrics {
  serviceName: ServiceName;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  averageDurationMs: number;
  totalCostUsd: number;
  totalTokensUsed?: number;
  averageTokensPerCall?: number;
}

/**
 * Error tracking for service calls
 */
export interface ServiceCallError {
  callId: string;
  serviceName: ServiceName;
  errorMessage: string;
  errorDetails?: Record<string, any>;
  retryCount: number;
  timestamp: string;
}

/**
 * Performance tracking for service calls
 */
export interface ServiceCallPerformance {
  serviceName: ServiceName;
  endpointPath: string;
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;
  callCount: number;
}

/**
 * Cost analysis for service calls
 */
export interface ServiceCallCostAnalysis {
  serviceName: ServiceName;
  totalCostUsd: number;
  averageCostPerCall: number;
  callCount: number;
  tokensUsed?: number;
  costPerToken?: number;
  period: {
    from: string;
    to: string;
  };
}

/**
 * Service health status
 */
export interface ServiceHealthStatus {
  serviceName: ServiceName;
  isHealthy: boolean;
  recentSuccessRate: number;
  recentAverageDuration: number;
  recentErrorCount: number;
  lastSuccessfulCall?: string;
  lastFailedCall?: string;
  statusMessage: string;
}

/**
 * Database row type (snake_case for database compatibility)
 */
export interface ExternalServiceCallRow {
  id: string;
  project_id: string;
  service_name: string;
  service_category: string;
  endpoint_path: string;
  operation_type?: string;
  request_method: string;
  request_url: string;
  request_headers?: any;
  request_body?: any;
  request_parameters?: any;
  response_status?: number;
  response_headers?: any;
  response_body?: any;
  response_metadata?: any;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  cost_usd?: string;
  tokens_used?: number;
  status: string;
  error_message?: string;
  error_details?: any;
  retry_count: number;
  ai_interaction_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

/**
 * Helper function to convert database row to ExternalServiceCall
 */
export function rowToServiceCall(row: ExternalServiceCallRow): ExternalServiceCall {
  return {
    id: row.id,
    projectId: row.project_id,
    serviceName: row.service_name as ServiceName,
    serviceCategory: row.service_category as ServiceCategory,
    endpointPath: row.endpoint_path,
    operationType: row.operation_type as OperationType | undefined,
    requestMethod: row.request_method as RequestMethod,
    requestUrl: row.request_url,
    requestHeaders: row.request_headers,
    requestBody: row.request_body,
    requestParameters: row.request_parameters,
    responseStatus: row.response_status,
    responseHeaders: row.response_headers,
    responseBody: row.response_body,
    responseMetadata: row.response_metadata,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms,
    costUsd: row.cost_usd ? parseFloat(row.cost_usd) : undefined,
    tokensUsed: row.tokens_used,
    status: row.status as ServiceCallStatus,
    errorMessage: row.error_message,
    errorDetails: row.error_details,
    retryCount: row.retry_count,
    aiInteractionId: row.ai_interaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

/**
 * Helper function to convert CreateServiceCallRequest to database insert
 */
export function requestToDbInsert(request: CreateServiceCallRequest): Partial<ExternalServiceCallRow> {
  return {
    project_id: request.projectId,
    service_name: request.serviceName,
    service_category: request.serviceCategory,
    endpoint_path: request.endpointPath,
    operation_type: request.operationType,
    request_method: request.requestMethod,
    request_url: request.requestUrl,
    request_headers: request.requestHeaders || {},
    request_body: request.requestBody,
    request_parameters: request.requestParameters || {},
    status: 'pending',
    retry_count: 0,
    ai_interaction_id: request.aiInteractionId,
    started_at: new Date().toISOString(),
  };
}

/**
 * Helper function to convert UpdateServiceCallResponse to database update
 */
export function updateToDbUpdate(update: UpdateServiceCallResponse): Partial<ExternalServiceCallRow> {
  const dbUpdate: Partial<ExternalServiceCallRow> = {
    status: update.status,
  };

  if (update.responseStatus !== undefined) {
    dbUpdate.response_status = update.responseStatus;
  }

  if (update.responseHeaders !== undefined) {
    dbUpdate.response_headers = update.responseHeaders;
  }

  if (update.responseBody !== undefined) {
    dbUpdate.response_body = update.responseBody;
  }

  if (update.responseMetadata !== undefined) {
    dbUpdate.response_metadata = update.responseMetadata;
  }

  if (update.completedAt !== undefined) {
    dbUpdate.completed_at = update.completedAt;
  }

  if (update.durationMs !== undefined) {
    dbUpdate.duration_ms = update.durationMs;
  }

  if (update.costUsd !== undefined) {
    dbUpdate.cost_usd = update.costUsd.toString();
  }

  if (update.tokensUsed !== undefined) {
    dbUpdate.tokens_used = update.tokensUsed;
  }

  if (update.errorMessage !== undefined) {
    dbUpdate.error_message = update.errorMessage;
  }

  if (update.errorDetails !== undefined) {
    dbUpdate.error_details = update.errorDetails;
  }

  if (update.retryCount !== undefined) {
    dbUpdate.retry_count = update.retryCount;
  }

  return dbUpdate;
}
