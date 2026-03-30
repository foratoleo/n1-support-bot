export const TASK_STATUSES = ['todo', 'in_progress', 'testing', 'in_review', 'done', 'blocked', 'cancelled'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export interface StatusUpdateItem {
  task_id: string;
  status: TaskStatus;
}

export interface BatchStatusUpdateRequest {
  project_id: string;
  updates: StatusUpdateItem[];
}

export interface TaskUpdateResult {
  task_id: string;
  status: TaskStatus;
  success: boolean;
  error?: string;
}

export interface BatchStatusUpdateResponse {
  results: TaskUpdateResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}
