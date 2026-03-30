/**
 * Database Service for get-backlog-normalized-record Edge Function
 *
 * Fetches backlog item data from multiple views and combines them into a complete record.
 *
 * @module get-backlog-normalized-record/database-service
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  BacklogItemFullDetail,
  BacklogItemFeature,
  BacklogItemTask,
  NormalizedBacklogItemData
} from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Fetches complete normalized backlog item data from all views
   */
  async getNormalizedBacklogItemData(
    projectId: string,
    backlogItemId: string
  ): Promise<NormalizedBacklogItemData | null> {
    // Fetch all data in parallel for optimal performance
    const [backlogItemResult, featuresResult, tasksResult] = await Promise.all([
      this.getBacklogItemFullDetail(projectId, backlogItemId),
      this.getBacklogItemFeatures(projectId, backlogItemId),
      this.getBacklogItemTasks(projectId, backlogItemId)
    ]);

    if (!backlogItemResult) {
      return null;
    }

    return {
      backlogItem: backlogItemResult,
      features: featuresResult,
      tasks: tasksResult
    };
  }

  /**
   * Fetches backlog item full detail from view_backlog_item_full_detail
   */
  private async getBacklogItemFullDetail(
    projectId: string,
    backlogItemId: string
  ): Promise<BacklogItemFullDetail | null> {
    const { data, error } = await this.supabase
      .from('view_backlog_item_full_detail')
      .select('*')
      .eq('backlog_item_id', backlogItemId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching backlog item full detail:', error);
      return null;
    }

    return data as BacklogItemFullDetail;
  }

  /**
   * Fetches features for the backlog item from view_backlog_item_features
   */
  private async getBacklogItemFeatures(
    projectId: string,
    backlogItemId: string
  ): Promise<BacklogItemFeature[]> {
    const { data, error } = await this.supabase
      .from('view_backlog_item_features')
      .select('*')
      .eq('backlog_item_id', backlogItemId)
      .eq('project_id', projectId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error fetching backlog item features:', error);
      return [];
    }

    return (data || []) as BacklogItemFeature[];
  }

  /**
   * Fetches tasks for the backlog item from view_backlog_item_tasks
   */
  private async getBacklogItemTasks(
    projectId: string,
    backlogItemId: string
  ): Promise<BacklogItemTask[]> {
    const { data, error } = await this.supabase
      .from('view_backlog_item_tasks')
      .select('*')
      .eq('backlog_item_id', backlogItemId)
      .eq('project_id', projectId)
      .order('feature_title', { ascending: true });

    if (error) {
      console.error('Error fetching backlog item tasks:', error);
      return [];
    }

    return (data || []) as BacklogItemTask[];
  }
}
