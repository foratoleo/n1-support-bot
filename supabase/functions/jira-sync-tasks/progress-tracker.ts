/**
 * Progress Tracker for JIRA Sync Operations
 *
 * Provides real-time progress tracking, persistence, and querying
 * for bulk sync operations.
 *
 * @module jira-sync-tasks/progress-tracker
 */

import { JiraDbService } from '../_shared/jira-db-service.ts';

export interface SyncProgressData {
  operationId: string;
  projectId: string;
  operation: 'bulk-sync' | 'batch-sync';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  currentBatch?: number;
  totalBatches?: number;
  percentComplete: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  estimatedCompletionTime?: string;
  errorSummary?: string[];
  metadata?: Record<string, any>;
}

export interface ProgressUpdate {
  processedItems?: number;
  successfulItems?: number;
  failedItems?: number;
  currentBatch?: number;
  status?: SyncProgressData['status'];
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ProgressQuery {
  operationId?: string;
  projectId?: string;
  status?: SyncProgressData['status'];
  since?: string;
  limit?: number;
}

/**
 * Manages progress tracking for sync operations
 */
export class ProgressTracker {
  private dbService: JiraDbService;
  private progressCache: Map<string, SyncProgressData>;
  private updateQueue: Map<string, ProgressUpdate[]>;
  private flushInterval: number;
  private flushTimer?: number;

  constructor(
    dbService: JiraDbService,
    flushInterval: number = 1000 // Flush updates every second
  ) {
    this.dbService = dbService;
    this.progressCache = new Map();
    this.updateQueue = new Map();
    this.flushInterval = flushInterval;
  }

  /**
   * Initialize a new progress tracking session
   */
  async initializeProgress(
    operationId: string,
    projectId: string,
    totalItems: number,
    operation: 'bulk-sync' | 'batch-sync' = 'bulk-sync',
    metadata?: Record<string, any>
  ): Promise<SyncProgressData> {
    const now = new Date().toISOString();

    const progress: SyncProgressData = {
      operationId,
      projectId,
      operation,
      status: 'pending',
      totalItems,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      percentComplete: 0,
      startedAt: now,
      updatedAt: now,
      metadata,
    };

    // Store in cache
    this.progressCache.set(operationId, progress);

    // Persist to database
    await this.persistProgress(progress);

    // Start flush timer if not already running
    this.startFlushTimer();

    return progress;
  }

  /**
   * Update progress for an operation
   */
  async updateProgress(
    operationId: string,
    update: ProgressUpdate
  ): Promise<SyncProgressData | null> {
    const progress = this.progressCache.get(operationId);
    if (!progress) {
      console.error(`Progress not found for operation: ${operationId}`);
      return null;
    }

    // Queue update for batched processing
    if (!this.updateQueue.has(operationId)) {
      this.updateQueue.set(operationId, []);
    }
    this.updateQueue.get(operationId)!.push(update);

    // Apply update to cache immediately for real-time queries
    this.applyUpdateToProgress(progress, update);

    return progress;
  }

  /**
   * Mark operation as completed
   */
  async completeProgress(
    operationId: string,
    status: 'completed' | 'failed' | 'cancelled' = 'completed'
  ): Promise<void> {
    const progress = this.progressCache.get(operationId);
    if (!progress) {
      return;
    }

    progress.status = status;
    progress.completedAt = new Date().toISOString();
    progress.updatedAt = progress.completedAt;
    progress.percentComplete = status === 'completed' ? 100 : progress.percentComplete;

    await this.persistProgress(progress);

    // Clean up after a delay
    setTimeout(() => {
      this.progressCache.delete(operationId);
      this.updateQueue.delete(operationId);
    }, 60000); // Keep in cache for 1 minute after completion
  }

  /**
   * Get current progress for an operation
   */
  async getProgress(operationId: string): Promise<SyncProgressData | null> {
    // Check cache first
    const cached = this.progressCache.get(operationId);
    if (cached) {
      return cached;
    }

    // Query from database
    return await this.queryProgressFromDb(operationId);
  }

  /**
   * Query progress for multiple operations
   */
  async queryProgress(query: ProgressQuery): Promise<SyncProgressData[]> {
    const results: SyncProgressData[] = [];

    // Include cached items that match query
    for (const [_, progress] of this.progressCache) {
      if (this.matchesQuery(progress, query)) {
        results.push(progress);
      }
    }

    // Query database for additional items
    const dbResults = await this.queryProgressFromDbBulk(query);

    // Merge results, preferring cached versions
    const operationIds = new Set(results.map(p => p.operationId));
    for (const dbProgress of dbResults) {
      if (!operationIds.has(dbProgress.operationId)) {
        results.push(dbProgress);
      }
    }

    return results;
  }

