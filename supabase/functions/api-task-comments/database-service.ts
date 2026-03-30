import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  TaskComment,
  TaskCommentWithAuthor,
  CreateCommentRequest,
  SortParams,
  CommentUpdateDataWithTimestamp,
  AuthorInfo
} from './types.ts';
import { mapRequestToInsertData } from './data-mapper.ts';

// View name for optimized queries with author info
const VIEW_TASK_COMMENTS = 'view_task_comments_with_author';

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

  async validateTaskExists(projectId: string, taskId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('dev_tasks')
        .select('id')
        .eq('id', taskId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .single(),
      'validateTaskExists'
    );

    return !error && !!data;
  }

  async validateTeamMemberExists(projectId: string, memberId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('team_members')
        .select('id')
        .eq('id', memberId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .single(),
      'validateTeamMemberExists'
    );

    return !error && !!data;
  }

  async createComment(request: CreateCommentRequest): Promise<TaskComment> {
    const insertData = mapRequestToInsertData(request);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('task_comments')
        .insert(insertData)
        .select()
        .single(),
      'createComment'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as TaskComment;
  }

  async listComments(
    projectId: string,
    taskId: string,
    options: {
      pagination: { page: number; limit: number };
      sort?: SortParams;
    }
  ): Promise<{ comments: TaskCommentWithAuthor[]; totalCount: number }> {
    const { pagination, sort } = options;
    const { page, limit } = pagination;

    // Query the view - already filters deleted_at and includes author info
    let query = this.supabase
      .from(VIEW_TASK_COMMENTS)
      .select('*', { count: 'exact' })
      .eq('project_id', projectId)
      .eq('task_id', taskId);

    // Apply sorting (default is created_at DESC - newest first)
    const sortField = sort?.field || 'created_at';
    const sortOrder = sort?.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await executeWithTimeout(
      query,
      `listComments (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    // Map view rows to TaskCommentWithAuthor
    const comments = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToCommentWithAuthor(row)
    );

    return {
      comments,
      totalCount: count || 0
    };
  }

  async updateComment(
    projectId: string,
    commentId: string,
    authorId: string,
    updateData: CommentUpdateDataWithTimestamp
  ): Promise<TaskComment | null> {
    // UPDATE operations use the table directly
    // The where clause enforces author_id ownership - only author can update
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('task_comments')
        .update(updateData)
        .eq('id', commentId)
        .eq('project_id', projectId)
        .eq('author_id', authorId)
        .is('deleted_at', null)
        .select()
        .single(),
      'updateComment'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - either not found or unauthorized
        return null;
      }
      handleDatabaseError(error);
    }

    return data as TaskComment | null;
  }

  async getComment(projectId: string, commentId: string): Promise<TaskCommentWithAuthor | null> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_TASK_COMMENTS)
        .select('*')
        .eq('id', commentId)
        .eq('project_id', projectId)
        .single(),
      'getComment'
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

    return this.mapViewRowToCommentWithAuthor(data);
  }

  async commentExists(projectId: string, commentId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('task_comments')
        .select('id')
        .eq('id', commentId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .single(),
      'commentExists'
    );

    return !error && !!data;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a row from view_task_comments_with_author to TaskCommentWithAuthor structure
   */
  private mapViewRowToCommentWithAuthor(row: Record<string, unknown>): TaskCommentWithAuthor {
    // Build author object from view columns
    const author: AuthorInfo | null = row.author_id ? {
      id: row.author_id as string,
      name: row.author_name as string || '',
      email: row.author_email as string || '',
      avatar_url: row.author_avatar_url as string | null,
      headline: row.author_headline as string | null
    } : null;

    return {
      id: row.id as string,
      task_id: row.task_id as string,
      project_id: row.project_id as string,
      author_id: row.author_id as string,
      content: row.content as string,
      mentioned_members: row.mentioned_members as string[] || [],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: null, // View already filters deleted
      author
    };
  }
}
