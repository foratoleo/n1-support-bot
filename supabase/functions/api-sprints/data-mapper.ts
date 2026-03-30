import { CreateSprintRequest, SprintStatus, UpdateSprintData, SprintUpdateData } from './types.ts';

export interface SprintInsertData {
  project_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  goals: string[];
  planned_points: number;
  completed_points: number;
  velocity: number | null;
  created_by: string | null;
}

export function mapRequestToInsertData(request: CreateSprintRequest): SprintInsertData {
  return {
    project_id: request.project_id,
    name: request.name,
    description: request.description ?? null,
    start_date: request.start_date,
    end_date: request.end_date,
    status: (request.status || 'planning') as SprintStatus,
    goals: request.goals ?? [],
    planned_points: request.planned_points ?? 0,
    completed_points: request.completed_points ?? 0,
    velocity: request.velocity ?? null,
    created_by: request.created_by ?? null
  };
}

export function mapUpdateRequestToData(data: UpdateSprintData): SprintUpdateData {
  const updateData: SprintUpdateData = {
    updated_at: new Date().toISOString()
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.start_date !== undefined) {
    updateData.start_date = data.start_date;
  }
  if (data.end_date !== undefined) {
    updateData.end_date = data.end_date;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.goals !== undefined) {
    updateData.goals = data.goals;
  }
  if (data.planned_points !== undefined) {
    updateData.planned_points = data.planned_points;
  }
  if (data.completed_points !== undefined) {
    updateData.completed_points = data.completed_points;
  }
  if (data.velocity !== undefined) {
    updateData.velocity = data.velocity;
  }

  return updateData;
}
