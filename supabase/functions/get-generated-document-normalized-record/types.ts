/**
 * Types for get-generated-document-normalized-record Edge Function
 *
 * @module get-generated-document-normalized-record/types
 */

/**
 * Request payload for getting a normalized generated document record
 */
export interface GetGeneratedDocumentNormalizedRecordRequest {
  generatedDocumentId: string;
  projectId: string;
}

/**
 * Generated document full detail from view_generated_document_full_detail
 */
export interface GeneratedDocumentFullDetail {
  // Core
  document_id: string;
  project_id: string;
  document_type: string | null;
  document_name: string | null;
  version: number;
  is_current_version: boolean;
  content: string;
  raw_content: string | null;
  content_format: string | null;
  word_count: number | null;
  section_count: number | null;
  estimated_reading_time: number | null;
  quality_score: number | null;
  quality_issues: string[];
  validation_results: Record<string, unknown>;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'archived';
  replaced_by: string | null;
  meeting_transcript_id: string | null;
  sprint_id: string | null;
  ai_interaction_id: string | null;
  company_knowledge_ids: unknown[];
  created_at: string;
  updated_at: string;

  // Approval workflow
  submitted_for_approval_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  approval_notes: string | null;

  // Meeting context
  meeting_title: string | null;
  meeting_date: string | null;
  meeting_id: string | null;

  // Sprint context
  sprint_name: string | null;
  sprint_start_date: string | null;
  sprint_end_date: string | null;
  sprint_status: 'planning' | 'active' | 'completed' | null;

  // AI interaction context
  ai_model: string | null;
  ai_token_usage: Record<string, unknown> | null;
  ai_cost_usd: number | null;
}

/**
 * Meeting participant detail from meeting_participants JOIN team_members
 */
export interface MeetingParticipantDetail {
  id: string;
  participant_type: string;
  external_email: string | null;
  member_name: string | null;
}

/**
 * Linked feature from feature_documents JOIN features
 */
export interface LinkedFeature {
  feature_id: string;
  feature_title: string;
  feature_status: string;
  feature_priority: string;
}

/**
 * Related document from the same meeting transcript
 */
export interface RelatedDocument {
  document_id: string;
  document_type: string | null;
  document_name: string | null;
  status: string;
  created_at: string;
}

/**
 * Complete normalized generated document data
 */
export interface NormalizedGeneratedDocumentData {
  document: GeneratedDocumentFullDetail;
  participants: MeetingParticipantDetail[];
  linkedFeatures: LinkedFeature[];
  relatedDocuments: RelatedDocument[];
}

/**
 * Interface for document type-specific formatters
 */
export interface DocumentFormatter {
  format(data: NormalizedGeneratedDocumentData): string;
}
