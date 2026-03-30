import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  Feature,
  CreateFeatureRequest,
  FeatureStatus,
  ListFilters,
  SortParams,
  FeatureUpdateData
} from './types.ts';
import { mapCreateRequestToInsertData } from './data-mapper.ts';

const VIEW_FEATURES_LIST = 'view_features_list';

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

  async calculateNextPosition(projectId: string, status: FeatureStatus = 'draft'): Promise<number> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('features')
        .select('position')
        .eq('project_id', projectId)
        .eq('status', status)
        .is('deleted_at', null)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle(),
      'calculateNextPosition'
    );

    if (error) {
      throw error;
    }

    return data ? data.position + 1 : 0;
  }

  async createFeature(request: CreateFeatureRequest): Promise<Feature> {
    const status = (request.status || 'draft') as FeatureStatus;
    const position = request.position ?? await this.calculateNextPosition(request.project_id, status);
    const insertData = mapCreateRequestToInsertData(request, position);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('features')
        .insert(insertData)
        .select()
        .single(),
      'createFeature'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return this.enrichFeatureWithViewData(data.id, request.project_id);
  }

  /**
   * Creates multiple features in a single batch operation
   * Automatically calculates positions per status group
   */
  async createFeatures(
    projectId: string,
    items: Omit<CreateFeatureRequest, 'project_id'>[]
  ): Promise<Feature[]> {
    const statusGroups = await this.buildStatusPositionMap(projectId, items);
    const insertData = this.buildBatchInsertData(items, projectId, statusGroups);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('features')
        .insert(insertData)
        .select(),
      `createFeatures (${items.length} items)`
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as Feature[];
  }

  private async buildStatusPositionMap(
    projectId: string,
    items: Omit<CreateFeatureRequest, 'project_id'>[]
  ): Promise<Map<FeatureStatus, number>> {
    const statusGroups = new Map<FeatureStatus, number>();

    for (const item of items) {
      const itemStatus = (item.status || 'draft') as FeatureStatus;
      if (!statusGroups.has(itemStatus)) {
        statusGroups.set(itemStatus, await this.calculateNextPosition(projectId, itemStatus));
      }
    }

    return statusGroups;
  }

  private buildBatchInsertData(
    items: Omit<CreateFeatureRequest, 'project_id'>[],
    projectId: string,
    statusGroups: Map<FeatureStatus, number>
  ): ReturnType<typeof mapCreateRequestToInsertData>[] {
    const positionCounters = new Map<FeatureStatus, number>();

    // Initialize counters with starting positions from statusGroups
    for (const [status, startPos] of statusGroups) {
      positionCounters.set(status, startPos);
    }

    return items.map(item => {
      const itemStatus = (item.status || 'draft') as FeatureStatus;
      const position = item.position ?? positionCounters.get(itemStatus)!;

      // Increment counter for next item with same status
      if (item.position === undefined) {
        positionCounters.set(itemStatus, position + 1);
      }

      return mapCreateRequestToInsertData(
        { ...item, project_id: projectId },
        position
      );
    });
  }

  async getFeature(projectId: string, featureId: string): Promise<Feature | null> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_FEATURES_LIST)
        .select('*')
        .eq('id', featureId)
        .eq('project_id', projectId)
        .single(),
      'getFeature'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return this.mapViewRowToFeature(data);
  }

  async listFeatures(
    projectId: string,
    options: {
      filters?: ListFilters;
      pagination: { page: number; limit: number };
      sort?: SortParams;
    }
  ): Promise<{ items: Feature[]; totalCount: number }> {
    const { filters, pagination, sort } = options;
    const { page, limit } = pagination;

    let query = this.supabase
      .from(VIEW_FEATURES_LIST)
      .select('*', { count: 'exact' })
      .eq('project_id', projectId);

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.priority && filters.priority.length > 0) {
      query = query.in('priority', filters.priority);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }
    if (filters?.backlog_item_id) {
      query = query.eq('backlog_item_id', filters.backlog_item_id);
    }

    const sortField = sort?.field || 'position';
    const sortOrder = sort?.order || 'asc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await executeWithTimeout(
      query,
      `listFeatures (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    const items = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToFeature(row)
    );

    return {
      items,
      totalCount: count || 0
    };
  }

  async updateFeature(
    projectId: string,
    featureId: string,
    updateData: FeatureUpdateData
  ): Promise<Feature | null> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('features')
        .update(updateData)
        .eq('id', featureId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .select()
        .single(),
      'updateFeature'
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

    return this.enrichFeatureWithViewData(featureId, projectId);
  }

  async deleteFeature(projectId: string, featureId: string): Promise<boolean> {
    const { data: existingFeature } = await executeWithTimeout(
      this.supabase
        .from('features')
        .select('id')
        .eq('id', featureId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .single(),
      'checkFeatureExists'
    );

    if (!existingFeature) {
      return false;
    }

    const { error } = await executeWithTimeout(
      this.supabase
        .from('features')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', featureId)
        .eq('project_id', projectId),
      'deleteFeature'
    );

    if (error) {
      handleDatabaseError(error);
    }

    return true;
  }

  private async enrichFeatureWithViewData(featureId: string, projectId: string): Promise<Feature> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_FEATURES_LIST)
        .select('*')
        .eq('id', featureId)
        .eq('project_id', projectId)
        .single(),
      'enrichFeatureWithViewData'
    );

    if (error) {
      handleDatabaseError(error);
    }

    return this.mapViewRowToFeature(data);
  }

  private mapViewRowToFeature(row: Record<string, unknown>): Feature {
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      description: row.description as string | null,
      backlog_item_id: row.backlog_item_id as string | null,
      meeting_transcript_id: row.meeting_transcript_id as string | null,
      status: row.status as Feature['status'],
      priority: row.priority as Feature['priority'],
      delivered_value: row.delivered_value as string | null,
      ready_criteria: row.ready_criteria as Feature['ready_criteria'],
      dependencies: row.dependencies as Feature['dependencies'],
      notes: row.notes as string | null,
      story_points: row.story_points as number,
      estimated_hours: row.estimated_hours as number | null,
      tags: row.tags as string[],
      position: row.position as number,
      created_by: row.created_by as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: null,
      epic_title: row.epic_title as string | null,
      task_count: row.task_count as number,
      completed_task_count: row.completed_task_count as number,
      linked_documents_count: row.linked_documents_count as number,
      linked_sprints_count: row.linked_sprints_count as number,
      attachments_count: row.attachments_count as number
    };
  }
}
