/**
 * Type definitions for JIRA Sync Tasks Edge Function
 *
 * @module jira-sync-tasks/types
 */

export type SyncOperation = 'sync-to-jira' | 'sync-from-jira' | 'bulk-sync' | 'batch-sync' | 'cancel-operation' | 'get-progress';
export type ConflictResolution = 'last-write-wins' | 'jira-wins' | 'dr-wins';

/**
 * Filters for task selection in sync operations
 */
export interface TaskFilters {
  /** Task workflow status filter (e.g., ['in_progress', 'blocked']) */
  status?: string[];
  /** JIRA sync status filter (e.g., ['pending', 'synced']) */
  syncStatus?: string[];
  /** Filter by JIRA linkage presence */
  hasJiraIssue?: boolean;
  /**
   * ISO 8601 timestamp for temporal filtering (e.g., '2025-12-10T12:00:00Z').
   * Tasks updated on or after this timestamp will be included.
   */
  updatedSince?: string;
  /** Statuses to exclude from sync (e.g., ['done', 'cancelled']) */
  excludeStatuses?: string[];
}

export interface SyncTaskRequest {
  /** Sync operation type */
  operation: SyncOperation | 'scheduled-sync';
  /** Project ID (optional for scheduled-sync - syncs all active projects if omitted) */
  projectId?: string;
  taskIds?: string[];
  taskId?: string;
  conflictResolution?: ConflictResolution;
  createIfNotExists?: boolean;
  /** Structured filters for task selection including temporal filtering and status exclusion */
  filters?: TaskFilters;
  // Enhanced bulk operation options
  batchConfig?: BatchConfig;
  progressTracking?: boolean;
  operationId?: string;
  cancellationToken?: string;
}

export interface BatchConfig {
  batchSize?: number;
  maxConcurrency?: number;
  continueOnError?: boolean;
  retryFailedItems?: boolean;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };
  groupByJiraProject?: boolean;
  delayBetweenBatches?: number;
}

export interface SyncTaskResponse {
  success: boolean;
  data?: SyncResult | BulkSyncResult | MultiProjectSyncResult | ScheduledSyncResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    processingTime: number;
    requestId: string;
  };
}

/**
 * Result from scheduled project sync operation (DR-AI -> JIRA)
 */
export interface ScheduledSyncResult {
  direction: string;
  toJiraResults?: BulkSyncResult;
  summary: {
    totalTasksProcessed: number;
    successfulSyncs: number;
    failedSyncs: number;
    skippedTasks: number;
  };
}

export interface SyncResult {
  taskId: string;
  jiraIssueKey: string;
  operation: 'created' | 'updated' | 'no-change';
  syncedFields: string[];
  conflicts?: ConflictInfo[];
}

export interface BulkSyncResult {
  totalTasks: number;
  successful: number;
  failed: number;
  results: SyncResult[];
  errors: SyncError[];
  // Enhanced bulk operation results
  operationId?: string;
  processingTime?: number;
  batchesProcessed?: number;
  cancelled?: boolean;
  progressUrl?: string;
}

export interface SyncError {
  taskId: string;
  jiraIssueKey?: string;
  error: string;
  code?: string;
}

export interface ConflictInfo {
  field: string;
  drValue: any;
  jiraValue: any;
  resolution: 'dr' | 'jira';
}

export interface FieldMappingConfig {
  dr_to_jira: {
    title?: string;
    description?: string;
    status?: Record<string, string>;
    priority?: Record<string, string>;
    task_type?: Record<string, string>;
    tags?: string;
  };
  jira_to_dr: {
    summary?: string;
    description?: string;
    status?: Record<string, string>;
    priority?: Record<string, string>;
    issuetype?: Record<string, string>;
    labels?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Cancellation support
export interface CancellationToken {
  tokenId: string;
  operationId: string;
  requestedAt: string;
  requestedBy?: string;
}

export interface CancellationStatus {
  cancelled: boolean;
  cancellationToken?: string;
  reason?: string;
}

// Progress tracking
export interface ProgressRequest {
  operation: 'get-progress';
  operationId?: string;
  projectId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  since?: string;
  limit?: number;
}

export interface ProgressResponse {
  success: boolean;
  progress?: ProgressData | ProgressData[];
  error?: {
    code: string;
    message: string;
  };
}

export interface ProgressData {
  operationId: string;
  projectId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  percentComplete: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  estimatedCompletionTime?: string;
  currentBatch?: number;
  totalBatches?: number;
  errorSummary?: string[];
}

// Multi-project sync types
export interface ProjectSyncResult {
  projectId: string;
  projectName: string;
  status: 'success' | 'error';
  tasksSynced?: number;
  error?: string;
  processingTime?: number;
}

export interface MultiProjectSyncResult {
  totalProjects: number;
  successfulProjects: number;
  failedProjects: number;
  results: ProjectSyncResult[];
  totalProcessingTime: number;
}
