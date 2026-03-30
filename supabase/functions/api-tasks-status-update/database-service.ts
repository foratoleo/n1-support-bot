import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { executeWithTimeout, handleDatabaseError } from '../_shared/database-utils.ts';
import { TaskStatus, TaskUpdateResult } from './types.ts';

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

  async updateTaskStatus(
    projectId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<TaskUpdateResult> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('dev_tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .select('id')
        .single(),
      `updateTaskStatus(${taskId})`
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return { task_id: taskId, status, success: false, error: 'Task not found' };
      }
      return { task_id: taskId, status, success: false, error: error.message };
    }

    if (!data) {
      return { task_id: taskId, status, success: false, error: 'Task not found' };
    }

    return { task_id: taskId, status, success: true };
  }
}
