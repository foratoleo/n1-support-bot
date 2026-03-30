import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AssignTaskResponse, AssignedToInfo } from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async assignTask(projectId: string, taskId: string, assignedTo: string | null): Promise<AssignTaskResponse | null> {
    const { data: task, error: taskError } = await this.supabase
      .from('dev_tasks')
      .select('id, title, assigned_to, project_id')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .single();

    if (taskError || !task) {
      return null;
    }

    const previousAssignedToId = task.assigned_to;

    if (assignedTo) {
      const memberValid = await this.validateMember(assignedTo);
      if (!memberValid) {
        throw new Error('INVALID_MEMBER');
      }
    }

    const { error: updateError } = await this.supabase
      .from('dev_tasks')
      .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (updateError) {
      throw new Error('UPDATE_FAILED');
    }

    const [previousAssignedTo, newAssignedTo] = await Promise.all([
      this.getMemberInfo(previousAssignedToId),
      this.getMemberInfo(assignedTo)
    ]);

    return {
      id: task.id,
      title: task.title,
      assignedTo: newAssignedTo,
      previousAssignedTo,
      updatedAt: new Date().toISOString()
    };
  }

  private async validateMember(memberId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('team_members')
      .select('id, status')
      .eq('id', memberId)
      .is('deleted_at', null)
      .single();

    return data?.status === 'active';
  }

  private async getMemberInfo(memberId: string | null): Promise<AssignedToInfo | null> {
    if (!memberId) return null;

    const { data } = await this.supabase
      .from('team_members')
      .select('id, name, slug')
      .eq('id', memberId)
      .is('deleted_at', null)
      .single();

    return data;
  }
}
