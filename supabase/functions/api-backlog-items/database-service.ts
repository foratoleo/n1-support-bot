import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  BacklogItem,
  CreateBacklogItemRequest,
  BacklogStatus,
  ListFilters,
  SortParams,
  BacklogItemUpdateData
} from './types.ts';
import { mapRequestToInsertData, mapBatchItemToInsertData } from './data-mapper.ts';

// View name for optimized queries
const VIEW_API_BACKLOG_ITEMS = 'view_api_backlog_items';

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

  async calculateNextPosition(projectId: string, status: BacklogStatus = 'draft'): Promise<number> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('backlog_items')
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

  async createBacklogItem(request: CreateBacklogItemRequest): Promise<BacklogItem> {
    const status = (request.status || 'draft') as BacklogStatus;
    const position = request.position ?? await this.calculateNextPosition(request.project_id, status);
    const insertData = mapRequestToInsertData(request, position);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('backlog_items')
        .insert(insertData)
        .select()
        .single(),
      'createBacklogItem'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as BacklogItem;
  }

  async createBacklogItems(projectId: string, items: Omit<CreateBacklogItemRequest, 'project_id'>[]): Promise<BacklogItem[]> {
    const statusGroups = await this.buildStatusPositionMap(projectId, items);
    const insertData = this.buildBatchInsertData(items, projectId, statusGroups);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('backlog_items')
        .insert(insertData)
        .select(),
      `createBacklogItems (${items.length} items)`
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as BacklogItem[];
  }

  private async buildStatusPositionMap(
    projectId: string,
    items: Omit<CreateBacklogItemRequest, 'project_id'>[]
  ): Promise<Map<BacklogStatus, number>> {
    const statusGroups = new Map<BacklogStatus, number>();

    for (const item of items) {
      const itemStatus = (item.status || 'draft') as BacklogStatus;
      if (!statusGroups.has(itemStatus)) {
        statusGroups.set(itemStatus, await this.calculateNextPosition(projectId, itemStatus));
      }
    }

    return statusGroups;
  }

  private buildBatchInsertData(
    items: Omit<CreateBacklogItemRequest, 'project_id'>[],
    projectId: string,
    statusGroups: Map<BacklogStatus, number>
  ) {
    return items.map(item => {
      const itemStatus = (item.status || 'draft') as BacklogStatus;
      const currentPosition = statusGroups.get(itemStatus)!;
      const position = item.position ?? currentPosition;

      if (item.position === undefined) {
        statusGroups.set(itemStatus, currentPosition + 1);
      }

      return mapBatchItemToInsertData(item, projectId, position);
    });
  }

  async getBacklogItem(projectId: string, itemId: string): Promise<BacklogItem | null> {
    // Query the view for optimized read
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from(VIEW_API_BACKLOG_ITEMS)
        .select('*')
        .eq('id', itemId)
        .eq('project_id', projectId)
        .single(),
      'getBacklogItem'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return this.mapViewRowToBacklogItem(data);
  }

  async listBacklogItems(
    projectId: string,
    options: {
      filters?: ListFilters;
      pagination: { page: number; limit: number };
      sort?: SortParams;
    }
  ): Promise<{ items: BacklogItem[]; totalCount: number }> {
    const { filters, pagination, sort } = options;
    const { page, limit } = pagination;

    // Query the view - already filters deleted_at
    let query = this.supabase
      .from(VIEW_API_BACKLOG_ITEMS)
      .select('*', { count: 'exact' })
      .eq('project_id', projectId);

    // Apply filters
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }
    if (filters?.priority && filters.priority.length > 0) {
      query = query.in('priority', filters.priority);
    }
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // Apply sorting (view default is position ASC)
    const sortField = sort?.field || 'position';
    const sortOrder = sort?.order || 'asc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await executeWithTimeout(
      query,
      `listBacklogItems (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    // Map view rows to BacklogItem
    const items = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToBacklogItem(row)
    );

    return {
      items,
      totalCount: count || 0
    };
  }

  async updateBacklogItem(
    projectId: string,
    itemId: string,
    updateData: BacklogItemUpdateData
  ): Promise<BacklogItem | null> {
    // UPDATE operations use the table directly
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('backlog_items')
        .update(updateData)
        .eq('id', itemId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .select()
        .single(),
      'updateBacklogItem'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return data as BacklogItem | null;
  }

  async validateItemBelongsToProject(projectId: string, itemId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('backlog_items')
        .select('id')
        .eq('id', itemId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .single(),
      'validateItemBelongsToProject'
    );

    return !error && !!data;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a row from view_api_backlog_items to BacklogItem structure
   */
  private mapViewRowToBacklogItem(row: Record<string, unknown>): BacklogItem {
    return {
      id: row.id as string,
      project_id: row.project_id as string,
      title: row.title as string,
      description: row.description as string | null,
      acceptance_criteria: row.acceptance_criteria as BacklogItem['acceptance_criteria'],
      story_points: row.story_points as number,
      priority: row.priority as BacklogItem['priority'],
      business_value: row.business_value as number | null,
      technical_complexity: row.technical_complexity as number | null,
      tags: row.tags as string[],
      status: row.status as BacklogItem['status'],
      position: row.position as number,
      converted_task_id: row.converted_task_id as string | null,
      created_by: row.created_by as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      deleted_at: null // View already filters deleted
    };
  }
}
