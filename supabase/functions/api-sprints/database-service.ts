import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  Sprint,
  SprintWithStats,
  SprintTaskStats,
  CreateSprintRequest,
  ListFilters,
  SortParams,
  SprintUpdateData
} from './types.ts';
import { mapRequestToInsertData } from './data-mapper.ts';

// View name for optimized queries
const VIEW_API_SPRINTS = 'view_api_sprints';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
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

  async createSprint(request: CreateSprintRequest): Promise<Sprint> {
    const insertData = mapRequestToInsertData(request);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('sprints')
        .insert(insertData)
        .select()
        .single(),
      'createSprint'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as Sprint;
  }

  async getSprint(projectId: string, sprintId: string): Promise<SprintWithStats | null> {
    // Query the view which includes task_stats
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_API_SPRINTS)
        .select('*')
        .eq('id', sprintId)
        .eq('project_id', projectId)
        .single(),
      'getSprint'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    if (!data) {
      return null;
    }

    return this.mapViewRowToSprintWithStats(data);
  }

  async listSprints(
    projectId: string,
    options: {
      filters?: ListFilters;
      pagination: { page: number; limit: number };
      sort?: SortParams;
    }
  ): Promise<{ sprints: SprintWithStats[]; totalCount: number }> {
    const { filters, pagination, sort } = options;
    const { page, limit } = pagination;

    // Query the view - already filters deleted_at and includes task_stats
    let query = this.supabase
      .from(VIEW_API_SPRINTS)
      .select('*', { count: 'exact' })
      .eq('project_id', projectId);

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    // Apply sorting (view default is start_date DESC)
    const sortField = sort?.field || 'start_date';
    const sortOrder = sort?.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await executeWithTimeout(
      query,
      `listSprints (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    // Map view rows to SprintWithStats
    const sprints = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToSprintWithStats(row)
    );

    return {
      sprints,
      totalCount: count || 0
    };
  }

  async updateSprint(
    projectId: string,
    sprintId: string,
    updateData: SprintUpdateData
  ): Promise<Sprint | null> {
    // UPDATE operations use the table directly
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('sprints')
        .update(updateData)
        .eq('id', sprintId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .select()
        .single(),
      'updateSprint'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return data as Sprint | null;
  }

  async validateSprintBelongsToProject(projectId: string, sprintId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('sprints')
        .select('id')
        .eq('id', sprintId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .single(),
      'validateSprintBelongsToProject'
    );

    return !error && !!data;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a row from view_api_sprints to SprintWithStats structure
   */
  private mapViewRowToSprintWithStats(row: Record<string, unknown>): SprintWithStats {
    // Parse the task_stats JSON from the view
    const taskStatsRaw = row.task_stats as {
      total_tasks: number;
      total_points: number;
      points_by_status: Record<string, number>;
      counts_by_status?: Record<string, number>;
    } | null;

    const taskStats: SprintTaskStats = {
      total_tasks: taskStatsRaw?.total_tasks ?? 0,
      total_points: taskStatsRaw?.total_points ?? 0,
      points_by_status: taskStatsRaw?.points_by_status ?? {}
    };

    return {
      id: row.id as string,
      project_id: row.project_id as string,
      name: row.name as string,
      description: row.description as string | null,
      start_date: row.start_date as string,
      end_date: row.end_date as string,
      status: row.status as Sprint['status'],
      goals: row.goals as string[],
      planned_points: row.planned_points as number | null,
      completed_points: row.completed_points as number | null,
      velocity: row.velocity as number | null,
      created_by: row.created_by as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: null, // View already filters deleted
      task_stats: taskStats
    };
  }
}
