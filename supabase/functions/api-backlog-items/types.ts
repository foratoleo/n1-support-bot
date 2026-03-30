export const BACKLOG_STATUSES = ['draft', 'ready', 'in_refinement', 'approved'] as const;
export const BACKLOG_PRIORITIES = ['low', 'medium', 'high', 'critical', 'urgent'] as const;

export type BacklogStatus = typeof BACKLOG_STATUSES[number];
export type BacklogPriority = typeof BACKLOG_PRIORITIES[number];

export interface AcceptanceCriterion {
  id: string;
  description: string;
  completed: boolean;
}

export interface CreateBacklogItemRequest {
  project_id: string;
  title: string;
  description?: string;
  acceptance_criteria?: AcceptanceCriterion[];
  story_points?: number;
  priority?: BacklogPriority;
  business_value?: number;
  technical_complexity?: number;
  tags?: string[];
  status?: BacklogStatus;
  position?: number;
  created_by?: string;
}

export interface BatchCreateRequest {
  project_id: string;
  items: Omit<CreateBacklogItemRequest, 'project_id'>[];
}

export interface BacklogItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  acceptance_criteria: AcceptanceCriterion[];
  story_points: number;
  priority: BacklogPriority;
  business_value: number | null;
  technical_complexity: number | null;
  tags: string[];
  status: BacklogStatus;
  position: number;
  converted_task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateBacklogItemResponse {
  item: BacklogItem;
}

export interface BatchCreateResponse {
  items: BacklogItem[];
  count: number;
}

// ============================================
// Action Types
// ============================================

export const BACKLOG_ACTIONS = ['create', 'create_batch', 'get', 'list', 'update'] as const;
export type BacklogItemAction = typeof BACKLOG_ACTIONS[number];

export const SORT_FIELDS = ['position', 'created_at', 'priority', 'story_points'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

// ============================================
// GET Request/Response
// ============================================

export interface GetBacklogItemRequest {
  action: 'get';
  project_id: string;
  item_id: string;
}

export interface GetBacklogItemResponse {
  item: BacklogItem;
}

// ============================================
// LIST Request/Response
// ============================================

export interface ListFilters {
  status?: BacklogStatus[];
  priority?: BacklogPriority[];
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

export interface ListBacklogItemsRequest {
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

export interface ListBacklogItemsResponse {
  items: BacklogItem[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

// ============================================
// UPDATE Request/Response
// ============================================

export interface UpdateBacklogItemData {
  title?: string;
  description?: string | null;
  acceptance_criteria?: AcceptanceCriterion[];
  story_points?: number;
  priority?: BacklogPriority;
  business_value?: number | null;
  technical_complexity?: number | null;
  tags?: string[];
  status?: BacklogStatus;
  position?: number;
}

export interface BacklogItemUpdateData extends UpdateBacklogItemData {
  updated_at: string;
}

export interface UpdateBacklogItemRequest {
  action: 'update';
  project_id: string;
  item_id: string;
  data: UpdateBacklogItemData;
}

export interface UpdateBacklogItemResponse {
  item: BacklogItem;
}

// ============================================
// Discriminated Union for All Requests
// ============================================

export type BacklogItemRequest =
  | (CreateBacklogItemRequest & { action?: 'create' })
  | (BatchCreateRequest & { action?: 'create_batch' })
  | GetBacklogItemRequest
  | ListBacklogItemsRequest
  | UpdateBacklogItemRequest;
