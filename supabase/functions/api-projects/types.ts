// ============================================
// Project Status and Constants
// ============================================

export const PROJECT_ACTIONS = ['create', 'get', 'list', 'update'] as const;
export type ProjectAction = typeof PROJECT_ACTIONS[number];

export const SORT_FIELDS = ['name', 'created_at', 'updated_at'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

// ============================================
// Task Counts Interface
// ============================================

export interface TaskCounts {
  todo: number;
  in_progress: number;
  done: number;
  blocked: number;
  testing: number;
  in_review: number;
  cancelled: number;
}

// ============================================
// Active Sprint Info
// ============================================

export interface ActiveSprintInfo {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

// ============================================
// Project Stats Interface
// ============================================

export interface ProjectStats {
  team_member_count: number;
  active_sprint: ActiveSprintInfo | null;
  sprint_count: number;
  meeting_count: number;
  task_counts: TaskCounts;
}

export interface ProjectBasicStats {
  team_member_count: number;
  sprint_count: number;
}

// ============================================
// Project Interface
// ============================================

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string | null;
  tags: string[];
  context_data: Record<string, unknown>;
  is_active: boolean;
  owner: string | null;
  leaders_managers: unknown[];
  team_member_links: unknown[];
  git_repository_url: string | null;
  jira_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectWithStats extends Project {
  stats: ProjectStats;
}

export interface ProjectWithBasicStats extends Project {
  stats: ProjectBasicStats;
}

// ============================================
// CREATE Request/Response
// ============================================

export interface CreateProjectRequest {
  action?: 'create';
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  context_data?: Record<string, unknown>;
  is_active?: boolean;
  owner?: string;
  leaders_managers?: unknown[];
  team_member_links?: unknown[];
  git_repository_url?: string;
  jira_url?: string;
}

export interface CreateProjectResponse {
  project: Project;
}

// ============================================
// GET Request/Response
// ============================================

export interface GetProjectRequest {
  action: 'get';
  project_id: string;
}

export interface GetProjectResponse {
  project: ProjectWithStats;
}

// ============================================
// LIST Request/Response
// ============================================

export interface ListFilters {
  is_active?: boolean;
  category?: string;
  tags?: string[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  field: SortField;
  order: SortOrder;
}

export interface ListProjectsRequest {
  action: 'list';
  filters?: ListFilters;
  pagination?: PaginationParams;
  sort?: SortParams;
}

export interface PaginationMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListProjectsResponse {
  projects: ProjectWithBasicStats[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

// ============================================
// UPDATE Request/Response
// ============================================

export interface UpdateProjectData {
  name?: string;
  description?: string;
  category?: string | null;
  tags?: string[];
  context_data?: Record<string, unknown>;
  is_active?: boolean;
  owner?: string | null;
  leaders_managers?: unknown[];
  team_member_links?: unknown[];
  git_repository_url?: string | null;
  jira_url?: string | null;
}

export interface ProjectUpdateData extends UpdateProjectData {
  updated_at: string;
}

export interface UpdateProjectRequest {
  action: 'update';
  project_id: string;
  data: UpdateProjectData;
}

export interface UpdateProjectResponse {
  project: Project;
}

// ============================================
// Discriminated Union for All Requests
// ============================================

export type ProjectRequest =
  | (CreateProjectRequest & { action?: 'create' })
  | GetProjectRequest
  | ListProjectsRequest
  | UpdateProjectRequest;