  /**
   * Cancel an ongoing operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    const progress = this.progressCache.get(operationId);
    if (!progress || progress.status !== 'processing') {
      return false;
    }

    await this.completeProgress(operationId, 'cancelled');
    return true;
  }

  /**
   * Emit progress event for real-time updates
   */
  emitProgressEvent(
    operationId: string,
    progress: SyncProgressData
  ): void {
    // This could be extended to use WebSockets or Server-Sent Events
    // For now, just log the progress
    console.log('Progress Event:', {
      operationId,
      percentComplete: progress.percentComplete,
      status: progress.status,
      processedItems: progress.processedItems,
      totalItems: progress.totalItems,
    });
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletion(progress: SyncProgressData): string | undefined {
    if (progress.processedItems === 0 || progress.status !== 'processing') {
      return undefined;
    }

    const startTime = new Date(progress.startedAt).getTime();
    const currentTime = new Date().getTime();
    const elapsedTime = currentTime - startTime;
    const averageTimePerItem = elapsedTime / progress.processedItems;
    const remainingItems = progress.totalItems - progress.processedItems;
    const estimatedRemainingTime = averageTimePerItem * remainingItems;

    return new Date(currentTime + estimatedRemainingTime).toISOString();
  }

  /**
   * Apply update to progress object
   */
  private applyUpdateToProgress(progress: SyncProgressData, update: ProgressUpdate): void {
    if (update.processedItems !== undefined) {
      progress.processedItems = update.processedItems;
    }
    if (update.successfulItems !== undefined) {
      progress.successfulItems = update.successfulItems;
    }
    if (update.failedItems !== undefined) {
      progress.failedItems = update.failedItems;
    }
    if (update.currentBatch !== undefined) {
      progress.currentBatch = update.currentBatch;
    }
    if (update.status !== undefined) {
      progress.status = update.status;
    }
    if (update.errorMessage) {
      if (!progress.errorSummary) {
        progress.errorSummary = [];
      }
      progress.errorSummary.push(update.errorMessage);
      // Keep only last 10 errors in summary
      if (progress.errorSummary.length > 10) {
        progress.errorSummary = progress.errorSummary.slice(-10);
      }
    }
    if (update.metadata) {
      progress.metadata = { ...progress.metadata, ...update.metadata };
    }

    // Calculate percentage
    if (progress.totalItems > 0) {
      progress.percentComplete = Math.round(
        (progress.processedItems / progress.totalItems) * 100
      );
    }

    // Update timestamp and estimate
    progress.updatedAt = new Date().toISOString();
    progress.estimatedCompletionTime = this.calculateEstimatedCompletion(progress);

    // Emit progress event
    this.emitProgressEvent(progress.operationId, progress);
  }

  /**
   * Start the flush timer for batched updates
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setInterval(() => {
      this.flushUpdates();
    }, this.flushInterval);
  }

  /**
   * Stop the flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Flush queued updates to database
   */
  private async flushUpdates(): Promise<void> {
    if (this.updateQueue.size === 0) {
      return;
    }

    const updates = new Map(this.updateQueue);
    this.updateQueue.clear();

    for (const [operationId, updateList] of updates) {
      const progress = this.progressCache.get(operationId);
      if (!progress) {
        continue;
      }

      try {
        await this.persistProgress(progress);
      } catch (error) {
        console.error(`Failed to persist progress for ${operationId}:`, error);
        // Re-queue failed updates
        if (!this.updateQueue.has(operationId)) {
          this.updateQueue.set(operationId, []);
        }
        this.updateQueue.get(operationId)!.push(...updateList);
      }
    }
  }

  /**
   * Persist progress to database
   */
  private async persistProgress(progress: SyncProgressData): Promise<void> {
    // Store in jira_sync_log with extended metadata
    await this.dbService.createSyncLog({
      project_id: progress.projectId,
      operation: progress.operation,
      direction: 'dr_to_jira',
      status: progress.status === 'processing' ? 'pending' :
              progress.status === 'completed' ? 'success' :
              progress.status === 'cancelled' ? 'cancelled' : 'error',
      metadata: {
        operationId: progress.operationId,
        totalItems: progress.totalItems,
        processedItems: progress.processedItems,
        successfulItems: progress.successfulItems,
        failedItems: progress.failedItems,
        percentComplete: progress.percentComplete,
        currentBatch: progress.currentBatch,
        totalBatches: progress.totalBatches,
        startedAt: progress.startedAt,
        completedAt: progress.completedAt,
        estimatedCompletionTime: progress.estimatedCompletionTime,
        errorSummary: progress.errorSummary,
        ...progress.metadata,
      },
    });
  }

  /**
   * Query progress from database
   */
  private async queryProgressFromDb(operationId: string): Promise<SyncProgressData | null> {
    // This would query the jira_sync_log table
    // Implementation depends on database schema
    // For now, return null if not in cache
    return null;
  }

  /**
   * Query multiple progress records from database
   */
  private async queryProgressFromDbBulk(query: ProgressQuery): Promise<SyncProgressData[]> {
    // This would query the jira_sync_log table with filters
    // Implementation depends on database schema
    return [];
  }

  /**
   * Check if progress matches query criteria
   */
  private matchesQuery(progress: SyncProgressData, query: ProgressQuery): boolean {
    if (query.operationId && progress.operationId !== query.operationId) {
      return false;
    }
    if (query.projectId && progress.projectId !== query.projectId) {
      return false;
    }
    if (query.status && progress.status !== query.status) {
      return false;
    }
    if (query.since && new Date(progress.updatedAt) < new Date(query.since)) {
      return false;
    }
    return true;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopFlushTimer();
    this.progressCache.clear();
    this.updateQueue.clear();
  }
}