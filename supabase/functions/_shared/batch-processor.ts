/**
 * Batch Processor Utility
 *
 * Provides configurable batch processing with parallel execution,
 * concurrency control, and comprehensive error handling.
 *
 * @module batch-processor
 */

export interface BatchProcessorConfig<T, R> {
  /**
   * Maximum number of items to process in a single batch
   * @default 10
   */
  batchSize?: number;

  /**
   * Maximum number of concurrent batches
   * @default 3
   */
  maxConcurrency?: number;

  /**
   * Delay between batch executions in milliseconds
   * @default 0
   */
  delayBetweenBatches?: number;

  /**
   * Whether to continue processing on individual item failures
   * @default true
   */
  continueOnError?: boolean;

  /**
   * Retry configuration for failed items
   */
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier?: number;
  };

  /**
   * Progress callback function
   */
  onProgress?: (progress: BatchProgress) => void | Promise<void>;

  /**
   * Error callback function for individual item failures
   */
  onItemError?: (error: BatchItemError<T>) => void | Promise<void>;

  /**
   * Cancellation check function
   */
  isCancelled?: () => boolean | Promise<boolean>;
}

export interface BatchProgress {
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  currentBatch: number;
  totalBatches: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
  currentPhase: 'queuing' | 'processing' | 'completing' | 'cancelled';
}

export interface BatchItemError<T> {
  item: T;
  error: Error;
  batchIndex: number;
  itemIndex: number;
  retryCount: number;
}

export interface BatchResult<T, R> {
  successful: BatchItemResult<T, R>[];
  failed: BatchItemResult<T, Error>[];
  cancelled: boolean;
  totalProcessed: number;
  processingTime: number;
  batchesProcessed: number;
}

export interface BatchItemResult<T, R> {
  item: T;
  result: R;
  processingTime?: number;
  retryCount?: number;
}

/**
 * Generic batch processor for handling large datasets efficiently
 */
export class BatchProcessor<T, R> {
  private config: Required<BatchProcessorConfig<T, R>>;
  private startTime: number = 0;
  private cancelRequested: boolean = false;

  constructor(config: BatchProcessorConfig<T, R> = {}) {
    this.config = {
      batchSize: config.batchSize || 10,
      maxConcurrency: config.maxConcurrency || 3,
      delayBetweenBatches: config.delayBetweenBatches || 0,
      continueOnError: config.continueOnError !== false,
      retryConfig: config.retryConfig || { maxRetries: 0, retryDelay: 0 },
      onProgress: config.onProgress || (() => {}),
      onItemError: config.onItemError || (() => {}),
      isCancelled: config.isCancelled || (() => false),
    };
  }

