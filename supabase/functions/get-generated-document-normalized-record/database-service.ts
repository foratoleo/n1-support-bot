/**
 * Database Service for get-generated-document-normalized-record Edge Function
 *
 * Fetches generated document data from the view and related tables,
 * combining them into a complete normalized record.
 *
 * @module get-generated-document-normalized-record/database-service
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import {
  GeneratedDocumentFullDetail,
  MeetingParticipantDetail,
  LinkedFeature,
  RelatedDocument,
  NormalizedGeneratedDocumentData
} from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  /**
   * Fetches complete normalized generated document data
   * First loads the document, then fetches context in parallel
   */
  async getNormalizedDocumentData(
    projectId: string,
    documentId: string
  ): Promise<NormalizedGeneratedDocumentData | null> {
    const document = await this.getDocumentFullDetail(projectId, documentId);

    if (!document) {
      return null;
    }

    const [participants, linkedFeatures, relatedDocuments] = await Promise.all([
      document.meeting_id ? this.getMeetingParticipants(document.meeting_id) : Promise.resolve([]),
      this.getLinkedFeatures(documentId),
      document.meeting_transcript_id
        ? this.getRelatedDocuments(document.meeting_transcript_id, documentId, projectId)
        : Promise.resolve([])
    ]);

    return {
      document,
      participants,
      linkedFeatures,
      relatedDocuments
    };
  }

  /**
   * Fetches document full detail from view_generated_document_full_detail
   */
  private async getDocumentFullDetail(
    projectId: string,
    documentId: string
  ): Promise<GeneratedDocumentFullDetail | null> {
    const { data, error } = await this.supabase
      .from('view_generated_document_full_detail')
      .select(
        'document_id, project_id, document_type, document_name, version, is_current_version, content, raw_content, content_format, word_count, section_count, estimated_reading_time, quality_score, quality_issues, validation_results, status, replaced_by, meeting_transcript_id, sprint_id, ai_interaction_id, company_knowledge_ids, created_at, updated_at, submitted_for_approval_at, submitted_by, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, approval_notes, meeting_title, meeting_date, meeting_id, sprint_name, sprint_start_date, sprint_end_date, sprint_status, ai_model, ai_token_usage, ai_cost_usd'
      )
      .eq('document_id', documentId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching generated document full detail:', error);
      return null;
    }

    return data as GeneratedDocumentFullDetail;
  }

  /**
   * Fetches meeting participants with team member names via LEFT JOIN
   */
  private async getMeetingParticipants(meetingId: string): Promise<MeetingParticipantDetail[]> {
    const { data, error } = await this.supabase
      .from('meeting_participants')
      .select('id, participant_type, external_email, team_members!left(full_name)')
      .eq('meeting_id', meetingId)
      .limit(50);

    if (error) {
      console.error('Error fetching meeting participants:', error);
      return [];
    }

    return ((data || []) as unknown[]).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const teamMember = r['team_members'] as Record<string, unknown> | null;
      return {
        id: r['id'] as string,
        participant_type: r['participant_type'] as string,
        external_email: (r['external_email'] as string | null) ?? null,
        member_name: teamMember ? (teamMember['full_name'] as string | null) : null
      };
    });
  }

  /**
   * Fetches features linked to this document via feature_documents table
   */
  private async getLinkedFeatures(documentId: string): Promise<LinkedFeature[]> {
    const { data, error } = await this.supabase
      .from('feature_documents')
      .select('feature_id, features!inner(title, status, priority)')
      .eq('document_id', documentId)
      .eq('document_type', 'generated')
      .limit(20);

    if (error) {
      console.error('Error fetching linked features:', error);
      return [];
    }

    return ((data || []) as unknown[]).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      const feature = r['features'] as Record<string, unknown>;
      return {
        feature_id: r['feature_id'] as string,
        feature_title: feature['title'] as string,
        feature_status: feature['status'] as string,
        feature_priority: feature['priority'] as string
      };
    });
  }

  /**
   * Fetches other documents generated from the same meeting transcript
   */
  private async getRelatedDocuments(
    meetingTranscriptId: string,
    currentDocId: string,
    projectId: string
  ): Promise<RelatedDocument[]> {
    const { data, error } = await this.supabase
      .from('generated_documents')
      .select('id, document_type, document_name, status, created_at')
      .eq('meeting_transcript_id', meetingTranscriptId)
      .eq('project_id', projectId)
      .eq('is_current_version', true)
      .is('deleted_at', null)
      .neq('id', currentDocId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Error fetching related documents:', error);
      return [];
    }

    return ((data || []) as unknown[]).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        document_id: r['id'] as string,
        document_type: (r['document_type'] as string | null) ?? null,
        document_name: (r['document_name'] as string | null) ?? null,
        status: r['status'] as string,
        created_at: r['created_at'] as string
      };
    });
  }
}
