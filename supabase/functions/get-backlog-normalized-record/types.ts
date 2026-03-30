/**
 * Types for get-backlog-normalized-record Edge Function
 *
 * @module get-backlog-normalized-record/types
 */

/**
 * Request payload for getting a normalized backlog item record
 */
export interface GetBacklogNormalizedRecordRequest {
  backlogItemId: string;
  projectId: string;
}

/**
 * Backlog item full detail from view_backlog_item_full_detail
 */
export interface BacklogItemFullDetail {
  // Core
  backlog_item_id: string;
  project_id: string;
  title: string;
  description: string | null;
  acceptance_criteria: unknown[];
  story_points: number;
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  business_value: number | null;
  technical_complexity: number | null;
  tags: string[];
  status: 'draft' | 'ready' | 'in_refinement' | 'approved';
  position: number;
  converted_task_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Computed
  days_since_update: number;

  // Feature Counts
  features_count: number;
  features_done_count: number;
  features_total_points: number;
  features_progress_percentage: number;

  // Task Counts
  tasks_count: number;
  tasks_done_count: number;
  tasks_in_progress_count: number;
  tasks_todo_count: number;
  tasks_blocked_count: number;
  tasks_total_points: number;
  tasks_done_points: number;
  tasks_progress_percentage: number;
}

/**
 * Feature associated with backlog item from view_backlog_item_features
 */
export interface BacklogItemFeature {
  feature_id: string;
  backlog_item_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'ready' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  story_points: number | null;
  estimated_hours: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  tasks_count: number;
  tasks_done_count: number;
  progress_percentage: number;
}

/**
 * Task associated with backlog item via features from view_backlog_item_tasks
 */
export interface BacklogItemTask {
  task_id: string;
  backlog_item_id: string;
  feature_id: string;
  project_id: string;
  title: string;
  task_type: string;
  status: string;
  priority: string;
  story_points: number;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  feature_title: string;
  created_at: string;
  updated_at: string;
}

/**
 * Complete normalized backlog item record data
 */
export interface NormalizedBacklogItemData {
  backlogItem: BacklogItemFullDetail;
  features: BacklogItemFeature[];
  tasks: BacklogItemTask[];
}
