/**
 * Database Service for get-meeting-normalized-record Edge Function
 *
 * Fetches meeting data from multiple tables and combines them into a complete record.
 *
 * @module get-meeting-normalized-record/database-service
 */

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  MeetingTranscriptDetail,
  MeetingDetail,
  MeetingParticipant,
  SprintDetail,
  NormalizedMeetingData
} from './types.ts';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('Missing required environment variable: SUPABASE_URL');
    }

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseKey) {
      throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Fetches complete normalized meeting data from all tables
   */
  async getNormalizedMeetingData(
    projectId: string,
    transcriptId: string
  ): Promise<NormalizedMeetingData | null> {
    // Step 1: Fetch the transcript first (required)
    const transcript = await this.getMeetingTranscript(projectId, transcriptId);

    if (!transcript) {
      return null;
    }

    // Step 2: If transcript has a meeting_id, fetch related data in parallel
    let meeting: MeetingDetail | null = null;
    let participants: MeetingParticipant[] = [];
    let sprint: SprintDetail | null = null;

    if (transcript.meeting_id) {
      const [meetingResult, participantsResult] = await Promise.all([
        this.getMeetingDetail(transcript.meeting_id),
        this.getMeetingParticipants(transcript.meeting_id)
      ]);

      meeting = meetingResult;
      participants = participantsResult;

      // Step 3: If meeting has a sprint_id, fetch sprint detail
      if (meeting?.sprint_id) {
        sprint = await this.getSprintDetail(meeting.sprint_id);
      }
    }

    return {
      transcript,
      meeting,
      participants,
      sprint
    };
  }

  /**
   * Fetches meeting transcript from meeting_transcripts table
   */
  private async getMeetingTranscript(
    projectId: string,
    transcriptId: string
  ): Promise<MeetingTranscriptDetail | null> {
    const { data, error } = await this.supabase
      .from('meeting_transcripts')
      .select('id, title, description, transcript_text, meeting_date, tags, transcript_metadata, created_at, created_by, project_id, meeting_id')
      .eq('id', transcriptId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found — no matching row
        return null;
      }
      throw new Error(`Error fetching meeting transcript: ${error.message}`);
    }

    return data as MeetingTranscriptDetail;
  }

  /**
   * Fetches meeting detail from meetings table
   */
  private async getMeetingDetail(
    meetingId: string
  ): Promise<MeetingDetail | null> {
    const { data, error } = await this.supabase
      .from('meetings')
      .select('id, title, description, meeting_date, start_time, end_time, meeting_url, meeting_type, sprint_id, created_by')
      .eq('id', meetingId)
      .single();

    if (error) {
      console.error('Error fetching meeting detail:', error);
      return null;
    }

    return data as MeetingDetail;
  }

  /**
   * Fetches meeting participants with team member names
   */
  private async getMeetingParticipants(
    meetingId: string
  ): Promise<MeetingParticipant[]> {
    const { data, error } = await this.supabase
      .from('meeting_participants')
      .select('id, participant_type, external_email, team_member_id, auth_user_id, team_members(name)')
      .eq('meeting_id', meetingId);

    if (error) {
      console.error('Error fetching meeting participants:', error);
      return [];
    }

    // Map the joined team_members.name to member_name
    return (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      participant_type: p.participant_type as string | null,
      external_email: p.external_email as string | null,
      team_member_id: p.team_member_id as string | null,
      auth_user_id: p.auth_user_id as string | null,
      member_name: (p.team_members as Record<string, unknown> | null)?.name as string | null ?? null
    })) as MeetingParticipant[];
  }

  /**
   * Fetches sprint detail from sprints table
   */
  private async getSprintDetail(
    sprintId: string
  ): Promise<SprintDetail | null> {
    const { data, error } = await this.supabase
      .from('sprints')
      .select('id, name, start_date, end_date, status')
      .eq('id', sprintId)
      .single();

    if (error) {
      console.error('Error fetching sprint detail:', error);
      return null;
    }

    return data as SprintDetail;
  }
}
