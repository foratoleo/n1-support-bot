import { z } from "npm:zod";

export const CreateMediaMeetingSchema = z.object({
  meetingId: z.string().min(1, "meetingId is required"),
  projectId: z.string().min(1, "projectId is required"),
  meetingUrl: z.string().url("Invalid meeting URL"),
  botName: z.string().max(255).optional(),
  joinAt: z.string().optional(),
  languageCode: z.string().min(2).max(10).optional(),
  meetingTitle: z.string().optional(),
  meetingType: z.string().optional(),
  createdByName: z.string().optional(),
  participants: z.string().optional(),
});

export type CreateMediaMeetingInput = z.infer<typeof CreateMediaMeetingSchema>;

export interface MediaApiError extends Error {
  status?: number;
  code?: string;
}

export interface MeetingRecordingSettings {
  api_key: string | null;
  disclaimer_text: string | null;
  logo_not_recording_url: string | null;
  logo_recording_url: string | null;
}

export interface MediaMeetingResult {
  id: string;
  status: string;
  processingStatus: string;
}
