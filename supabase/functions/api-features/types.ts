/** Valid feature status values */
export const FEATURE_STATUSES = ['draft', 'ready', 'in_progress', 'done'] as const;

/** Valid feature priority values */
export const FEATURE_PRIORITIES = ['low', 'medium', 'high', 'critical', 'urgent'] as const;

export type FeatureStatus = typeof FEATURE_STATUSES[number];
export type FeaturePriority = typeof FEATURE_PRIORITIES[number];

/** Definition of ready criterion for a feature */
export interface ReadyCriterion {
  id: string;
  description: string;
  completed: boolean;
}

/** Feature dependency linking to another feature */
export interface Dependency {
  id: string;
  feature_id: string;
  title: string;
  type: string;
}

/** Request payload for creating a new feature */
export interface CreateFeatureRequest {
  project_id: string;
  title: string;
  description?: string;
  backlog_item_id?: string;
  meeting_transcript_id?: string;
  status?: FeatureStatus;
  priority?: FeaturePriority;
  delivered_value?: string;
  ready_criteria?: ReadyCriterion[];
  dependencies?: Dependency[];
  notes?: string;
  story_points?: number;
  estimated_hours?: number;
  tags?: string[];
  position?: number;
  created_by?: string;
}

/** Feature entity with computed fields from view_features_list */
export interface Feature {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  backlog_item_id: string | null;
  meeting_transcript_id: string | null;
  status: FeatureStatus;
  priority: FeaturePriority;
  delivered_value: string | null;
  ready_criteria: ReadyCriterion[];
  dependencies: Dependency[];
  notes: string | null;
  story_points: number;
  estimated_hours: number | null;
  tags: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Title of linked backlog item (epic) */
  epic_title: string | null;
  /** Count of linked dev_tasks */
  task_count: number;
  /** Count of completed dev_tasks */
  completed_task_count: number;
  /** Count of linked documents */
  linked_documents_count: number;
  /** Count of linked sprints */
  linked_sprints_count: number;
  /** Count of active attachments */
  attachments_count: number;
}

export interface CreateFeatureResponse {
  feature: Feature;
}

/** Request payload for batch creating multiple features */
export interface BatchCreateFeatureRequest {
  project_id: string;
  items: Omit<CreateFeatureRequest, 'project_id'>[];
}

/** Response for batch create operation */
export interface BatchCreateFeatureResponse {
  features: Feature[];
  count: number;
}

export const FEATURE_ACTIONS = ['create', 'create_batch', 'get', 'list', 'update', 'delete'] as const;
export type FeatureAction = typeof FEATURE_ACTIONS[number];

export const SORT_FIELDS = ['position', 'created_at', 'priority', 'story_points', 'status'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

export interface GetFeatureRequest {
  action: 'get';
  project_id: string;
  feature_id: string;
}

export interface GetFeatureResponse {
  feature: Feature;
}

/** Filter options for listing features */
export interface ListFilters {
  status?: FeatureStatus[];
  priority?: FeaturePriority[];
  tags?: string[];
  backlog_item_id?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  field: SortField;
  order: SortOrder;
}

export interface ListFeaturesRequest {
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

export interface ListFeaturesResponse {
  features: Feature[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

/** Partial update data for a feature */
export interface UpdateFeatureData {
  title?: string;
  description?: string | null;
  backlog_item_id?: string | null;
  meeting_transcript_id?: string | null;
  status?: FeatureStatus;
  priority?: FeaturePriority;
  delivered_value?: string | null;
  ready_criteria?: ReadyCriterion[];
  dependencies?: Dependency[];
  notes?: string | null;
  story_points?: number;
  estimated_hours?: number | null;
  tags?: string[];
  position?: number;
}

export interface FeatureUpdateData extends UpdateFeatureData {
  updated_at: string;
}

export interface UpdateFeatureRequest {
  action: 'update';
  project_id: string;
  feature_id: string;
  data: UpdateFeatureData;
}

export interface UpdateFeatureResponse {
  feature: Feature;
}

export interface DeleteFeatureRequest {
  action: 'delete';
  project_id: string;
  feature_id: string;
}

export interface DeleteFeatureResponse {
  success: boolean;
  message: string;
}

export type FeatureRequest =
  | (CreateFeatureRequest & { action?: 'create' })
  | (BatchCreateFeatureRequest & { action: 'create_batch' })
  | GetFeatureRequest
  | ListFeaturesRequest
  | UpdateFeatureRequest
  | DeleteFeatureRequest;
