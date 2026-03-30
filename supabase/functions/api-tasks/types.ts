export const TASK_STATUSES = ['todo', 'in_progress', 'testing', 'in_review', 'done', 'blocked', 'cancelled'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical', 'urgent'] as const;
export const TASK_TYPES = ['feature', 'bug', 'enhancement', 'technical_debt', 'research', 'documentation', 'testing', 'deployment', 'maintenance'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export type TaskType = typeof TASK_TYPES[number];

// ============================================
// Related Entity Interfaces
// ============================================

export interface AssigneeInfo {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  slug: string;
}

export interface SprintInfo {
  id: string;
  name: string;
  status: string;
}

export interface FeatureInfo {
  id: string;
  title: string;
}

export interface ParentTaskInfo {
  id: string;
  title: string;
}

// ============================================
// Core Interfaces
// ============================================

export interface DevTask {
  id: string;
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
  jira_issue_id: string | null;
  jira_issue_key: string | null;
  jira_sync_enabled: boolean;
  jira_sync_status: string | null;
  jira_last_synced_at: string | null;
  last_jira_sync: string | null;
  feature_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DevTaskWithRelations extends DevTask {
  assignee: AssigneeInfo | null;
  sprint: SprintInfo | null;
  parent_task: ParentTaskInfo | null;
  feature: FeatureInfo | null;
  subtasks_count: number;
}

// ============================================
// CREATE Request/Response
// ============================================

export interface CreateTaskRequest {
  project_id: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  task_type?: TaskType;
  story_points?: number;
  estimated_hours?: number;
  actual_hours?: number;
  component_area?: string;
  tags?: string[];
  dependencies?: unknown[];
  ai_metadata?: Record<string, unknown>;
  parent_task_id?: string;
  assigned_to?: string;
  sprint_id?: string;
  feature_id?: string;
  generated_from_interaction_id?: string;
  created_by?: string;
}

export interface CreateTaskResponse {
  task: DevTask;
}

// ============================================
// Action Types
// ============================================

export const TASK_ACTIONS = ['create', 'get', 'list', 'update'] as const;
export type TaskAction = typeof TASK_ACTIONS[number];

export const SORT_FIELDS = ['priority', 'created_at', 'story_points', 'updated_at', 'title'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

// ============================================
// GET Request/Response
// ============================================

export interface GetTaskRequest {
  action: 'get';
  project_id: string;
  task_id: string;
}

export interface GetTaskResponse {
  task: DevTaskWithRelations;
}

// ============================================
// LIST Request/Response
// ============================================

export interface ListFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  task_type?: TaskType[];
  sprint_id?: string;
  assigned_to?: string;
  assignee_email?: string;
  parent_task_id?: string;
  feature_id?: string;
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

export interface ListTasksRequest {
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

export interface ListTasksResponse {
  tasks: DevTaskWithRelations[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

// ============================================
// UPDATE Request/Response
// ============================================

export interface UpdateTaskData {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  task_type?: TaskType;
  story_points?: number;
  estimated_hours?: number;
  actual_hours?: number;
  component_area?: string | null;
  tags?: string[];
  dependencies?: unknown[];
  ai_metadata?: Record<string, unknown>;
  parent_task_id?: string | null;
  assigned_to?: string | null;
  sprint_id?: string | null;
  feature_id?: string | null;
}

export interface TaskUpdateData extends UpdateTaskData {
  updated_at: string;
}

export interface UpdateTaskRequest {
  action: 'update';
  project_id: string;
  task_id: string;
  data: UpdateTaskData;
}

export interface UpdateTaskResponse {
  task: DevTask;
}

// ============================================
// Discriminated Union for All Requests
// ============================================

export type TaskRequest =
  | (CreateTaskRequest & { action?: 'create' })
  | GetTaskRequest
  | ListTasksRequest
  | UpdateTaskRequest;
