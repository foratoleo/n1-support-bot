import { TaskStatus } from '../_shared/validation.ts';

export interface UpdateTaskStatusRequest {
  projectId: string;
  taskId: string;
  status: TaskStatus;
  actualHours?: number;
}

export interface SprintInfo {
  id: string;
  name: string;
}

export interface UpdateTaskStatusResponse {
  id: string;
  title: string;
  previousStatus: TaskStatus;
  currentStatus: TaskStatus;
  actualHours: number | null;
  updatedAt: string;
  sprint: SprintInfo | null;
}
