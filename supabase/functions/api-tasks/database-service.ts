import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  DevTask,
  DevTaskWithRelations,
  CreateTaskRequest,
  ListFilters,
  SortParams,
  TaskUpdateData
} from './types.ts';
import { mapRequestToInsertData } from './data-mapper.ts';

// View name for optimized queries
const VIEW_API_TASKS = 'view_api_tasks';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  async resolveEmailToMemberId(email: string): Promise<string | null> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('team_members')
        .select('id')
        .eq('email', email)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle(),
      'resolveEmailToMemberId'
    );

    if (error || !data) {
      console.log(`[api-tasks] No team member found for email: ${email}`);
      return null;
    }

    return data.id;
  }

  async validateProjectExists(projectId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('project_knowledge_base')
        .select('id')
        .eq('id', projectId)
        .is('deleted_at', null)
        .single(),
      'validateProjectExists'
    );

    return !error && !!data;
  }

  async createTask(request: CreateTaskRequest): Promise<DevTask> {
    const insertData = mapRequestToInsertData(request);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('dev_tasks')
        .insert(insertData)
        .select()
        .single(),
      'createTask'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as DevTask;
  }

  async getTask(projectId: string, taskId: string): Promise<DevTaskWithRelations | null> {
    // Query the view which includes all relations
    const { data: task, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_API_TASKS)
        .select('*')
        .eq('id', taskId)
        .eq('project_id', projectId)
        .single(),
      'getTask'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    if (!task) {
      return null;
    }

    // Map view columns to DevTaskWithRelations structure
    return this.mapViewRowToTaskWithRelations(task);
  }

  async listTasks(
    projectId: string,
    options: {
      filters?: ListFilters;
      pagination: { page: number; limit: number };
      sort?: SortParams;
    }
  ): Promise<{ tasks: DevTaskWithRelations[]; totalCount: number }> {
    const { filters, pagination, sort } = options;
    const { page, limit } = pagination;

    // Query the view - already filters deleted_at and includes relations
    let query = this.supabase
      .from(VIEW_API_TASKS)
      .select('*', { count: 'exact' })
      .eq('project_id', projectId);

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.priority && filters.priority.length > 0) {
      query = query.in('priority', filters.priority);
    }
    if (filters?.task_type && filters.task_type.length > 0) {
      query = query.in('task_type', filters.task_type);
    }
    if (filters?.sprint_id) {
      query = query.eq('sprint_id', filters.sprint_id);
    }
    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }
    if (filters?.parent_task_id) {
      query = query.eq('parent_task_id', filters.parent_task_id);
    }
    if (filters?.feature_id) {
      query = query.eq('feature_id', filters.feature_id);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // Apply sorting (view default is updated_at DESC)
    const sortField = sort?.field || 'updated_at';
    const sortOrder = sort?.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await executeWithTimeout(
      query,
      `listTasks (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    // Map view rows to DevTaskWithRelations
    const tasks = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToTaskWithRelations(row)
    );

    return {
      tasks,
      totalCount: count || 0
    };
  }

  async updateTask(
    projectId: string,
    taskId: string,
    updateData: TaskUpdateData
  ): Promise<DevTask | null> {
    // UPDATE operations use the table directly
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('dev_tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .select()
        .single(),
      'updateTask'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return data as DevTask | null;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a row from view_api_tasks to DevTaskWithRelations structure
   */
  private mapViewRowToTaskWithRelations(row: Record<string, unknown>): DevTaskWithRelations {
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      description: row.description as string | null,
      task_type: row.task_type as DevTaskWithRelations['task_type'],
      status: row.status as DevTaskWithRelations['status'],
      priority: row.priority as DevTaskWithRelations['priority'],
      tags: row.tags as string[],
      component_area: row.component_area as string | null,
      estimated_hours: row.estimated_hours as number,
      actual_hours: row.actual_hours as number,
      story_points: row.story_points as number,
      parent_task_id: row.parent_task_id as string | null,
      dependencies: row.dependencies as unknown[],
      generated_from_interaction_id: row.generated_from_interaction_id as string | null,
      ai_metadata: row.ai_metadata as Record<string, unknown>,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      created_by: row.created_by as string | null,
      assigned_to: row.assigned_to as string | null,
      sprint_id: row.sprint_id as string | null,
      jira_issue_key: row.jira_issue_key as string | null,
      jira_issue_id: row.jira_issue_id as string | null,
      jira_sync_status: row.jira_sync_status as string | null,
      jira_last_synced_at: row.jira_last_synced_at as string | null,
      jira_sync_enabled: row.jira_sync_enabled as boolean,
      last_jira_sync: row.last_jira_sync as string | null,
      feature_id: row.feature_id as string | null,
      deleted_at: null, // View already filters deleted
      // Relations from view (as JSON objects)
      assignee: row.assignee as DevTaskWithRelations['assignee'],
      sprint: row.sprint as DevTaskWithRelations['sprint'],
      parent_task: row.parent_task as DevTaskWithRelations['parent_task'],
      feature: row.feature as DevTaskWithRelations['feature'],
      subtasks_count: row.subtasks_count as number
    };
  }
}
