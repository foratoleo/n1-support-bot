/**
 * Optimized JIRA Database Service for Supabase Edge Functions
 *
 * Performance optimizations:
 * - Reduced query count with JOINs
 * - Batch operations for multiple items
 * - Query result caching
 * - Optimized SELECT statements
 * - Prepared statement patterns
 *
 * @module jira-db-service-optimized
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export interface JiraSyncConfig {
  id?: string;
  project_id: string;
  jira_url: string;
  jira_project_key: string;
  jira_email: string;
  api_token_encrypted: string;
  webhook_secret?: string;
  field_mapping_id?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface JiraFieldMapping {
  id?: string;
  project_id: string;
  mapping_name: string;
  dr_to_jira: Record<string, any>;
  jira_to_dr: Record<string, any>;
  created_at?: string;
}

export interface JiraSyncLog {
  id?: string;
  project_id: string;
  task_id?: string;
  jira_issue_key?: string;
  operation: 'create' | 'update' | 'delete' | 'sync';
  direction: 'dr_to_jira' | 'jira_to_dr';
  status: 'success' | 'error' | 'pending';
  error_message?: string;
  retry_count?: number;
  created_at?: string;
}

export interface DevTask {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  tags?: string[];
  jira_issue_key?: string;
  jira_sync_status?: string;
  last_jira_sync?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateTaskJiraData {
  jira_issue_key?: string;
  jira_sync_status?: string;
  last_jira_sync?: string;
}

export interface ConfigWithMapping extends JiraSyncConfig {
  field_mapping?: JiraFieldMapping;
}

export class JiraDbServiceError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'JiraDbServiceError';
  }
}

// Simple in-memory cache with TTL
class QueryCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly defaultTTL = 60000; // 60 seconds default

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export class JiraDbServiceOptimized {
  private supabase: SupabaseClient;
  private cache: QueryCache;

  // Optimized column selections
  private readonly CONFIG_COLUMNS = 'id, project_id, jira_url, jira_project_key, jira_email, api_token_encrypted, webhook_secret, field_mapping_id, is_active, created_at, updated_at';
  private readonly MAPPING_COLUMNS = 'id, project_id, mapping_name, dr_to_jira, jira_to_dr, created_at';
  private readonly TASK_COLUMNS = 'id, project_id, title, description, status, priority, assigned_to, tags, jira_issue_key, jira_sync_status, last_jira_sync, created_at, updated_at';
  private readonly LOG_COLUMNS = 'id, project_id, task_id, jira_issue_key, operation, direction, status, error_message, retry_count, created_at';

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new JiraDbServiceError('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.cache = new QueryCache();
  }

  // ========== OPTIMIZED JIRA Sync Config Operations ==========

  /**
   * Get JIRA sync configuration with optional field mapping JOIN
   * Uses caching for frequently accessed configs
   */
  async getConfigWithMapping(projectId: string): Promise<ConfigWithMapping | null> {
    const cacheKey = `config:${projectId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Optimized query with JOIN
    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .select(`
        ${this.CONFIG_COLUMNS},
        field_mapping:jira_field_mappings!field_mapping_id (
          ${this.MAPPING_COLUMNS}
        )
      `)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get JIRA config with mapping');
    }

    // Cache for 5 minutes
    this.cache.set(cacheKey, data, 300000);
    return data as ConfigWithMapping;
  }

  /**
   * Get JIRA sync configuration (lightweight version)
   */
  async getConfig(projectId: string): Promise<JiraSyncConfig | null> {
    const cacheKey = `config-lite:${projectId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .select(this.CONFIG_COLUMNS)
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get JIRA config');
    }

    // Cache for 5 minutes
    this.cache.set(cacheKey, data, 300000);
    return data as JiraSyncConfig;
  }

  /**
   * Create JIRA sync configuration and invalidate cache
   */
  async createConfig(config: JiraSyncConfig): Promise<JiraSyncConfig> {
    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .insert({
        project_id: config.project_id,
        jira_url: config.jira_url,
        jira_project_key: config.jira_project_key,
        jira_email: config.jira_email,
        api_token_encrypted: config.api_token_encrypted,
        webhook_secret: config.webhook_secret,
        field_mapping_id: config.field_mapping_id,
        is_active: config.is_active ?? true,
      })
      .select(this.CONFIG_COLUMNS)
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to create JIRA config');
    }

    // Invalidate config cache for this project
    this.cache.invalidate(`config:${config.project_id}`);
    return data as JiraSyncConfig;
  }

  /**
   * Update JIRA sync configuration and invalidate cache
   */
  async updateConfig(id: string, updates: Partial<JiraSyncConfig>): Promise<JiraSyncConfig> {
    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(this.CONFIG_COLUMNS)
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to update JIRA config');
    }

    // Invalidate all config caches
    this.cache.invalidate('config:');
    return data as JiraSyncConfig;
  }

  // ========== OPTIMIZED Field Mapping Operations ==========

  /**
   * Get field mapping by ID with caching
   */
  async getFieldMapping(id: string): Promise<JiraFieldMapping | null> {
    const cacheKey = `mapping:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('jira_field_mappings')
      .select(this.MAPPING_COLUMNS)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get field mapping');
    }

    // Cache for 10 minutes
    this.cache.set(cacheKey, data, 600000);
    return data as JiraFieldMapping;
  }

  /**
   * Get all field mappings for a project with caching
   */
  async getFieldMappings(projectId: string): Promise<JiraFieldMapping[]> {
    const cacheKey = `mappings:${projectId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('jira_field_mappings')
      .select(this.MAPPING_COLUMNS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw this.handleError(error, 'Failed to get field mappings');
    }

    // Cache for 10 minutes
    this.cache.set(cacheKey, data || [], 600000);
    return (data as JiraFieldMapping[]) || [];
  }

  // ========== OPTIMIZED Sync Log Operations ==========

  /**
   * Batch create sync log entries
   */
  async createSyncLogBatch(logs: JiraSyncLog[]): Promise<JiraSyncLog[]> {
    if (logs.length === 0) return [];

    const { data, error } = await this.supabase
      .from('jira_sync_log')
      .insert(logs.map(log => ({
        project_id: log.project_id,
        task_id: log.task_id,
        jira_issue_key: log.jira_issue_key,
        operation: log.operation,
        direction: log.direction,
        status: log.status,
        error_message: log.error_message,
        retry_count: log.retry_count || 0,
      })))
      .select(this.LOG_COLUMNS);

    if (error) {
      throw this.handleError(error, 'Failed to create sync log batch');
    }

    return (data as JiraSyncLog[]) || [];
  }

  /**
   * Create single sync log entry (fallback for single operations)
   */
  async createSyncLog(log: JiraSyncLog): Promise<JiraSyncLog> {
    const result = await this.createSyncLogBatch([log]);
    return result[0];
  }

  /**
   * Get sync logs with optimized pagination
   */
  async getSyncLogs(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: JiraSyncLog[]; total: number }> {
    // Use partial index on project_id and created_at
    const { data, error, count } = await this.supabase
      .from('jira_sync_log')
      .select(this.LOG_COLUMNS, { count: 'exact' })
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw this.handleError(error, 'Failed to get sync logs');
    }

    return {
      logs: (data as JiraSyncLog[]) || [],
      total: count || 0,
    };
  }

  // ========== OPTIMIZED Task Operations ==========

  /**
   * Get multiple tasks in a single query
   */
  async getTasksBatch(taskIds: string[]): Promise<Map<string, DevTask>> {
    if (taskIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from('dev_tasks')
      .select(this.TASK_COLUMNS)
      .in('id', taskIds)
      .is('deleted_at', null);

    if (error) {
      throw this.handleError(error, 'Failed to get tasks batch');
    }

    const taskMap = new Map<string, DevTask>();
    (data as DevTask[])?.forEach(task => {
      taskMap.set(task.id, task);
    });

    return taskMap;
  }

  /**
   * Get task by ID (uses cache if available)
   */
  async getTask(taskId: string): Promise<DevTask | null> {
    const cacheKey = `task:${taskId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('dev_tasks')
      .select(this.TASK_COLUMNS)
      .eq('id', taskId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get task');
    }

    // Cache for 2 minutes
    this.cache.set(cacheKey, data, 120000);
    return data as DevTask;
  }

  /**
   * Get tasks with optimized filtering
   */
  async getTasks(
    projectId: string,
    filters?: {
      status?: string[];
      syncStatus?: string[];
      hasJiraIssue?: boolean;
    }
  ): Promise<DevTask[]> {
    let query = this.supabase
      .from('dev_tasks')
      .select(this.TASK_COLUMNS)
      .eq('project_id', projectId)
      .is('deleted_at', null);

    // Use indexed columns for filtering
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    if (filters?.syncStatus && filters.syncStatus.length > 0) {
      query = query.in('jira_sync_status', filters.syncStatus);
    }

    if (filters?.hasJiraIssue !== undefined) {
      if (filters.hasJiraIssue) {
        query = query.not('jira_issue_key', 'is', null);
      } else {
        query = query.is('jira_issue_key', null);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw this.handleError(error, 'Failed to get tasks');
    }

    return (data as DevTask[]) || [];
  }

  /**
   * Batch update task JIRA data
   */
  async updateTasksJiraDataBatch(
    updates: Array<{ taskId: string; jiraData: UpdateTaskJiraData }>
  ): Promise<Map<string, DevTask>> {
    if (updates.length === 0) return new Map();

    const results = new Map<string, DevTask>();
    const timestamp = new Date().toISOString();

    // Batch updates using Promise.all for parallel execution
    const promises = updates.map(async ({ taskId, jiraData }) => {
      const { data, error } = await this.supabase
        .from('dev_tasks')
        .update({
          ...jiraData,
          updated_at: timestamp,
        })
        .eq('id', taskId)
        .select(this.TASK_COLUMNS)
        .single();

      if (error) {
        console.error(`Failed to update task ${taskId}:`, error);
        return null;
      }

      // Invalidate task cache
      this.cache.invalidate(`task:${taskId}`);
      return data as DevTask;
    });

    const updatedTasks = await Promise.all(promises);
    updatedTasks.forEach((task) => {
      if (task) {
        results.set(task.id, task);
      }
    });

    return results;
  }

  /**
   * Update single task JIRA data (fallback for single operations)
   */
  async updateTaskJiraData(taskId: string, jiraData: UpdateTaskJiraData): Promise<DevTask> {
    const result = await this.updateTasksJiraDataBatch([{ taskId, jiraData }]);
    const task = result.get(taskId);

    if (!task) {
      throw new JiraDbServiceError('Failed to update task JIRA data');
    }

    return task;
  }

  /**
   * Get task by JIRA issue key with caching
   */
  async getTaskByJiraKey(jiraIssueKey: string, projectId: string): Promise<DevTask | null> {
    const cacheKey = `task-jira:${jiraIssueKey}:${projectId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const { data, error } = await this.supabase
      .from('dev_tasks')
      .select(this.TASK_COLUMNS)
      .eq('jira_issue_key', jiraIssueKey)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get task by JIRA key');
    }

    // Cache for 2 minutes
    this.cache.set(cacheKey, data, 120000);
    return data as DevTask;
  }

  /**
   * Execute optimized batch transaction
   * Uses Promise.allSettled for better error handling
   */
  async executeTransaction<T>(
    operations: Array<() => Promise<any>>
  ): Promise<T[]> {
    const results = await Promise.allSettled(operations.map(op => op()));

    const successfulResults: T[] = [];
    const errors: any[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        errors.push({
          operation: index,
          error: result.reason
        });
      }
    });

    if (errors.length > 0) {
      console.error('Transaction had errors:', errors);
      throw new JiraDbServiceError('Transaction partially failed', 'PARTIAL_FAILURE', { errors });
    }

    return successfulResults;
  }

  /**
   * Invalidate cache for specific entities
   */
  invalidateCache(pattern?: string): void {
    this.cache.invalidate(pattern);
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; patterns: string[] } {
    // Simple stats for monitoring
    return {
      size: this.cache['cache'].size,
      patterns: Array.from(this.cache['cache'].keys()).map(k => k.split(':')[0])
    };
  }

  /**
   * Handle database errors with context
   */
  private handleError(error: any, context: string): JiraDbServiceError {
    console.error(`${context}:`, error);

    const message = error.message || 'Database operation failed';
    const code = error.code;

    // Map common PostgreSQL error codes
    if (code === '23503') {
      return new JiraDbServiceError('Foreign key constraint violation', code, error);
    }
    if (code === '23505') {
      return new JiraDbServiceError('Unique constraint violation', code, error);
    }
    if (code === '42501') {
      return new JiraDbServiceError('Permission denied', code, error);
    }

    return new JiraDbServiceError(`${context}: ${message}`, code, error);
  }
}

// Export a singleton instance for reuse across requests
export const jiraDbService = new JiraDbServiceOptimized();