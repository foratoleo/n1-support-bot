import {
  CreateCommentRequest,
  CommentUpdateData,
  CommentUpdateDataWithTimestamp
} from './types.ts';

export interface CommentInsertData {
  project_id: string;
  task_id: string;
  author_id: string;
  content: string;
  mentioned_members: string[];
}

export function mapRequestToInsertData(request: CreateCommentRequest): CommentInsertData {
  return {
    project_id: request.project_id,
    task_id: request.task_id,
    author_id: request.author_id,
    content: request.content.trim(),
    mentioned_members: request.mentioned_members ?? []
  };
}

export function mapUpdateRequestToData(data: CommentUpdateData): CommentUpdateDataWithTimestamp {
  const updateData: CommentUpdateDataWithTimestamp = {
    content: data.content.trim(),
    updated_at: new Date().toISOString()
  };

  if (data.mentioned_members !== undefined) {
    updateData.mentioned_members = data.mentioned_members;
  }

  return updateData;
}
