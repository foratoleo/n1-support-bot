import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  executeWithTimeout,
  handleDatabaseError
} from '../_shared/database-utils.ts';
import {
  MeetingTranscript,
  MeetingTranscriptWithCount,
  CreateMeetingRequest,
  ListFilters,
  SortParams,
  MeetingUpdateData
} from './types.ts';
import { mapRequestToInsertData } from './data-mapper.ts';

// View name for optimized queries
const VIEW_API_MEETINGS = 'view_api_meetings';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  async validateProjectExists(projectId: string): Promise<boolean> {
    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('project_knowledge_base')
        .select('id')
        .eq('id', projectId)
        .is('deleted_at', null)
        .single(),
      'validateProjectExists'
    );

    return !error && !!data;
  }

  async createMeeting(request: CreateMeetingRequest): Promise<MeetingTranscript> {
    const insertData = mapRequestToInsertData(request);

    const { data, error } = await executeWithTimeout(
      this.supabase
        .from('meeting_transcripts')
        .insert(insertData)
        .select()
        .single(),
      'createMeeting'
    );

    if (error) {
      handleDatabaseError(error);
    }

    if (!data) {
      throw new Error('DATABASE_ERROR: No data returned from insert');
    }

    return data as MeetingTranscript;
  }

  async getMeeting(meetingId: string, projectId?: string): Promise<MeetingTranscriptWithCount | null> {
    // Query the view which includes generated_documents_count
    let query = this.supabase
      .from(VIEW_API_MEETINGS)
      .select('*')
      .eq('id', meetingId);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: meeting, error } = await executeWithTimeout(
      query.single(),
      'getMeeting'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    if (!meeting) {
      return null;
    }

    return this.mapViewRowToMeetingWithCount(meeting);
  }

  async listMeetings(
    options: {
      projectId?: string;
      filters?: ListFilters;
      pagination: { page: number; limit: number };
      sort?: SortParams;
    }
  ): Promise<{ items: MeetingTranscriptWithCount[]; totalCount: number }> {
    const { projectId, filters, pagination, sort } = options;
    const { page, limit } = pagination;

    // Query the view - already includes generated_documents_count
    let query = this.supabase
      .from(VIEW_API_MEETINGS)
      .select('*', { count: 'exact' });

    // Filter by project_id (from request root or filters)
    const effectiveProjectId = projectId || filters?.project_id;
    if (effectiveProjectId) {
      query = query.eq('project_id', effectiveProjectId);
    }

    // Date range filters
    if (filters?.date_from) {
      query = query.gte('meeting_date', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('meeting_date', filters.date_to);
    }

    // is_public filter
    if (filters?.is_public !== undefined) {
      query = query.eq('is_public', filters.is_public);
    }

    // Tags filter
    if (filters?.tags && filters.tags.length > 0) {
      query = query.overlaps('tags', filters.tags);
    }

    // Apply sorting (view default is meeting_date DESC)
    const sortField = sort?.field || 'meeting_date';
    const sortOrder = sort?.order || 'desc';
    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    query = query.range(start, end);

    const { data, error, count } = await executeWithTimeout(
      query,
      `listMeetings (page ${page}, limit ${limit})`
    );

    if (error) {
      handleDatabaseError(error);
    }

    // Map view rows to MeetingTranscriptWithCount
    const meetings = (data || []).map((row: Record<string, unknown>) =>
      this.mapViewRowToMeetingWithCount(row)
    );

    return {
      items: meetings,
      totalCount: count || 0
    };
  }

  async updateMeeting(
    meetingId: string,
    updateData: MeetingUpdateData,
    projectId?: string
  ): Promise<MeetingTranscript | null> {
    // UPDATE operations use the table directly
    let query = this.supabase
      .from('meeting_transcripts')
      .update(updateData)
      .eq('id', meetingId);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await executeWithTimeout(
      query.select().single(),
      'updateMeeting'
    );

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      handleDatabaseError(error);
    }

    return data as MeetingTranscript | null;
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Maps a row from view_api_meetings to MeetingTranscriptWithCount structure
   */
  private mapViewRowToMeetingWithCount(row: Record<string, unknown>): MeetingTranscriptWithCount {
    return {
      id: row.id as string,
      title: row.title as string,
      description: row.description as string | null,
      meeting_date: row.meeting_date as string,
      transcript_text: row.transcript_text as string,
      transcript_metadata: row.transcript_metadata as Record<string, unknown>,
      tags: row.tags as string[],
      created_at: row.created_at as string,
      created_by: row.created_by as string | null,
      is_public: row.is_public as boolean,
      project_id: row.project_id as string | null,
      meeting_id: row.meeting_id as string | null,
      generated_documents_count: (row.generated_documents_count as number) ?? 0
    };
  }
}
