export const SPRINT_STATUSES = ['planning', 'active', 'completed', 'cancelled'] as const;

export type SprintStatus = typeof SPRINT_STATUSES[number];

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: SprintStatus;
  goals: string[];
  planned_points: number | null;
  completed_points: number | null;
  velocity: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SprintTaskStats {
  total_tasks: number;
  total_points: number;
  points_by_status: Record<string, number>;
}

export interface SprintWithStats extends Sprint {
  task_stats: SprintTaskStats;
}

// ============================================
// CREATE Request/Response
// ============================================

export interface CreateSprintRequest {
  project_id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  status?: SprintStatus;
  goals?: string[];
  planned_points?: number;
  completed_points?: number;
  velocity?: number;
  created_by?: string;
}

export interface CreateSprintResponse {
  sprint: Sprint;
}

// ============================================
// Action Types
// ============================================

export const SPRINT_ACTIONS = ['create', 'get', 'list', 'update'] as const;
export type SprintAction = typeof SPRINT_ACTIONS[number];

export const SORT_FIELDS = ['start_date', 'end_date', 'created_at', 'name'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

// ============================================
// GET Request/Response
// ============================================

export interface GetSprintRequest {
  action: 'get';
  project_id: string;
  sprint_id: string;
}

export interface GetSprintResponse {
  sprint: SprintWithStats;
}

// ============================================
// LIST Request/Response
// ============================================

export interface ListFilters {
  status?: SprintStatus[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  field: SortField;
  order: SortOrder;
}

export interface ListSprintsRequest {
  action: 'list';
  project_id: string;
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

export interface ListSprintsResponse {
  sprints: SprintWithStats[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

// ============================================
// UPDATE Request/Response
// ============================================

export interface UpdateSprintData {
  name?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string;
  status?: SprintStatus;
  goals?: string[];
  planned_points?: number | null;
  completed_points?: number | null;
  velocity?: number | null;
}

export interface SprintUpdateData extends UpdateSprintData {
  updated_at: string;
}

export interface UpdateSprintRequest {
  action: 'update';
  project_id: string;
  sprint_id: string;
  data: UpdateSprintData;
}

export interface UpdateSprintResponse {
  sprint: Sprint;
}

// ============================================
// Discriminated Union for All Requests
// ============================================

export type SprintRequest =
  | (CreateSprintRequest & { action?: 'create' })
  | GetSprintRequest
  | ListSprintsRequest
  | UpdateSprintRequest;
