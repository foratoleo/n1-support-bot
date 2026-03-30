/**
 * Database Service for get-task-normalized-record Edge Function
 *
 * Fetches task data from multiple views and combines them into a complete record.
 *
 * @module get-task-normalized-record/database-service
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  TaskFullDetail,
  TaskCommentDetail,
  TaskAttachmentDetail,
  TaskSubtask,
  NormalizedTaskData
} from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Fetches complete normalized task data from all views
   */
  async getNormalizedTaskData(
    projectId: string,
    taskId: string
  ): Promise<NormalizedTaskData | null> {
    // Fetch all data in parallel for optimal performance
    const [taskResult, commentsResult, attachmentsResult, subtasksResult] = await Promise.all([
      this.getTaskFullDetail(projectId, taskId),
      this.getTaskComments(projectId, taskId),
      this.getTaskAttachments(projectId, taskId),
      this.getTaskSubtasks(projectId, taskId)
    ]);

    if (!taskResult) {
      return null;
    }

    return {
      task: taskResult,
      comments: commentsResult,
      attachments: attachmentsResult,
      subtasks: subtasksResult
    };
  }

  /**
   * Fetches task full detail from view_task_full_detail
   */
  private async getTaskFullDetail(
    projectId: string,
    taskId: string
  ): Promise<TaskFullDetail | null> {
    const { data, error } = await this.supabase
      .from('view_task_full_detail')
      .select('*')
      .eq('task_id', taskId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching task full detail:', error);
      return null;
    }

    return data as TaskFullDetail;
  }

  /**
   * Fetches task comments from view_task_comments_detail
   */
  private async getTaskComments(
    projectId: string,
    taskId: string
  ): Promise<TaskCommentDetail[]> {
    const { data, error } = await this.supabase
      .from('view_task_comments_detail')
      .select('*')
      .eq('task_id', taskId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching task comments:', error);
      return [];
    }

    return (data || []) as TaskCommentDetail[];
  }

  /**
   * Fetches task attachments from view_task_attachments_detail
   */
  private async getTaskAttachments(
    projectId: string,
    taskId: string
  ): Promise<TaskAttachmentDetail[]> {
    const { data, error } = await this.supabase
      .from('view_task_attachments_detail')
      .select('*')
      .eq('task_id', taskId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching task attachments:', error);
      return [];
    }

    return (data || []) as TaskAttachmentDetail[];
  }

  /**
   * Fetches task subtasks from view_task_subtasks
   */
  private async getTaskSubtasks(
    projectId: string,
    taskId: string
  ): Promise<TaskSubtask[]> {
    const { data, error } = await this.supabase
      .from('view_task_subtasks')
      .select('*')
      .eq('parent_task_id', taskId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching task subtasks:', error);
      return [];
    }

    return (data || []) as TaskSubtask[];
  }
}
