import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseService } from './database-service.ts';
import { AssignTaskRequest } from './types.ts';
import { validateUUID } from '../_shared/validation.ts';
import { formatSuccessResponse, formatErrorResponse, generateRequestId } from '../_shared/response-formatter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify(formatErrorResponse('METHOD_NOT_ALLOWED', 'Only POST method is supported', requestId, false)),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AssignTaskRequest = await req.json();

    if (!body.projectId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId is required', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.taskId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'taskId is required', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUUID(body.projectId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUUID(body.taskId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'taskId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.assignedTo !== null && !validateUUID(body.assignedTo)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'assignedTo must be a valid UUID or null', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dbService = new DatabaseService();

    try {
      const result = await dbService.assignTask(body.projectId, body.taskId, body.assignedTo);

      if (!result) {
        return new Response(
          JSON.stringify(formatErrorResponse('NOT_FOUND', 'Task not found or does not belong to the specified project', requestId, false)),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const message = body.assignedTo ? 'Task assigned successfully' : 'Task unassigned successfully';
      const processingTime = Date.now() - startTime;

      return new Response(
        JSON.stringify({
          ...formatSuccessResponse(result),
          message
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Processing-Time-Ms': processingTime.toString(),
          }
        }
      );
    } catch (error) {
      if (error.message === 'INVALID_MEMBER') {
        return new Response(
          JSON.stringify(formatErrorResponse('INVALID_INPUT', 'Assigned member does not exist or is not active', requestId, false)),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error in api-task-assign:', error);
    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(formatErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId, true)),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTime.toString(),
        }
      }
    );
  }
});
