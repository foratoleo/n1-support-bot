// ============================================
// Meeting Transcript Type Definitions
// ============================================

export const MEETING_ACTIONS = ['create', 'get', 'list', 'update'] as const;
export type MeetingAction = typeof MEETING_ACTIONS[number];

export const SORT_FIELDS = ['meeting_date', 'created_at', 'title'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

export type SortField = typeof SORT_FIELDS[number];
export type SortOrder = typeof SORT_ORDERS[number];

// ============================================
// Meeting Transcript Entity
// ============================================

export interface MeetingTranscript {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  transcript_text: string;
  transcript_metadata: Record<string, unknown>;
  meeting_date: string;
  tags: string[];
  is_public: boolean;
  created_by: string | null;
  created_at: string;
}

export interface MeetingTranscriptWithCount extends MeetingTranscript {
  generated_documents_count: number;
}

// ============================================
// CREATE Request/Response
// ============================================

export interface CreateMeetingRequest {
  project_id?: string;
  title: string;
  description?: string;
  transcript_text: string;
  transcript_metadata?: Record<string, unknown>;
  meeting_date?: string;
  tags?: string[];
  is_public?: boolean;
  created_by?: string;
}

export interface CreateMeetingResponse {
  meeting: MeetingTranscript;
}

// ============================================
// GET Request/Response
// ============================================

export interface GetMeetingRequest {
  action: 'get';
  meeting_id: string;
  project_id?: string;
}

export interface GetMeetingResponse {
  meeting: MeetingTranscriptWithCount;
}

// ============================================
// LIST Request/Response
// ============================================

export interface ListFilters {
  date_from?: string;
  date_to?: string;
  is_public?: boolean;
  tags?: string[];
  project_id?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  field: SortField;
  order: SortOrder;
}

export interface ListMeetingsRequest {
  action: 'list';
  project_id?: string;
  filters?: ListFilters;
  pagination?: PaginationParams;
  sort?: SortParams;
}

export interface PaginationMetadata {
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ListMeetingsResponse {
  items: MeetingTranscriptWithCount[];
  pagination: PaginationMetadata;
  appliedFilters: ListFilters;
}

// ============================================
// UPDATE Request/Response
// ============================================

export interface UpdateMeetingData {
  title?: string;
  description?: string | null;
  transcript_text?: string;
  transcript_metadata?: Record<string, unknown>;
  meeting_date?: string;
  tags?: string[];
  is_public?: boolean;
  project_id?: string | null;
}

export interface MeetingUpdateData extends UpdateMeetingData {
  updated_at?: string;
}

export interface UpdateMeetingRequest {
  action: 'update';
  meeting_id: string;
  project_id?: string;
  data: UpdateMeetingData;
}

export interface UpdateMeetingResponse {
  meeting: MeetingTranscript;
}

// ============================================
// Discriminated Union for All Requests
// ============================================

export type MeetingRequest =
  | (CreateMeetingRequest & { action?: 'create' })
  | GetMeetingRequest
  | ListMeetingsRequest
  | UpdateMeetingRequest;
