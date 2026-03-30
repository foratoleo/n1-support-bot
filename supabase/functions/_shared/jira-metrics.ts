/**
 * JIRA Metrics Collection System
 *
 * Provides comprehensive metrics collection for JIRA synchronization
 * including performance metrics, API metrics, and business metrics.
 *
 * @module jira-metrics
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Metric types
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'rate';

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string>;
  timestamp?: string;
}

export interface HistogramMetric extends Metric {
  type: 'histogram';
  percentiles?: {
    p50: number;
    p95: number;
    p99: number;
  };
  buckets?: number[];
}

export interface RateMetric extends Metric {
  type: 'rate';
  interval: 'second' | 'minute' | 'hour';
}

// Metric categories
export interface SyncMetrics {
  syncDuration: HistogramMetric;
  syncSuccessCount: Metric;
  syncFailureCount: Metric;
  syncQueueLength: Metric;
  tasksPerMinute: RateMetric;
  syncLatencyPercentiles: HistogramMetric;
  conflictCount: Metric;
}

export interface JiraApiMetrics {
  apiCallDuration: HistogramMetric;
  apiCallCount: Metric;
  apiErrorsByType: Map<string, Metric>;
  rateLimitStatus: Metric;
  apiQuotaUsage: Metric;
  retryCount: Metric;
}

export interface DatabaseMetrics {
  queryDuration: HistogramMetric;
  queryCountByType: Map<string, Metric>;
  connectionPoolUsage: Metric;
  slowQueryCount: Metric;
  transactionCount: Metric;
  deadlockCount: Metric;
}

export interface BusinessMetrics {
  activeConfigurations: Metric;
  projectsUsingSync: Metric;
  totalTasksSynced: Metric;
  syncConflictsDetected: Metric;
  averageSyncTime: Metric;
  syncCompletionRate: Metric;
}

export interface MetricsSnapshot {
  timestamp: string;
  sync: SyncMetrics;
  api: JiraApiMetrics;
  database: DatabaseMetrics;
  business: BusinessMetrics;
}

// Percentile calculator for histograms
class PercentileCalculator {
  private values: number[] = [];
  private maxSize: number = 1000;

  add(value: number) {
    this.values.push(value);
    if (this.values.length > this.maxSize) {
      this.values.shift();
    }
  }

  getPercentile(p: number): number {
    if (this.values.length === 0) return 0;

    const sorted = [...this.values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getPercentiles(): { p50: number; p95: number; p99: number } {
    return {
      p50: this.getPercentile(50),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
    };
  }

  clear() {
    this.values = [];
  }
}

// Rate calculator
class RateCalculator {
  private events: number[] = [];
  private windowMs: number;

  constructor(interval: 'second' | 'minute' | 'hour') {
    this.windowMs = this.getWindowMs(interval);
  }

  private getWindowMs(interval: 'second' | 'minute' | 'hour'): number {
    switch (interval) {
      case 'second': return 1000;
      case 'minute': return 60000;
      case 'hour': return 3600000;
    }
  }

  record() {
    const now = Date.now();
    this.events.push(now);
    this.cleanup();
  }

  getRate(): number {
    this.cleanup();
    return this.events.length;
  }

  private cleanup() {
    const cutoff = Date.now() - this.windowMs;
    this.events = this.events.filter(t => t > cutoff);
  }
}

export class JiraMetricsCollector {
  private supabase: SupabaseClient;
  private metrics: Map<string, Metric> = new Map();
  private histograms: Map<string, PercentileCalculator> = new Map();
  private rates: Map<string, RateCalculator> = new Map();
  private flushInterval: number = 60000; // Flush every minute
  private flushTimer?: number;
  private projectId?: string;

  constructor(projectId?: string) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.projectId = projectId;
    this.startFlushTimer();
  }

  // ========== Sync Metrics ==========

  recordSyncDuration(durationMs: number, labels?: Record<string, string>) {
    const key = 'sync_duration';
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new PercentileCalculator());
    }
    this.histograms.get(key)!.add(durationMs);

    // Also record as regular metric for immediate access
    this.recordMetric({
      name: 'sync_duration_ms',
      type: 'histogram',
      value: durationMs,
      labels,
    });
  }

  incrementSyncSuccess(labels?: Record<string, string>) {
    this.incrementCounter('sync_success_count', labels);
  }

  incrementSyncFailure(labels?: Record<string, string>) {
    this.incrementCounter('sync_failure_count', labels);
  }

  setSyncQueueLength(length: number) {
    this.setGauge('sync_queue_length', length);
  }

  recordTaskSynced() {
    const key = 'tasks_per_minute';
    if (!this.rates.has(key)) {
      this.rates.set(key, new RateCalculator('minute'));
    }
    this.rates.get(key)!.record();
  }

  incrementConflictCount(labels?: Record<string, string>) {
    this.incrementCounter('sync_conflict_count', labels);
  }

  // ========== API Metrics ==========

  recordApiCallDuration(durationMs: number, endpoint: string, method: string) {
    const key = 'api_call_duration';
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new PercentileCalculator());
    }
    this.histograms.get(key)!.add(durationMs);

    this.recordMetric({
      name: 'api_call_duration_ms',
      type: 'histogram',
      value: durationMs,
      labels: { endpoint, method },
    });
  }

  incrementApiCall(endpoint: string, method: string, status: number) {
    this.incrementCounter('api_call_count', { endpoint, method, status: status.toString() });
  }

  incrementApiError(errorType: string, endpoint: string) {
    this.incrementCounter('api_error_count', { error_type: errorType, endpoint });
  }

  setRateLimitStatus(remaining: number, limit: number) {
    this.setGauge('rate_limit_remaining', remaining);
    this.setGauge('rate_limit_total', limit);
    this.setGauge('rate_limit_usage_percent', ((limit - remaining) / limit) * 100);
  }

  setApiQuotaUsage(used: number, total: number) {
    this.setGauge('api_quota_used', used);
    this.setGauge('api_quota_total', total);
    this.setGauge('api_quota_usage_percent', (used / total) * 100);
  }

  incrementRetryCount(endpoint: string, attempt: number) {
    this.incrementCounter('api_retry_count', { endpoint, attempt: attempt.toString() });
  }

  // ========== Database Metrics ==========

  recordQueryDuration(durationMs: number, queryType: string) {
    const key = 'db_query_duration';
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new PercentileCalculator());
    }
    this.histograms.get(key)!.add(durationMs);

    this.recordMetric({
      name: 'db_query_duration_ms',
      type: 'histogram',
      value: durationMs,
      labels: { query_type: queryType },
    });

    // Track slow queries
    if (durationMs > 100) {
      this.incrementCounter('db_slow_query_count', { query_type: queryType });
    }
  }

  incrementQueryCount(queryType: string) {
    this.incrementCounter('db_query_count', { query_type: queryType });
  }

  setConnectionPoolUsage(active: number, idle: number, waiting: number) {
    this.setGauge('db_connections_active', active);
    this.setGauge('db_connections_idle', idle);
    this.setGauge('db_connections_waiting', waiting);
    this.setGauge('db_connections_total', active + idle);
  }

  incrementTransactionCount(status: 'success' | 'failure') {
    this.incrementCounter('db_transaction_count', { status });
  }

  incrementDeadlockCount() {
    this.incrementCounter('db_deadlock_count');
  }

  // ========== Business Metrics ==========

  setActiveConfigurations(count: number) {
    this.setGauge('business_active_configs', count);
  }

  setProjectsUsingSync(count: number) {
    this.setGauge('business_projects_with_sync', count);
  }

  incrementTasksSynced(count: number = 1) {
    this.incrementCounter('business_tasks_synced_total', {}, count);
  }

  setAverageSyncTime(timeMs: number) {
    this.setGauge('business_avg_sync_time_ms', timeMs);
  }

  setSyncCompletionRate(rate: number) {
    this.setGauge('business_sync_completion_rate', rate);
  }

  // ========== Core Metric Operations ==========

  private incrementCounter(name: string, labels?: Record<string, string>, increment: number = 1) {
    const key = this.getMetricKey(name, labels);
    const current = this.metrics.get(key);

    if (current) {
      current.value += increment;
    } else {
      this.metrics.set(key, {
        name,
        type: 'counter',
        value: increment,
        labels,
      });
    }
  }

  private setGauge(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getMetricKey(name, labels);
    this.metrics.set(key, {
      name,
      type: 'gauge',
      value,
      labels,
    });
  }

  private recordMetric(metric: Metric) {
    const key = this.getMetricKey(metric.name, metric.labels);
    this.metrics.set(key, {
      ...metric,
      timestamp: metric.timestamp || new Date().toISOString(),
    });
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  // ========== Snapshot and Persistence ==========

  getSnapshot(): MetricsSnapshot {
    const now = new Date().toISOString();

    // Calculate percentiles for histograms
    const syncDurationPercentiles = this.histograms.get('sync_duration')?.getPercentiles() || { p50: 0, p95: 0, p99: 0 };
    const apiDurationPercentiles = this.histograms.get('api_call_duration')?.getPercentiles() || { p50: 0, p95: 0, p99: 0 };
    const dbDurationPercentiles = this.histograms.get('db_query_duration')?.getPercentiles() || { p50: 0, p95: 0, p99: 0 };

    // Get rate metrics
    const tasksPerMinute = this.rates.get('tasks_per_minute')?.getRate() || 0;

    return {
      timestamp: now,
      sync: {
        syncDuration: this.createHistogram('sync_duration_ms', syncDurationPercentiles),
        syncSuccessCount: this.getMetric('sync_success_count'),
        syncFailureCount: this.getMetric('sync_failure_count'),
        syncQueueLength: this.getMetric('sync_queue_length'),
        tasksPerMinute: this.createRate('tasks_per_minute', tasksPerMinute, 'minute'),
        syncLatencyPercentiles: this.createHistogram('sync_latency_ms', syncDurationPercentiles),
        conflictCount: this.getMetric('sync_conflict_count'),
      },
      api: {
        apiCallDuration: this.createHistogram('api_call_duration_ms', apiDurationPercentiles),
        apiCallCount: this.getMetric('api_call_count'),
        apiErrorsByType: this.getMetricsByPrefix('api_error_count'),
        rateLimitStatus: this.getMetric('rate_limit_usage_percent'),
        apiQuotaUsage: this.getMetric('api_quota_usage_percent'),
        retryCount: this.getMetric('api_retry_count'),
      },
      database: {
        queryDuration: this.createHistogram('db_query_duration_ms', dbDurationPercentiles),
        queryCountByType: this.getMetricsByPrefix('db_query_count'),
        connectionPoolUsage: this.getMetric('db_connections_total'),
        slowQueryCount: this.getMetric('db_slow_query_count'),
        transactionCount: this.getMetric('db_transaction_count'),
        deadlockCount: this.getMetric('db_deadlock_count'),
      },
      business: {
        activeConfigurations: this.getMetric('business_active_configs'),
        projectsUsingSync: this.getMetric('business_projects_with_sync'),
        totalTasksSynced: this.getMetric('business_tasks_synced_total'),
        syncConflictsDetected: this.getMetric('sync_conflict_count'),
        averageSyncTime: this.getMetric('business_avg_sync_time_ms'),
        syncCompletionRate: this.getMetric('business_sync_completion_rate'),
      },
    };
  }

  private createHistogram(name: string, percentiles: { p50: number; p95: number; p99: number }): HistogramMetric {
    const metric = this.getMetric(name);
    return {
      ...metric,
      type: 'histogram',
      percentiles,
    } as HistogramMetric;
  }

  private createRate(name: string, value: number, interval: 'second' | 'minute' | 'hour'): RateMetric {
    return {
      name,
      type: 'rate',
      value,
      interval,
    };
  }

  private getMetric(name: string): Metric {
    return this.metrics.get(name) || {
      name,
      type: 'gauge',
      value: 0,
    };
  }

  private getMetricsByPrefix(prefix: string): Map<string, Metric> {
    const result = new Map<string, Metric>();
    for (const [key, metric] of this.metrics.entries()) {
      if (key.startsWith(prefix)) {
        result.set(key, metric);
      }
    }
    return result;
  }

  // ========== Persistence ==========

  async flush() {
    try {
      const metrics = Array.from(this.metrics.values());

      if (metrics.length === 0) return;

      // Store metrics in database
      const { error: metricsError } = await this.supabase
        .from('jira_metrics')
        .insert(
          metrics.map(metric => ({
            project_id: this.projectId,
            metric_name: metric.name,
            metric_type: metric.type,
            metric_value: metric.value,
            labels: metric.labels || {},
            timestamp: metric.timestamp || new Date().toISOString(),
          }))
        );

      if (metricsError) {
        console.error('Failed to store metrics:', metricsError);
        // Store in sync log as fallback
        await this.logMetricsError(metricsError);
      }

      // Store aggregated snapshot
      const snapshot = this.getSnapshot();
      const { error: snapshotError } = await this.supabase
        .from('jira_metrics_snapshots')
        .insert({
          project_id: this.projectId,
          snapshot_data: snapshot,
          created_at: snapshot.timestamp,
        });

      if (snapshotError) {
        console.error('Failed to store snapshot:', snapshotError);
      }

      // Clear counters after flush (gauges and histograms persist)
      this.clearCounters();

    } catch (error) {
      console.error('Metrics flush failed:', error);
    }
  }

  private async logMetricsError(error: any) {
    try {
      await this.supabase
        .from('jira_sync_log')
        .insert({
          project_id: this.projectId,
          operation: 'metrics_flush',
          direction: 'dr_to_jira',
          status: 'error',
          error_message: `Failed to store metrics: ${error.message}`,
        });
    } catch (logError) {
      console.error('Failed to log metrics error:', logError);
    }
  }

  private clearCounters() {
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.type === 'counter') {
        this.metrics.delete(key);
      }
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  // ========== Cleanup ==========

  async close() {
    this.stopFlushTimer();
    await this.flush();
  }
}

// Export singleton instance for shared use
let sharedCollector: JiraMetricsCollector | null = null;

export function getMetricsCollector(projectId?: string): JiraMetricsCollector {
  if (!sharedCollector) {
    sharedCollector = new JiraMetricsCollector(projectId);
  }
  return sharedCollector;
}

export async function closeMetricsCollector() {
  if (sharedCollector) {
    await sharedCollector.close();
    sharedCollector = null;
  }
}