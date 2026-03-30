import { CreateFeatureRequest, FeatureStatus, UpdateFeatureData, FeatureUpdateData, ReadyCriterion, Dependency } from './types.ts';

export interface FeatureInsertData {
  project_id: string;
  title: string;
  description: string | null;
  backlog_item_id: string | null;
  meeting_transcript_id: string | null;
  status: FeatureStatus;
  priority: string;
  delivered_value: string | null;
  ready_criteria: ReadyCriterion[];
  dependencies: Dependency[];
  notes: string | null;
  story_points: number;
  estimated_hours: number | null;
  tags: string[];
  position: number;
  created_by: string | null;
}

export function mapCreateRequestToInsertData(
  request: CreateFeatureRequest,
  position: number
): FeatureInsertData {
  return {
    project_id: request.project_id,
    title: request.title,
    description: request.description ?? null,
    backlog_item_id: request.backlog_item_id ?? null,
    meeting_transcript_id: request.meeting_transcript_id ?? null,
    status: (request.status || 'draft') as FeatureStatus,
    priority: request.priority ?? 'medium',
    delivered_value: request.delivered_value ?? null,
    ready_criteria: request.ready_criteria ?? [],
    dependencies: request.dependencies ?? [],
    notes: request.notes ?? null,
    story_points: request.story_points ?? 0,
    estimated_hours: request.estimated_hours ?? null,
    tags: request.tags ?? [],
    position,
    created_by: request.created_by ?? null
  };
}

export function mapUpdateRequestToData(data: UpdateFeatureData): FeatureUpdateData {
  const updateData: FeatureUpdateData = {
    updated_at: new Date().toISOString()
  };

  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.backlog_item_id !== undefined) {
    updateData.backlog_item_id = data.backlog_item_id;
  }
  if (data.meeting_transcript_id !== undefined) {
    updateData.meeting_transcript_id = data.meeting_transcript_id;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.priority !== undefined) {
    updateData.priority = data.priority;
  }
  if (data.delivered_value !== undefined) {
    updateData.delivered_value = data.delivered_value;
  }
  if (data.ready_criteria !== undefined) {
    updateData.ready_criteria = data.ready_criteria;
  }
  if (data.dependencies !== undefined) {
    updateData.dependencies = data.dependencies;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }
  if (data.story_points !== undefined) {
    updateData.story_points = data.story_points;
  }
  if (data.estimated_hours !== undefined) {
    updateData.estimated_hours = data.estimated_hours;
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }
  if (data.position !== undefined) {
    updateData.position = data.position;
  }

  return updateData;
}
