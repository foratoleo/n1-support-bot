import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseService } from './database-service.ts';
import { GetSprintDetailsRequest } from './types.ts';
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

    const body: GetSprintDetailsRequest = await req.json();

    if (!body.projectId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId is required', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.sprintId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'sprintId is required', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUUID(body.projectId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUUID(body.sprintId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'sprintId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const includeTasks = body.includeTasks ?? false;

    const dbService = new DatabaseService();
    const sprint = await dbService.getSprintDetails(body.projectId, body.sprintId, includeTasks);

    if (!sprint) {
      return new Response(
        JSON.stringify(formatErrorResponse('NOT_FOUND', 'Sprint not found or does not belong to the specified project', requestId, false)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(formatSuccessResponse(sprint)),
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
    console.error('Error in api-sprint-details:', error);
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
