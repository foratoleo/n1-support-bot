import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TeamMember, GetTeamMembersRequest, TaskStats } from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getTeamMembers(filters: GetTeamMembersRequest): Promise<{ members: TeamMember[]; totalCount: number }> {
    const { projectId, status = ['active'], profile, includeStats = false, page = 1, limit = 50 } = filters;
    const offset = (page - 1) * limit;

    const tableName = includeStats ? 'view_team_members_with_stats' : 'team_members';

    let query = this.supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (status.length > 0) {
      query = query.in('status', status);
    }

    if (profile && profile.length > 0) {
      query = query.in('profile', profile);
    }

    if (projectId) {
      const { data: projectMembers } = await this.supabase
        .from('project_team_members')
        .select('team_member_id')
        .eq('project_id', projectId);

      if (projectMembers) {
        const memberIds = projectMembers.map(pm => pm.team_member_id);
        query = query.in('id', memberIds);
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    const members = (data || []).map(row => this.transformMember(row, projectId, includeStats));

    return {
      members,
      totalCount: count || 0
    };
  }

  private transformMember(row: any, projectId: string | undefined, includeStats: boolean): TeamMember {
    const member: TeamMember = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      email: row.email,
      profile: row.profile,
      memberType: row.member_type,
      status: row.status,
      bio: row.bio,
      headline: row.headline,
      professionalSummary: row.professional_summary,
      avatarUrl: row.avatar_url,
      createdAt: row.created_at
    };

    if (includeStats && projectId && row.task_stats_by_project) {
      const projectStats = row.task_stats_by_project.find((stats: any) => stats.project_id === projectId);
      if (projectStats) {
        member.taskStats = {
          totalTasks: projectStats.total_tasks || 0,
          completedTasks: projectStats.completed_tasks || 0,
          inProgressTasks: projectStats.in_progress_tasks || 0,
          testingTasks: projectStats.testing_tasks || 0,
          inReviewTasks: projectStats.in_review_tasks || 0,
          todoTasks: projectStats.todo_tasks || 0,
          blockedTasks: projectStats.blocked_tasks || 0
        };
      }
    }

    return member;
  }
}
