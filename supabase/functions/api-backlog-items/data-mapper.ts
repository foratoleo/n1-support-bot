import { CreateBacklogItemRequest, BacklogStatus, UpdateBacklogItemData, BacklogItemUpdateData } from './types.ts';

export interface BacklogItemInsertData {
  project_id: string;
  title: string;
  description: string | null;
  acceptance_criteria: unknown[];
  story_points: number;
  priority: string;
  business_value: number | null;
  technical_complexity: number | null;
  tags: string[];
  status: BacklogStatus;
  position: number;
  created_by: string | null;
}

export function mapRequestToInsertData(
  request: CreateBacklogItemRequest,
  position: number
): BacklogItemInsertData {
  return {
    project_id: request.project_id,
    title: request.title,
    description: request.description ?? null,
    acceptance_criteria: request.acceptance_criteria ?? [],
    story_points: request.story_points ?? 0,
    priority: request.priority ?? 'medium',
    business_value: request.business_value ?? null,
    technical_complexity: request.technical_complexity ?? null,
    tags: request.tags ?? [],
    status: (request.status || 'draft') as BacklogStatus,
    position,
    created_by: request.created_by ?? null
  };
}

export function mapBatchItemToInsertData(
  item: Omit<CreateBacklogItemRequest, 'project_id'>,
  projectId: string,
  position: number
): BacklogItemInsertData {
  return {
    project_id: projectId,
    title: item.title,
    description: item.description ?? null,
    acceptance_criteria: item.acceptance_criteria ?? [],
    story_points: item.story_points ?? 0,
    priority: item.priority ?? 'medium',
    business_value: item.business_value ?? null,
    technical_complexity: item.technical_complexity ?? null,
    tags: item.tags ?? [],
    status: (item.status || 'draft') as BacklogStatus,
    position,
    created_by: item.created_by ?? null
  };
}

export function mapUpdateRequestToData(data: UpdateBacklogItemData): BacklogItemUpdateData {
  const updateData: BacklogItemUpdateData = {
    updated_at: new Date().toISOString()
  };

  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.acceptance_criteria !== undefined) {
    updateData.acceptance_criteria = data.acceptance_criteria;
  }
  if (data.story_points !== undefined) {
    updateData.story_points = data.story_points;
  }
  if (data.priority !== undefined) {
    updateData.priority = data.priority;
  }
  if (data.business_value !== undefined) {
    updateData.business_value = data.business_value;
  }
  if (data.technical_complexity !== undefined) {
    updateData.technical_complexity = data.technical_complexity;
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.position !== undefined) {
    updateData.position = data.position;
  }

  return updateData;
}
