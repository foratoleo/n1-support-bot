/**
 * Types for get-task-normalized-record Edge Function
 *
 * @module get-task-normalized-record/types
 */

/**
 * Request payload for getting a normalized task record
 */
export interface GetTaskNormalizedRecordRequest {
  taskId: string;
  projectId: string;
}

/**
 * Task full detail from view_task_full_detail
 */
export interface TaskFullDetail {
  // Core
  task_id: string;
  project_id: string;
  title: string;
  description: string | null;
  task_type: 'feature' | 'bug' | 'chore' | 'spike';
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  component_area: string | null;
  estimated_hours: number;
  actual_hours: number;
  story_points: number;
  parent_task_id: string | null;
  dependencies: unknown[];
  generated_from_interaction_id: string | null;
  ai_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;

  // JIRA
  jira_issue_key: string | null;
  jira_issue_id: string | null;
  jira_sync_status: 'synced' | 'pending' | 'error' | 'conflict' | null;
  jira_last_synced_at: string | null;
  jira_sync_enabled: boolean;
  last_jira_sync: string | null;

  // Sprint
  sprint_id: string | null;
  sprint_name: string | null;
  sprint_description: string | null;
  sprint_start_date: string | null;
  sprint_end_date: string | null;
  sprint_status: 'planning' | 'active' | 'completed' | null;
  sprint_goals: string[] | null;
  sprint_planned_points: number | null;
  sprint_completed_points: number | null;
  sprint_velocity: number | null;

  // Feature
  feature_id: string | null;
  feature_title: string | null;
  feature_description: string | null;
  feature_status: 'draft' | 'ready' | 'in_progress' | 'done' | null;
  feature_priority: 'low' | 'medium' | 'high' | 'critical' | null;
  feature_story_points: number | null;
  feature_meeting_transcript_id: string | null;

  // Epic
  epic_id: string | null;
  epic_title: string | null;
  epic_description: string | null;
  epic_status: 'draft' | 'ready' | 'in_refinement' | 'approved' | null;

  // Hierarchy
  hierarchy_path: string | null;

  // Assignee
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_avatar: string | null;
  assignee_profile: string | null;
  assignee_slug: string | null;

  // Parent
  parent_task_title: string | null;
  parent_task_status: string | null;

  // Computed
  progress_percentage: number;
  is_overdue: boolean;
  days_since_update: number;

  // Counts
  subtasks_count: number;
  comments_count: number;
  attachments_count: number;
}

/**
 * Task comment detail from view_task_comments_detail
 */
export interface TaskCommentDetail {
  comment_id: string;
  task_id: string;
  project_id: string;
  content: string;
  mentioned_members: unknown[];
  created_at: string;
  updated_at: string;
  author_id: string;
  author_name: string | null;
  author_email: string | null;
  author_avatar: string | null;
  author_slug: string | null;
}

/**
 * Task attachment detail from view_task_attachments_detail
 */
export interface TaskAttachmentDetail {
  attachment_id: string;
  task_id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  uploaded_by: string | null;
  uploader_name: string | null;
  uploader_email: string | null;
  file_size_formatted: string;
}

/**
 * Task subtask from view_task_subtasks
 */
export interface TaskSubtask {
  subtask_id: string;
  parent_task_id: string;
  project_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string;
  story_points: number;
  estimated_hours: number;
  actual_hours: number;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Complete normalized task record data
 */
export interface NormalizedTaskData {
  task: TaskFullDetail;
  comments: TaskCommentDetail[];
  attachments: TaskAttachmentDetail[];
  subtasks: TaskSubtask[];
}
