import { SprintStatus } from '../_shared/validation.ts';

export interface GetSprintsRequest {
  projectId: string;
  status?: SprintStatus[];
  includeStats?: boolean;
  page?: number;
  limit?: number;
}

export interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  testingTasks: number;
  inReviewTasks: number;
  todoTasks: number;
  blockedTasks: number;
  totalStoryPoints: number;
  completedStoryPoints: number;
}

export interface Sprint {
  id: string;
  name: string;
  description: string | null;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  plannedPoints: number | null;
  completedPoints: number | null;
  velocity: number | null;
  goals: string[];
  createdAt: string;
  updatedAt: string;
  taskStats?: TaskStats;
}

export interface AppliedFilters {
  status?: SprintStatus[];
  includeStats: boolean;
}
