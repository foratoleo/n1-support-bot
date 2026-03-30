import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SprintDetails, SprintTask, SprintStats } from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getSprintDetails(projectId: string, sprintId: string, includeTasks: boolean): Promise<SprintDetails | null> {
    const { data: sprint, error } = await this.supabase
      .from('view_sprints_with_stats')
      .select('*')
      .eq('id', sprintId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();

    if (error || !sprint) {
      return null;
    }

    const stats: SprintStats = {
      totalTasks: sprint.total_tasks || 0,
      completedTasks: sprint.completed_tasks || 0,
      inProgressTasks: sprint.in_progress_tasks || 0,
      testingTasks: sprint.testing_tasks || 0,
      inReviewTasks: sprint.in_review_tasks || 0,
      todoTasks: sprint.todo_tasks || 0,
      blockedTasks: sprint.blocked_tasks || 0,
      totalStoryPoints: sprint.total_story_points || 0,
      completedStoryPoints: sprint.completed_story_points || 0,
      progressPercentage: this.calculateProgress(sprint.completed_tasks || 0, sprint.total_tasks || 0)
    };

    const details: SprintDetails = {
      id: sprint.id,
      name: sprint.name,
      description: sprint.description,
      status: sprint.status,
      startDate: sprint.start_date,
      endDate: sprint.end_date,
      projectId: sprint.project_id,
      plannedPoints: sprint.planned_points,
      completedPoints: sprint.completed_points,
      velocity: sprint.velocity,
      goals: sprint.goals || [],
      createdAt: sprint.created_at,
      updatedAt: sprint.updated_at,
      stats
    };

    if (includeTasks) {
      details.tasks = await this.getSprintTasks(sprintId);
    }

    return details;
  }

  private async getSprintTasks(sprintId: string): Promise<SprintTask[]> {
    const { data: tasks } = await this.supabase
      .from('dev_tasks')
      .select(`
        id,
        title,
        status,
        priority,
        story_points,
        assigned_to
      `)
      .eq('sprint_id', sprintId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (!tasks) return [];

    const tasksWithAssignees = await Promise.all(
      tasks.map(async (task) => {
        const assignedTo = task.assigned_to ? await this.getMemberInfo(task.assigned_to) : null;

        return {
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          storyPoints: task.story_points,
          assignedTo
        };
      })
    );

    return tasksWithAssignees;
  }

  private async getMemberInfo(memberId: string) {
    const { data } = await this.supabase
      .from('team_members')
      .select('id, name, slug')
      .eq('id', memberId)
      .is('deleted_at', null)
      .single();

    return data;
  }

  private calculateProgress(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }
}
