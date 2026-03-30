/**
 * Database Service for get-feature-normalized-record Edge Function
 *
 * Fetches feature data from multiple views and combines them into a complete record.
 *
 * @module get-feature-normalized-record/database-service
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  FeatureFullDetail,
  FeatureTask,
  FeatureSprintDetail,
  FeatureMeetingDetail,
  FeatureDocumentDetail,
  FeatureAttachmentDetail,
  NormalizedFeatureData
} from './types.ts';

/**
 * Interface for meeting join result
 */
interface FeatureMeetingJoinResult {
  id: string;
  feature_id: string;
  meeting_transcript_id: string;
  created_at: string;
  meeting_transcripts: {
    title: string;
    meeting_date: string;
    project_id: string;
  } | null;
}

/**
 * Interface for feature_documents junction table record
 */
interface FeatureDocumentJunctionRecord {
  id: string;
  feature_id: string;
  document_id: string;
  document_type: 'generated' | 'project';
  created_at: string;
}

/**
 * Interface for document info from generated_documents or project_documents
 */
interface DocumentInfo {
  id: string;
  title: string;
  doc_type: string;
  project_id?: string;
}

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Fetches complete normalized feature data from all views
   */
  async getNormalizedFeatureData(
    projectId: string,
    featureId: string
  ): Promise<NormalizedFeatureData | null> {
    // Fetch all data in parallel for optimal performance
    const [
      featureResult,
      tasksResult,
      sprintsResult,
      meetingsResult,
      documentsResult,
      attachmentsResult
    ] = await Promise.all([
      this.getFeatureFullDetail(projectId, featureId),
      this.getFeatureTasks(projectId, featureId),
      this.getFeatureSprints(projectId, featureId),
      this.getFeatureMeetings(projectId, featureId),
      this.getFeatureDocuments(projectId, featureId),
      this.getFeatureAttachments(projectId, featureId)
    ]);

    if (!featureResult) {
      return null;
    }

    return {
      feature: featureResult,
      tasks: tasksResult,
      sprints: sprintsResult,
      meetings: meetingsResult,
      documents: documentsResult,
      attachments: attachmentsResult
    };
  }

  /**
   * Fetches feature full detail from view_feature_full_detail
   */
  private async getFeatureFullDetail(
    projectId: string,
    featureId: string
  ): Promise<FeatureFullDetail | null> {
    const { data, error } = await this.supabase
      .from('view_feature_full_detail')
      .select('*')
      .eq('feature_id', featureId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      console.error('Error fetching feature full detail:', error);
      return null;
    }

    return data as FeatureFullDetail;
  }

  /**
   * Fetches feature tasks from view_feature_tasks
   */
  private async getFeatureTasks(
    projectId: string,
    featureId: string
  ): Promise<FeatureTask[]> {
    const { data, error } = await this.supabase
      .from('view_feature_tasks')
      .select('*')
      .eq('feature_id', featureId)
      .eq('project_id', projectId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching feature tasks:', error);
      return [];
    }

    return (data || []) as FeatureTask[];
  }

  /**
   * Fetches feature sprints from view_feature_sprints_detail
   */
  private async getFeatureSprints(
    projectId: string,
    featureId: string
  ): Promise<FeatureSprintDetail[]> {
    const { data, error } = await this.supabase
      .from('view_feature_sprints_detail')
      .select('*')
      .eq('feature_id', featureId)
      .eq('project_id', projectId)
      .order('sprint_start_date', { ascending: true });

    if (error) {
      console.error('Error fetching feature sprints:', error);
      return [];
    }

    return (data || []) as FeatureSprintDetail[];
  }

  /**
   * Fetches feature meetings from feature_meetings with meeting_transcripts join
   */
  private async getFeatureMeetings(
    projectId: string,
    featureId: string
  ): Promise<FeatureMeetingDetail[]> {
    const { data, error } = await this.supabase
      .from('feature_meetings')
      .select(`
        id,
        feature_id,
        meeting_transcript_id,
        created_at,
        meeting_transcripts!inner (
          title,
          meeting_date,
          project_id
        )
      `)
      .eq('feature_id', featureId)
      .eq('meeting_transcripts.project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching feature meetings:', error);
      return [];
    }

    // Transform the joined data into the expected format
    return (data || []).map((item: FeatureMeetingJoinResult) => ({
      id: item.id,
      feature_id: item.feature_id,
      meeting_transcript_id: item.meeting_transcript_id,
      created_at: item.created_at,
      meeting_title: item.meeting_transcripts?.title || null,
      meeting_date: item.meeting_transcripts?.meeting_date || null
    })) as FeatureMeetingDetail[];
  }

  /**
   * Fetches feature documents from feature_documents with document joins
   */
  private async getFeatureDocuments(
    projectId: string,
    featureId: string
  ): Promise<FeatureDocumentDetail[]> {
    // First, fetch the feature_documents junction table
    const { data: featureDocsData, error: featureDocsError } = await this.supabase
      .from('feature_documents')
      .select('*')
      .eq('feature_id', featureId)
      .order('created_at', { ascending: false });

    if (featureDocsError) {
      console.error('Error fetching feature documents:', featureDocsError);
      return [];
    }

    if (!featureDocsData || featureDocsData.length === 0) {
      return [];
    }

    // Separate by document type and fetch details
    const generatedDocIds = featureDocsData
      .filter((d: FeatureDocumentJunctionRecord) => d.document_type === 'generated')
      .map((d: FeatureDocumentJunctionRecord) => d.document_id);

    const projectDocIds = featureDocsData
      .filter((d: FeatureDocumentJunctionRecord) => d.document_type === 'project')
      .map((d: FeatureDocumentJunctionRecord) => d.document_id);

    const [generatedDocs, projectDocs] = await Promise.all([
      generatedDocIds.length > 0
        ? this.supabase
            .from('generated_documents')
            .select('id, title, doc_type, project_id')
            .in('id', generatedDocIds)
            .eq('project_id', projectId)
        : { data: [] },
      projectDocIds.length > 0
        ? this.supabase
            .from('project_documents')
            .select('id, title, doc_type, project_id')
            .in('id', projectDocIds)
            .eq('project_id', projectId)
        : { data: [] }
    ]);

    // Create lookup maps
    const generatedMap = new Map(
      (generatedDocs.data || []).map((d: DocumentInfo) => [d.id, d])
    );
    const projectMap = new Map(
      (projectDocs.data || []).map((d: DocumentInfo) => [d.id, d])
    );

    // Map the results
    return featureDocsData.map((fd: FeatureDocumentJunctionRecord) => {
      const docInfo = fd.document_type === 'generated'
        ? generatedMap.get(fd.document_id)
        : projectMap.get(fd.document_id);

      return {
        id: fd.id,
        feature_id: fd.feature_id,
        document_id: fd.document_id,
        document_type: fd.document_type,
        created_at: fd.created_at,
        document_title: docInfo?.title || null,
        document_doc_type: docInfo?.doc_type || null
      };
    }) as FeatureDocumentDetail[];
  }

  /**
   * Fetches feature attachments from view_feature_attachments_detail
   */
  private async getFeatureAttachments(
    projectId: string,
    featureId: string
  ): Promise<FeatureAttachmentDetail[]> {
    const { data, error } = await this.supabase
      .from('view_feature_attachments_detail')
      .select('*')
      .eq('feature_id', featureId)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching feature attachments:', error);
      return [];
    }

    return (data || []) as FeatureAttachmentDetail[];
  }
}
