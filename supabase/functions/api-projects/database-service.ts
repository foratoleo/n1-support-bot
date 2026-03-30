import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  Project,
  ProjectWithStats,
  ProjectWithBasicStats,
  CreateProjectRequest,
  ListFilters,
  SortParams,
  ProjectUpdateData,
  ProjectStats,
  ProjectBasicStats,
  TaskCounts,
  ActiveSprintInfo
} from './types.ts';
import { mapRequestToInsertData } from './data-mapper.ts';

// View name for optimized queries
const VIEW_API_PROJECTS = 'view_api_projects';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  // ============================================
  // CREATE Operations
  // ============================================

  async createProject(request: CreateProjectRequest): Promise<Project> {
    const insertData = mapRequestToInsertData(request);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('project_knowledge_base')
        .insert(insertData)
        .select()
        .single(),
      'createProject'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as Project;
  }

  // ============================================
  // GET Operations
  // ============================================

  async getProject(projectId: string): Promise<ProjectWithStats | null> {
    // Query the view which includes all stats
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_API_PROJECTS)
        .select('*')
        .eq('id', projectId)
        .single(),
      'getProject'
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

    return this.mapViewRowToProjectWithStats(data);
  }

  // ============================================
  // LIST Operations
  // ============================================

  async listProjects(options: {
    filters?: ListFilters;
    pagination: { page: number; limit: number };
    sort?: SortParams;
  }): Promise<{ projects: ProjectWithBasicStats[]; totalCount: number }> {
    const { filters, pagination, sort } = options;
    const { page, limit } = pagination;

    // Query the view - already filters deleted_at and includes stats
    let query = this.supabase
      .from(VIEW_API_PROJECTS)
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    if (filters?.category) {
      query = query.eq('category', filters.category);
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
      `listProjects (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    // Map view rows to ProjectWithBasicStats
    const projects = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToProjectWithBasicStats(row)
    );

    return {
      projects,
      totalCount: count || 0
    };
  }

  // ============================================
  // UPDATE Operations
  // ============================================

  async updateProject(
    projectId: string,
    updateData: ProjectUpdateData
  ): Promise<Project | null> {
    // UPDATE operations use the table directly
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('project_knowledge_base')
        .update(updateData)
        .eq('id', projectId)
        .is('deleted_at', null)
        .select()
        .single(),
      'updateProject'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return data as Project | null;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a row from view_api_projects to ProjectWithStats structure
   */
  private mapViewRowToProjectWithStats(row: Record<string, unknown>): ProjectWithStats {
    const statsRaw = row.stats as {
      team_member_count: number;
      sprint_count: number;
      meeting_count: number;
      active_sprint: ActiveSprintInfo | null;
      task_counts: TaskCounts;
    } | null;

    const stats: ProjectStats = {
      team_member_count: statsRaw?.team_member_count ?? 0,
      sprint_count: statsRaw?.sprint_count ?? 0,
      meeting_count: statsRaw?.meeting_count ?? 0,
      active_sprint: statsRaw?.active_sprint ?? null,
      task_counts: statsRaw?.task_counts ?? {
        todo: 0,
        in_progress: 0,
        done: 0,
        blocked: 0,
        testing: 0,
        in_review: 0,
        cancelled: 0
      }
    };

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      category: row.category as string | null,
      context_data: row.context_data as Record<string, unknown>,
      tags: row.tags as string[],
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: null, // View already filters deleted
      team_member_links: row.team_member_links as unknown[],
      jira_url: row.jira_url as string | null,
      git_repository_url: row.git_repository_url as string | null,
      leaders_managers: row.leaders_managers as unknown[],
      owner: row.owner as string | null,
      stats
    };
  }

  /**
   * Maps a row from view_api_projects to ProjectWithBasicStats structure
   */
  private mapViewRowToProjectWithBasicStats(row: Record<string, unknown>): ProjectWithBasicStats {
    const statsRaw = row.stats as {
      team_member_count: number;
      sprint_count: number;
    } | null;

    const stats: ProjectBasicStats = {
      team_member_count: statsRaw?.team_member_count ?? 0,
      sprint_count: statsRaw?.sprint_count ?? 0
    };

    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      category: row.category as string | null,
      context_data: row.context_data as Record<string, unknown>,
      tags: row.tags as string[],
      is_active: row.is_active as boolean,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: null, // View already filters deleted
      team_member_links: row.team_member_links as unknown[],
      jira_url: row.jira_url as string | null,
      git_repository_url: row.git_repository_url as string | null,
      leaders_managers: row.leaders_managers as unknown[],
      owner: row.owner as string | null,
      stats
    };
  }
}
