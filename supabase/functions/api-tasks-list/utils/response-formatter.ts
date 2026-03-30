import { DevTask, ResponseMetadata, AppliedFilters, ErrorResponse } from '../types.ts';

export function formatSuccessResponse(
  tasks: any[],
  totalCount: number,
  currentPage: number,
  pageSize: number,
  appliedFilters: AppliedFilters
): { data: DevTask[]; metadata: ResponseMetadata } {
  const formattedTasks = tasks.map(transformTask);
  const totalPages = Math.ceil(totalCount / pageSize);

  const metadata: ResponseMetadata = {
    totalCount,
    currentPage,
    pageSize,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    appliedFilters
  };

  return { data: formattedTasks, metadata };
}

export function formatErrorResponse(
  code: string,
  message: string,
  requestId: string,
  retryable: boolean = true,
  details?: any
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      retryable
    },
    requestId,
    timestamp: new Date().toISOString()
  };
}

function transformTask(task: any): DevTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description || undefined,
    status: task.status,
    assignedTo: task.assigned_to && task.assigned_to.id ? task.assigned_to : null,
    tags: task.tags || [],
    priority: task.priority,
    estimatedHours: task.estimated_hours || null,
    actualHours: task.actual_hours || null,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    taskType: task.task_type || undefined,
    storyPoints: task.story_points || null,
    componentArea: task.component_area || null,
    sprint: task.sprint && task.sprint.id ? task.sprint : null,
    feature: task.feature && task.feature.id ? task.feature : null,
    parentTaskId: task.parent_task_id || null,
    dependencies: task.dependencies || undefined,
    aiMetadata: task.ai_metadata || undefined
  };
}

export function generateCacheKey(
  projectId: string,
  status: string[],
  assignedTo?: string,
  includeDescription?: boolean,
  page?: number,
  limit?: number
): string {
  const parts = [
    projectId,
    status.sort().join(','),
    assignedTo || 'all',
    includeDescription ? 'full' : 'light',
    `p${page || 1}`,
    `l${limit || 50}`
  ];
  return parts.join(':');
}
