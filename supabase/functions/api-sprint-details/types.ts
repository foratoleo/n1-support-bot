import { SprintStatus, TaskStatus } from '../_shared/validation.ts';

export interface GetSprintDetailsRequest {
  projectId: string;
  sprintId: string;
  includeTasks?: boolean;
}

export interface SprintStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  testingTasks: number;
  inReviewTasks: number;
  todoTasks: number;
  blockedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
  progressPercentage: number;
}

export interface AssignedToInfo {
  id: string;
  name: string;
  slug: string;
}

export interface SprintTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  storyPoints: number | null;
  assignedTo: AssignedToInfo | null;
}

export interface SprintDetails {
  id: string;
  name: string;
  description: string | null;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  projectId: string;
  plannedPoints: number | null;
  completedPoints: number | null;
  velocity: number | null;
  goals: string[];
  createdAt: string;
  updatedAt: string;
  stats: SprintStats;
  tasks?: SprintTask[];
}