  /**
   * Process items in batches with the provided processor function
   */
  async process(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<BatchResult<T, R>> {
    this.startTime = Date.now();
    this.cancelRequested = false;

    const batches = this.createBatches(items);
    const totalBatches = batches.length;
    const successful: BatchItemResult<T, R>[] = [];
    const failed: BatchItemResult<T, Error>[] = [];

    const progress: BatchProgress = {
      totalItems: items.length,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      currentBatch: 0,
      totalBatches,
      percentComplete: 0,
      currentPhase: 'queuing',
    };

    // Report initial progress
    await this.reportProgress(progress);

    try {
      // Process batches with concurrency control
      for (let i = 0; i < batches.length; i += this.config.maxConcurrency) {
        // Check for cancellation
        if (await this.checkCancellation()) {
          progress.currentPhase = 'cancelled';
          await this.reportProgress(progress);
          break;
        }

        progress.currentPhase = 'processing';
        progress.currentBatch = Math.min(i + this.config.maxConcurrency, totalBatches);

        // Process concurrent batch groups
        const batchGroup = batches.slice(i, i + this.config.maxConcurrency);
        const batchPromises = batchGroup.map((batch, groupIndex) =>
          this.processBatch(batch, processor, i + groupIndex, progress)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        // Collect results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            successful.push(...result.value.successful);
            failed.push(...result.value.failed);

            progress.processedItems += result.value.successful.length + result.value.failed.length;
            progress.successfulItems += result.value.successful.length;
            progress.failedItems += result.value.failed.length;
          } else if (!this.config.continueOnError) {
            throw result.reason;
          }
        }

        // Update progress
        progress.percentComplete = Math.round((progress.processedItems / items.length) * 100);
        progress.estimatedTimeRemaining = this.estimateTimeRemaining(progress);
        await this.reportProgress(progress);

        // Delay between batch groups if configured
        if (this.config.delayBetweenBatches > 0 && i + this.config.maxConcurrency < batches.length) {
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      progress.currentPhase = progress.currentPhase === 'cancelled' ? 'cancelled' : 'completing';
      await this.reportProgress(progress);

    } catch (error) {
      console.error('Batch processing error:', error);
      if (!this.config.continueOnError) {
        throw error;
      }
    }

    return {
      successful,
      failed,
      cancelled: progress.currentPhase === 'cancelled',
      totalProcessed: progress.processedItems,
      processingTime: Date.now() - this.startTime,
      batchesProcessed: progress.currentBatch,
    };
  }

  /**
   * Process items in parallel without batching (up to maxConcurrency limit)
   */
  async processParallel(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<BatchResult<T, R>> {
    return this.process(items, processor);
  }

  /**
   * Cancel ongoing batch processing
   */
  cancel(): void {
    this.cancelRequested = true;
  }

  /**
   * Process a single batch of items
   */
  private async processBatch(
    batch: T[],
    processor: (item: T) => Promise<R>,
    batchIndex: number,
    progress: BatchProgress
  ): Promise<{ successful: BatchItemResult<T, R>[], failed: BatchItemResult<T, Error>[] }> {
    const successful: BatchItemResult<T, R>[] = [];
    const failed: BatchItemResult<T, Error>[] = [];

    const itemPromises = batch.map(async (item, itemIndex) => {
      const itemStartTime = Date.now();
      let lastError: Error | null = null;
      let retryCount = 0;

      // Retry logic
      for (let attempt = 0; attempt <= this.config.retryConfig.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = this.calculateRetryDelay(attempt);
            await this.delay(delay);
          }

          const result = await processor(item);

          successful.push({
            item,
            result,
            processingTime: Date.now() - itemStartTime,
            retryCount: attempt,
          });

          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          retryCount = attempt;

          // Report item error
          await this.config.onItemError({
            item,
            error: lastError,
            batchIndex,
            itemIndex,
            retryCount,
          });

          if (attempt === this.config.retryConfig.maxRetries) {
            break;
          }
        }
      }

      // Item failed after all retries
      if (lastError) {
        failed.push({
          item,
          result: lastError,
          processingTime: Date.now() - itemStartTime,
          retryCount,
        });

        if (!this.config.continueOnError) {
          throw lastError;
        }
      }
    });

    await Promise.allSettled(itemPromises);

    return { successful, failed };
  }

  /**
   * Create batches from items array
   */
  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      batches.push(items.slice(i, i + this.config.batchSize));
    }
    return batches;
  }

  /**
   * Check if processing should be cancelled
   */
  private async checkCancellation(): Promise<boolean> {
    if (this.cancelRequested) {
      return true;
    }
    return await this.config.isCancelled();
  }

  /**
   * Report progress to callback
   */
  private async reportProgress(progress: BatchProgress): Promise<void> {
    try {
      await this.config.onProgress(progress);
    } catch (error) {
      console.error('Error reporting progress:', error);
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const { retryDelay, backoffMultiplier = 2 } = this.config.retryConfig;
    return retryDelay * Math.pow(backoffMultiplier, attempt - 1);
  }

  /**
   * Estimate remaining processing time
   */
  private estimateTimeRemaining(progress: BatchProgress): number | undefined {
    if (progress.processedItems === 0) {
      return undefined;
    }

    const elapsedTime = Date.now() - this.startTime;
    const averageTimePerItem = elapsedTime / progress.processedItems;
    const remainingItems = progress.totalItems - progress.processedItems;

    return Math.round(averageTimePerItem * remainingItems);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Smart batching utility that groups items by a key
 */
export class SmartBatchProcessor<T, R, K = string> extends BatchProcessor<T, R> {
  /**
   * Process items grouped by a key for more efficient batching
   */
  async processGrouped(
    items: T[],
    groupBy: (item: T) => K,
    processor: (items: T[]) => Promise<R[]>
  ): Promise<BatchResult<T, R>> {
    // Group items by key
    const groups = new Map<K, T[]>();
    for (const item of items) {
      const key = groupBy(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    // Process each group as a batch
    const groupedBatches = Array.from(groups.values());
    const results: BatchItemResult<T, R>[] = [];
    const failed: BatchItemResult<T, Error>[] = [];

    for (const group of groupedBatches) {
      try {
        const groupResults = await processor(group);
        group.forEach((item, index) => {
          results.push({
            item,
            result: groupResults[index],
          });
        });
      } catch (error) {
        group.forEach(item => {
          failed.push({
            item,
            result: error instanceof Error ? error : new Error(String(error)),
          });
        });
      }
    }

    return {
      successful: results,
      failed,
      cancelled: false,
      totalProcessed: items.length,
      processingTime: Date.now() - this.startTime,
      batchesProcessed: groupedBatches.length,
    };
  }
}