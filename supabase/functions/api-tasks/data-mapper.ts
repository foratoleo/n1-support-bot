import {
  CreateTaskRequest,
  TaskStatus,
  TaskPriority,
  TaskType,
  UpdateTaskData,
  TaskUpdateData
} from './types.ts';

export interface TaskInsertData {
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: TaskType;
  story_points: number;
  estimated_hours: number;
  actual_hours: number;
  component_area: string | null;
  tags: string[];
  dependencies: unknown[];
  ai_metadata: Record<string, unknown>;
  parent_task_id: string | null;
  assigned_to: string | null;
  sprint_id: string | null;
  generated_from_interaction_id: string | null;
  created_by: string | null;
  feature_id: string | null;
}

export function mapRequestToInsertData(request: CreateTaskRequest): TaskInsertData {
  return {
    project_id: request.project_id,
    title: request.title,
    description: request.description ?? null,
    status: (request.status || 'todo') as TaskStatus,
    priority: (request.priority || 'medium') as TaskPriority,
    task_type: (request.task_type || 'feature') as TaskType,
    story_points: request.story_points ?? 0,
    estimated_hours: request.estimated_hours ?? 0,
    actual_hours: request.actual_hours ?? 0,
    component_area: request.component_area ?? null,
    tags: request.tags ?? [],
    dependencies: request.dependencies ?? [],
    ai_metadata: request.ai_metadata ?? {},
    parent_task_id: request.parent_task_id ?? null,
    assigned_to: request.assigned_to ?? null,
    sprint_id: request.sprint_id ?? null,
    generated_from_interaction_id: request.generated_from_interaction_id ?? null,
    created_by: request.created_by ?? null,
    feature_id: request.feature_id ?? null
  };
}

export function mapUpdateRequestToData(data: UpdateTaskData): TaskUpdateData {
  const updateData: TaskUpdateData = {
    updated_at: new Date().toISOString()
  };

  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.priority !== undefined) {
    updateData.priority = data.priority;
  }
  if (data.task_type !== undefined) {
    updateData.task_type = data.task_type;
  }
  if (data.story_points !== undefined) {
    updateData.story_points = data.story_points;
  }
  if (data.estimated_hours !== undefined) {
    updateData.estimated_hours = data.estimated_hours;
  }
  if (data.actual_hours !== undefined) {
    updateData.actual_hours = data.actual_hours;
  }
  if (data.component_area !== undefined) {
    updateData.component_area = data.component_area;
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }
  if (data.dependencies !== undefined) {
    updateData.dependencies = data.dependencies;
  }
  if (data.ai_metadata !== undefined) {
    updateData.ai_metadata = data.ai_metadata;
  }
  if (data.parent_task_id !== undefined) {
    updateData.parent_task_id = data.parent_task_id;
  }
  if (data.assigned_to !== undefined) {
    updateData.assigned_to = data.assigned_to;
  }
  if (data.sprint_id !== undefined) {
    updateData.sprint_id = data.sprint_id;
  }
  if (data.feature_id !== undefined) {
    updateData.feature_id = data.feature_id;
  }

  return updateData;
}
