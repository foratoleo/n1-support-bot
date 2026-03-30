import { ResponseData } from './types.ts';
import { corsHeaders } from '../cors.ts';

export function formatSuccessResponse(
  document: string,
  responseId: string,
  documentId?: string,
  documentName?: string,
  aiInteractionId?: string
): ResponseData {
  return {
    success: true,
    document,
    response_id: responseId,
    document_id: documentId,
    document_name: documentName,
    ai_interaction_id: aiInteractionId
  };
}

export function formatErrorResponse(error: Error | string): ResponseData {
  return {
    success: false,
    error: error instanceof Error ? error.message : error
  };
}

export function getErrorStatusCode(error: Error | string): number {
  const errorMessage = error instanceof Error ? error.message : error;

  if (errorMessage.includes('Method not allowed')) {
    return 405;
  }

  if (errorMessage.includes('required')) {
    return 400;
  }

  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return 500;
}

export function createResponse(
  data: ResponseData,
  statusCode: number
): Response {
  return new Response(
    JSON.stringify(data),
    {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: statusCode,
    }
  );
}

export function createCorsResponse(): Response {
  return new Response(null, { headers: corsHeaders });
}
