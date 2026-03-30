import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { UpdateTaskStatusResponse, SprintInfo } from './types.ts';
import { TaskStatus } from '../_shared/validation.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async updateTaskStatus(
    projectId: string,
    taskId: string,
    newStatus: TaskStatus,
    actualHours?: number
  ): Promise<UpdateTaskStatusResponse | null> {
    const { data: task, error: taskError } = await this.supabase
      .from('dev_tasks')
      .select('id, title, status, sprint_id, project_id')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();

    if (taskError || !task) {
      return null;
    }

    const previousStatus = task.status;
    const updateData: any = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (actualHours !== undefined) {
      updateData.actual_hours = actualHours;
    }

    const { error: updateError } = await this.supabase
      .from('dev_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (updateError) {
      throw new Error('UPDATE_FAILED');
    }

    const sprint = await this.getSprintInfo(task.sprint_id);

    return {
      id: task.id,
      title: task.title,
      previousStatus,
      currentStatus: newStatus,
      actualHours: actualHours ?? null,
      updatedAt: new Date().toISOString(),
      sprint
    };
  }

  private async getSprintInfo(sprintId: string | null): Promise<SprintInfo | null> {
    if (!sprintId) return null;

    const { data } = await this.supabase
      .from('sprints')
      .select('id, name')
      .eq('id', sprintId)
      .is('deleted_at', null)
      .single();

    return data;
  }
}
