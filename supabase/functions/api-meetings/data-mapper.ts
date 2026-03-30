import { CreateMeetingRequest, UpdateMeetingData, MeetingUpdateData } from './types.ts';

export interface MeetingInsertData {
  project_id: string | null;
  title: string;
  description: string | null;
  transcript_text: string;
  transcript_metadata: Record<string, unknown>;
  meeting_date: string;
  tags: string[];
  is_public: boolean;
  created_by: string | null;
}

export function mapRequestToInsertData(request: CreateMeetingRequest): MeetingInsertData {
  return {
    project_id: request.project_id ?? null,
    title: request.title,
    description: request.description ?? null,
    transcript_text: request.transcript_text,
    transcript_metadata: request.transcript_metadata ?? {},
    meeting_date: request.meeting_date ?? new Date().toISOString(),
    tags: request.tags ?? [],
    is_public: request.is_public ?? false,
    created_by: request.created_by ?? null
  };
}

export function mapUpdateRequestToData(data: UpdateMeetingData): MeetingUpdateData {
  const updateData: MeetingUpdateData = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.description !== undefined) {
    updateData.description = data.description;
  }
  if (data.transcript_text !== undefined) {
    updateData.transcript_text = data.transcript_text;
  }
  if (data.transcript_metadata !== undefined) {
    updateData.transcript_metadata = data.transcript_metadata;
  }
  if (data.meeting_date !== undefined) {
    updateData.meeting_date = data.meeting_date;
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }
  if (data.is_public !== undefined) {
    updateData.is_public = data.is_public;
  }
  if (data.project_id !== undefined) {
    updateData.project_id = data.project_id;
  }

  return updateData;
}
