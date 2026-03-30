import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Sprint, GetSprintsRequest } from './types.ts';
import { SprintStatus } from '../_shared/validation.ts';

const QUERY_TIMEOUT = 10000;

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getSprints(filters: GetSprintsRequest): Promise<{ sprints: Sprint[]; totalCount: number }> {
    const { projectId, status, includeStats = false, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const tableName = includeStats ? 'view_sprints_with_stats' : 'sprints';

    let query = this.supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status.length > 0) {
      query = query.in('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const sprints = (data || []).map(row => this.transformSprint(row, includeStats));

    return {
      sprints,
      totalCount: count || 0
    };
  }

  private transformSprint(row: any, includeStats: boolean): Sprint {
    const sprint: Sprint = {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      plannedPoints: row.planned_points,
      completedPoints: row.completed_points,
      velocity: row.velocity,
      goals: row.goals || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    if (includeStats) {
      sprint.taskStats = {
        totalTasks: row.total_tasks || 0,
        completedTasks: row.completed_tasks || 0,
        inProgressTasks: row.in_progress_tasks || 0,
        testingTasks: row.testing_tasks || 0,
        inReviewTasks: row.in_review_tasks || 0,
        todoTasks: row.todo_tasks || 0,
        blockedTasks: row.blocked_tasks || 0,
        totalStoryPoints: row.total_story_points || 0,
        completedStoryPoints: row.completed_story_points || 0
      };
    }

    return sprint;
  }
}
