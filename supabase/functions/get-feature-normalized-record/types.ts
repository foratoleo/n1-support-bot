/**
 * Types for get-feature-normalized-record Edge Function
 *
 * @module get-feature-normalized-record/types
 */

/**
 * Request payload for getting a normalized feature record
 */
export interface GetFeatureNormalizedRecordRequest {
  featureId: string;
  projectId: string;
}

/**
 * Feature full detail from view_feature_full_detail
 */
export interface FeatureFullDetail {
  // Core
  feature_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'ready' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  delivered_value: string | null;
  ready_criteria: unknown[];
  dependencies: unknown[];
  notes: string | null;
  story_points: number | null;
  estimated_hours: number | null;
  tags: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Epic
  epic_id: string | null;
  epic_title: string | null;
  epic_description: string | null;
  epic_acceptance_criteria: unknown[] | null;
  epic_story_points: number | null;
  epic_priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent' | null;
  epic_business_value: number | null;
  epic_technical_complexity: number | null;
  epic_status: 'draft' | 'ready' | 'in_refinement' | 'approved' | null;

  // Computed
  days_since_update: number;
  progress_percentage: number;

  // Counts
  tasks_count: number;
  tasks_done_count: number;
  tasks_total_points: number;
  tasks_done_points: number;
  attachments_count: number;
  documents_count: number;
  sprints_count: number;
  meetings_count: number;
}

/**
 * Feature task from view_feature_tasks
 */
export interface FeatureTask {
  task_id: string;
  feature_id: string;
  project_id: string;
  title: string;
  description: string | null;
  task_type: 'feature' | 'bug' | 'enhancement' | 'technical_debt' | 'research' | 'documentation' | 'testing' | 'deployment' | 'maintenance' | 'test' | 'refactor';
  status: 'todo' | 'in_progress' | 'in_review' | 'testing' | 'blocked' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical' | 'urgent';
  story_points: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Feature sprint detail from view_feature_sprints_detail
 */
export interface FeatureSprintDetail {
  id: string;
  feature_id: string;
  sprint_id: string;
  linked_at: string;
  sprint_name: string;
  sprint_start_date: string;
  sprint_end_date: string;
  sprint_status: 'planning' | 'active' | 'completed' | 'cancelled';
}

/**
 * Feature meeting detail from feature_meetings joined with meeting_transcripts
 */
export interface FeatureMeetingDetail {
  id: string;
  feature_id: string;
  meeting_transcript_id: string;
  created_at: string;
  meeting_title: string | null;
  meeting_date: string | null;
}

/**
 * Feature document detail from feature_documents
 */
export interface FeatureDocumentDetail {
  id: string;
  feature_id: string;
  document_id: string;
  document_type: 'generated' | 'project';
  created_at: string;
  document_title: string | null;
  document_doc_type: string | null;
}

/**
 * Feature attachment detail from view_feature_attachments_detail
 */
export interface FeatureAttachmentDetail {
  attachment_id: string;
  feature_id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  download_url: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  file_size_formatted: string;
}

/**
 * Complete normalized feature record data
 */
export interface NormalizedFeatureData {
  feature: FeatureFullDetail;
  tasks: FeatureTask[];
  sprints: FeatureSprintDetail[];
  meetings: FeatureMeetingDetail[];
  documents: FeatureDocumentDetail[];
  attachments: FeatureAttachmentDetail[];
}
