// ============================================
// Action Types
// ============================================

export const COMMENT_ACTIONS = ['create', 'list', 'update'] as const;
export type CommentAction = typeof COMMENT_ACTIONS[number];

export const SORT_FIELDS = ['created_at', 'updated_at'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

// ============================================
// Author Info Interface
// ============================================

export interface AuthorInfo {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  headline: string | null;
}

// ============================================
// Core Interfaces
// ============================================

export interface TaskComment {
  id: string;
  task_id: string;
  project_id: string;
  author_id: string;
  content: string;
  mentioned_members: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TaskCommentWithAuthor extends TaskComment {
  author: AuthorInfo | null;
}

// ============================================
// CREATE Request/Response
// ============================================

export interface CreateCommentRequest {
  action?: 'create';
  project_id: string;
  task_id: string;
  author_id: string;
  content: string;
  mentioned_members?: string[];
}

export interface CreateCommentResponse {
  comment: TaskCommentWithAuthor;
}

// ============================================
// LIST Request/Response
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  field: SortField;
  order: SortOrder;
}

export interface ListCommentsRequest {
  action: 'list';
  project_id: string;
  task_id: string;
  pagination?: PaginationParams;
  sort?: SortParams;
}

export interface ListFilters {
  task_id: string;
}

export interface PaginationMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListCommentsResponse {
  comments: TaskCommentWithAuthor[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

// ============================================
// UPDATE Request/Response
// ============================================

export interface CommentUpdateData {
  content: string;
  mentioned_members?: string[];
}

export interface CommentUpdateDataWithTimestamp extends CommentUpdateData {
  updated_at: string;
}

export interface UpdateCommentRequest {
  action: 'update';
  project_id: string;
  comment_id: string;
  author_id: string;
  data: CommentUpdateData;
}

export interface UpdateCommentResponse {
  comment: TaskCommentWithAuthor;
}

// ============================================
// Discriminated Union for All Requests
// ============================================

export type CommentRequest =
  | (CreateCommentRequest & { action?: 'create' })
  | ListCommentsRequest
  | UpdateCommentRequest;
