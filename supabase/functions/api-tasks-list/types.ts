export interface GetTasksRequest {
  projectId: string;
  status?: string[];
  assignedTo?: string;
  assigneeEmail?: string;
  includeDescription?: boolean;
  page?: number;
  limit?: number;
}

export interface GetTasksResponse {
  success: boolean;
  data?: DevTask[];
  metadata?: ResponseMetadata;
  error?: ErrorDetails;
}

export interface DevTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo: AssignedToInfo | null;
  tags: string[];
  priority: TaskPriority;
  estimatedHours: number | null;
  actualHours: number | null;
  createdAt: string;
  updatedAt: string;
  taskType?: TaskType;
  storyPoints?: number | null;
  componentArea?: string | null;
  sprint?: SprintInfo | null;
  feature?: FeatureInfo | null;
  parentTaskId?: string | null;
  dependencies?: any;
  aiMetadata?: any;
}

export interface AssignedToInfo {
  id: string;
  name: string;
  slug: string;
}

export interface SprintInfo {
  id: string;
  name: string;
}

export interface FeatureInfo {
  id: string;
  title: string;
}

export interface ResponseMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  appliedFilters: AppliedFilters;
}

export interface AppliedFilters {
  status: string[];
  assignedTo?: string;
  assigneeEmail?: string;
  includeDescription: boolean;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ErrorResponse {
  success: false;
  error: ErrorDetails;
  requestId: string;
  timestamp: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskType = 'feature' | 'bug' | 'refactor' | 'documentation' | 'testing';

export interface DatabaseQueryResult {
  tasks: any[];
  totalCount: number;
  hasMore: boolean;
}

export interface CacheEntry {
  data: DevTask[];
  metadata: ResponseMetadata;
  timestamp: number;
}
