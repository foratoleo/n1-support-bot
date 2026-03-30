export interface GetTeamMembersRequest {
  projectId?: string;
  status?: string[];
  profile?: string[];
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
}

export interface TeamMember {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  profile: string;
  memberType: string;
  status: string;
  bio: string | null;
  headline: string | null;
  professionalSummary: string | null;
  avatarUrl: string | null;
  createdAt: string;
  taskStats?: TaskStats;
}

export interface AppliedFilters {
  projectId?: string;
  status?: string[];
  profile?: string[];
  includeStats: boolean;
}
