/**
 * Types for get-meeting-normalized-record Edge Function
 *
 * @module get-meeting-normalized-record/types
 */

/**
 * Request payload for getting a normalized meeting record
 */
export interface GetMeetingNormalizedRecordRequest {
  meetingTranscriptId: string;
  projectId: string;
}

/**
 * Meeting transcript detail from meeting_transcripts table
 */
export interface MeetingTranscriptDetail {
  id: string;
  title: string | null;
  description: string | null;
  transcript_text: string | null;
  meeting_date: string | null;
  tags: string[] | null;
  transcript_metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  project_id: string;
  meeting_id: string | null;
}

/**
 * Meeting detail from meetings table
 */
export interface MeetingDetail {
  id: string;
  title: string | null;
  description: string | null;
  meeting_date: string | null;
  start_time: string | null;
  end_time: string | null;
  meeting_url: string | null;
  meeting_type: string | null;
  sprint_id: string | null;
  created_by: string | null;
}

/**
 * Meeting participant from meeting_participants with team_members join
 */
export interface MeetingParticipant {
  id: string;
  participant_type: string | null;
  external_email: string | null;
  team_member_id: string | null;
  auth_user_id: string | null;
  member_name: string | null;
}

/**
 * Sprint detail from sprints table
 */
export interface SprintDetail {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

/**
 * Complete normalized meeting record data
 */
export interface NormalizedMeetingData {
  transcript: MeetingTranscriptDetail;
  meeting: MeetingDetail | null;
  participants: MeetingParticipant[];
  sprint: SprintDetail | null;
}
