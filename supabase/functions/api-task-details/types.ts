import { TaskStatus } from '../_shared/validation.ts';

export interface GetTaskDetailsRequest {
  projectId: string;
  taskId: string;
}

export interface AssignedToInfo {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
}

export interface SprintInfo {
  id: string;
  name: string;
  status: string;
}

export interface ParentTaskInfo {
  id: string;
  title: string;
}

export interface SubtaskInfo {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskDetails {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  taskType: string;
  storyPoints: number | null;
  estimatedHours: number | null;
  actualHours: number | null;
  componentArea: string | null;
  tags: string[];
  dependencies: any[];
  aiMetadata: any;
  projectId: string;
  parentTaskId: string | null;
  parentTask: ParentTaskInfo | null;
  subtasks: SubtaskInfo[];
  assignedTo: AssignedToInfo | null;
  sprint: SprintInfo | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
