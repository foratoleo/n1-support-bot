/**
 * JIRA Database Service for Supabase Edge Functions
 *
 * Provides database operations for JIRA sync functionality including
 * configuration management, sync logging, and task operations.
 *
 * @module jira-db-service
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
  default_issue_type?: string;
  sync_direction?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
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
  jira_api_request?: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  jira_api_response?: {
    status: number;
    headers?: Record<string, string>;
    body?: any;
  };
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

export class JiraDbService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new JiraDbServiceError('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ========== JIRA Sync Config Operations ==========

  /**
   * Get JIRA sync configuration for a project
   */
  async getConfig(projectId: string): Promise<JiraSyncConfig | null> {
    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      throw this.handleError(error, 'Failed to get JIRA config');
    }

    return data as JiraSyncConfig;
  }

  /**
   * Get all projects with active JIRA sync configurations
   *
   * Returns projects that have:
   * - Active sync configuration (is_active = true)
   * - Valid API credentials (api_token_encrypted IS NOT NULL)
   * - Valid JIRA email (jira_email IS NOT NULL)
   */
  async getActiveProjects(): Promise<Array<{ project_id: string; project_name: string; jira_project_key: string; config: JiraSyncConfig }>> {
    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .select(`
        id,
        project_id,
        jira_project_key,
        jira_url,
        jira_email,
        api_token_encrypted,
        webhook_secret,
        default_issue_type,
        sync_direction,
        is_active,
        created_at,
        updated_at,
        created_by,
        project_knowledge_base!inner(name)
      `)
      .eq('is_active', true)
      .not('api_token_encrypted', 'is', null)
      .not('jira_email', 'is', null);

    if (error) {
      throw this.handleError(error, 'Failed to get active projects');
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: any) => ({
      project_id: row.project_id,
      project_name: row.project_knowledge_base?.name || 'Unknown Project',
      jira_project_key: row.jira_project_key,
      config: {
        id: row.id,
        project_id: row.project_id,
        jira_url: row.jira_url,
        jira_project_key: row.jira_project_key,
        jira_email: row.jira_email,
        api_token_encrypted: row.api_token_encrypted,
        webhook_secret: row.webhook_secret,
        default_issue_type: row.default_issue_type,
        sync_direction: row.sync_direction,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
      } as JiraSyncConfig,
    }));
  }

  /**
   * Create JIRA sync configuration
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
        default_issue_type: config.default_issue_type ?? 'Task',
        sync_direction: config.sync_direction ?? 'bidirectional',
        is_active: config.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to create JIRA config');
    }

    return data as JiraSyncConfig;
  }

  /**
   * Update JIRA sync configuration
   */
  async updateConfig(id: string, updates: Partial<JiraSyncConfig>): Promise<JiraSyncConfig> {
    const { data, error } = await this.supabase
      .from('jira_sync_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to update JIRA config');
    }

    return data as JiraSyncConfig;
  }

  /**
   * Deactivate JIRA sync configuration
   */
  async deactivateConfig(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('jira_sync_config')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw this.handleError(error, 'Failed to deactivate JIRA config');
    }
  }

  // ========== Field Mapping Operations ==========

  /**
   * Get field mapping by ID
   */
  async getFieldMapping(id: string): Promise<JiraFieldMapping | null> {
    const { data, error } = await this.supabase
      .from('jira_field_mappings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get field mapping');
    }

    return data as JiraFieldMapping;
  }

  /**
   * Get all field mappings for a project
   */
  async getFieldMappings(projectId: string): Promise<JiraFieldMapping[]> {
    const { data, error } = await this.supabase
      .from('jira_field_mappings')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      throw this.handleError(error, 'Failed to get field mappings');
    }

    return (data as JiraFieldMapping[]) || [];
  }

  /**
   * Create field mapping
   */
  async createFieldMapping(mapping: JiraFieldMapping): Promise<JiraFieldMapping> {
    const { data, error } = await this.supabase
      .from('jira_field_mappings')
      .insert({
        project_id: mapping.project_id,
        mapping_name: mapping.mapping_name,
        dr_to_jira: mapping.dr_to_jira,
        jira_to_dr: mapping.jira_to_dr,
      })
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to create field mapping');
    }

    return data as JiraFieldMapping;
  }

  // ========== Sync Log Operations ==========

  /**
   * Create sync log entry
   */
  async createSyncLog(log: JiraSyncLog): Promise<JiraSyncLog> {
    const { data, error } = await this.supabase
      .from('jira_sync_log')
      .insert({
        project_id: log.project_id,
        task_id: log.task_id,
        jira_issue_key: log.jira_issue_key,
        operation: log.operation,
        direction: log.direction,
        status: log.status,
        error_message: log.error_message,
        retry_count: log.retry_count || 0,
        jira_api_request: log.jira_api_request,
        jira_api_response: log.jira_api_response,
      })
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to create sync log');
    }

    return data as JiraSyncLog;
  }

  /**
   * Update sync log entry
   */
  async updateSyncLog(id: string, updates: Partial<JiraSyncLog>): Promise<JiraSyncLog> {
    const { data, error } = await this.supabase
      .from('jira_sync_log')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to update sync log');
    }

    return data as JiraSyncLog;
  }

  /**
   * Get sync logs for a project with pagination
   */
  async getSyncLogs(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ logs: JiraSyncLog[]; total: number }> {
    const { data, error, count } = await this.supabase
      .from('jira_sync_log')
      .select('*', { count: 'exact' })
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

  /**
   * Get sync logs for a specific task
   */
  async getTaskSyncLogs(taskId: string): Promise<JiraSyncLog[]> {
    const { data, error } = await this.supabase
      .from('jira_sync_log')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });

    if (error) {
      throw this.handleError(error, 'Failed to get task sync logs');
    }

    return (data as JiraSyncLog[]) || [];
  }

  // ========== Task Operations ==========

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<DevTask | null> {
    const { data, error } = await this.supabase
      .from('dev_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get task');
    }

    return data as DevTask;
  }

  /**
   * Get tasks by project ID with optional filters
   *
   * @param projectId - The project ID to filter tasks by
   * @param filters - Optional filtering parameters
   * @param filters.status - Filter by task status (e.g., ['todo', 'in_progress'])
   * @param filters.syncStatus - Filter by JIRA sync status
   * @param filters.hasJiraIssue - Filter by whether task has JIRA issue linked
   * @param filters.updatedSince - ISO 8601 timestamp to filter tasks updated after this time.
   *                               Uses idx_dev_tasks_project_updated index for efficient temporal queries.
   *                               Example: '2025-01-01T00:00:00Z'
   * @param filters.excludeStatuses - Array of statuses to exclude from results.
   *                                  Useful for incremental sync to skip completed/cancelled tasks.
   *                                  Example: ['done', 'cancelled']
   * @returns Promise<DevTask[]> - Array of matching tasks
   */
  async getTasks(
    projectId: string,
    filters?: {
      status?: string[];
      syncStatus?: string[];
      hasJiraIssue?: boolean;
      updatedSince?: string;
      excludeStatuses?: string[];
    }
  ): Promise<DevTask[]> {
    // Validate updatedSince format if provided
    if (filters?.updatedSince) {
      const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      if (!iso8601Regex.test(filters.updatedSince)) {
        throw new JiraDbServiceError('updatedSince must be a valid ISO 8601 timestamp');
      }
    }

    // Validate excludeStatuses is array if provided
    if (filters?.excludeStatuses !== undefined && !Array.isArray(filters.excludeStatuses)) {
      throw new JiraDbServiceError('excludeStatuses must be an array of status strings');
    }

    let query = this.supabase
      .from('dev_tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null);

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

    // Temporal filtering - uses idx_dev_tasks_project_updated for fast queries
    if (filters?.updatedSince) {
      query = query.gte('updated_at', filters.updatedSince);
    }

    // Status exclusion - exclude completed/cancelled tasks from incremental sync
    if (filters?.excludeStatuses && filters.excludeStatuses.length > 0) {
      query = query.not('status', 'in', `(${filters.excludeStatuses.join(',')})`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw this.handleError(error, 'Failed to get tasks');
    }

    return (data as DevTask[]) || [];
  }

  /**
   * Update task JIRA sync data
   */
  async updateTaskJiraData(taskId: string, jiraData: UpdateTaskJiraData): Promise<DevTask> {
    const { data, error } = await this.supabase
      .from('dev_tasks')
      .update({
        ...jiraData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to update task JIRA data');
    }

    return data as DevTask;
  }

  /**
   * Get task by JIRA issue key
   */
  async getTaskByJiraKey(jiraIssueKey: string, projectId: string): Promise<DevTask | null> {
    const { data, error } = await this.supabase
      .from('dev_tasks')
      .select('*')
      .eq('jira_issue_key', jiraIssueKey)
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw this.handleError(error, 'Failed to get task by JIRA key');
    }

    return data as DevTask;
  }

  /**
   * Create a new DR-AI task from JIRA issue data
   *
   * Used when discovering new JIRA issues that don't have corresponding DR-AI tasks.
   * Maps JIRA fields to DR-AI task schema and creates the task with proper sync metadata.
   *
   * @param projectId - DR-AI project ID
   * @param jiraIssue - JIRA issue data from API
   * @param fieldMapping - Field mapping configuration for JIRA to DR-AI
   * @returns Promise<DevTask> - The created task
   */
  async createTaskFromJira(
    projectId: string,
    jiraIssue: any, // JiraIssue type from jira-client
    fieldMapping: Record<string, any>
  ): Promise<DevTask> {
    const mapping = fieldMapping.jira_to_dr || {};

    // Map JIRA issue type to DR-AI task type
    let taskType = 'enhancement'; // Default
    if (jiraIssue.fields.issuetype?.name && mapping.issuetype) {
      taskType = mapping.issuetype[jiraIssue.fields.issuetype.name] || 'enhancement';
    }

    // Map JIRA priority to DR-AI priority
    let priority = 'medium'; // Default
    if (jiraIssue.fields.priority?.name && mapping.priority) {
      priority = mapping.priority[jiraIssue.fields.priority.name] || 'medium';
    }

    // Map JIRA status to DR-AI status
    let status = 'todo'; // Default
    if (jiraIssue.fields.status?.name && mapping.status) {
      status = mapping.status[jiraIssue.fields.status.name] || 'todo';
    }

    // Extract description (JIRA uses ADF format, convert to plain text)
    let description = '';
    if (jiraIssue.fields.description) {
      description = typeof jiraIssue.fields.description === 'string'
        ? jiraIssue.fields.description
        : this.convertADFToPlainText(jiraIssue.fields.description);
    }

    const taskData = {
      project_id: projectId,
      title: jiraIssue.fields.summary,
      description: description || null,
      status: status,
      priority: priority,
      task_type: taskType,
      tags: jiraIssue.fields.labels || [],
      jira_issue_key: jiraIssue.key,
      jira_sync_status: 'synced',
      last_jira_sync: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('dev_tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) {
      throw this.handleError(error, 'Failed to create task from JIRA issue');
    }

    console.log(`Created DR-AI task ${data.id} from JIRA issue ${jiraIssue.key}`);
    return data as DevTask;
  }

  /**
   * Convert Atlassian Document Format (ADF) to plain text
   * Simplified conversion for task descriptions
   */
  private convertADFToPlainText(adf: any): string {
    if (!adf || !adf.content) return '';

    const extractText = (node: any): string => {
      if (node.type === 'text') {
        return node.text || '';
      }

      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('');
      }

      return '';
    };

    return adf.content.map((node: any) => {
      const text = extractText(node);
      // Add newlines for paragraphs and headings
      if (node.type === 'paragraph' || node.type === 'heading') {
        return text + '\n';
      }
      return text;
    }).join('').trim();
  }

  /**
   * Execute a transaction with multiple operations
   */
  async executeTransaction<T>(
    operations: Array<() => Promise<any>>
  ): Promise<T[]> {
    const results: T[] = [];

    // Note: Supabase doesn't support traditional transactions in Edge Functions
    // This is a sequential execution pattern
    for (const operation of operations) {
      try {
        const result = await operation();
        results.push(result);
      } catch (error) {
        // Rollback not available - log the error
        console.error('Transaction operation failed:', error);
        throw error;
      }
    }

    return results;
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
