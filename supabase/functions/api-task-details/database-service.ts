import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { TaskDetails } from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async getTaskDetails(projectId: string, taskId: string): Promise<TaskDetails | null> {
    const { data: task, error } = await this.supabase
      .from('dev_tasks')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        task_type,
        story_points,
        estimated_hours,
        actual_hours,
        component_area,
        tags,
        dependencies,
        ai_metadata,
        project_id,
        parent_task_id,
        created_by,
        created_at,
        updated_at,
        assigned_to_id:assigned_to,
        sprint_id
      `)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();

    if (error || !task) {
      return null;
    }

    const [assignedToData, sprintData, parentData, subtasksData] = await Promise.all([
      this.getAssignedTo(task.assigned_to_id),
      this.getSprint(task.sprint_id),
      this.getParentTask(task.parent_task_id),
      this.getSubtasks(taskId)
    ]);

    return {
      id: task.id,
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      taskType: task.task_type || '',
      storyPoints: task.story_points,
      estimatedHours: task.estimated_hours,
      actualHours: task.actual_hours,
      componentArea: task.component_area,
      tags: task.tags || [],
      dependencies: task.dependencies || [],
      aiMetadata: task.ai_metadata || {},
      projectId: task.project_id,
      parentTaskId: task.parent_task_id,
      parentTask: parentData,
      subtasks: subtasksData,
      assignedTo: assignedToData,
      sprint: sprintData,
      createdBy: task.created_by,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    };
  }

  private async getAssignedTo(assignedToId: string | null) {
    if (!assignedToId) return null;

    const { data } = await this.supabase
      .from('team_members')
      .select('id, name, slug, avatar_url')
      .eq('id', assignedToId)
      .is('deleted_at', null)
      .single();

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      avatarUrl: data.avatar_url
    };
  }

  private async getSprint(sprintId: string | null) {
    if (!sprintId) return null;

    const { data } = await this.supabase
      .from('sprints')
      .select('id, name, status')
      .eq('id', sprintId)
      .is('deleted_at', null)
      .single();

    return data;
  }

  private async getParentTask(parentTaskId: string | null) {
    if (!parentTaskId) return null;

    const { data } = await this.supabase
      .from('dev_tasks')
      .select('id, title')
      .eq('id', parentTaskId)
      .is('deleted_at', null)
      .single();

    return data;
  }

  private async getSubtasks(taskId: string) {
    const { data } = await this.supabase
      .from('dev_tasks')
      .select('id, title, status')
      .eq('parent_task_id', taskId)
      .is('deleted_at', null);

    return data || [];
  }
}
