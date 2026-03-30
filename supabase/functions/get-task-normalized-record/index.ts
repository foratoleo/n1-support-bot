/**
 * get-task-normalized-record Edge Function
 *
 * Returns a normalized task record formatted as Markdown plain text.
 * Combines data from multiple views:
 * - view_task_full_detail (main task data)
 * - view_task_comments_detail (comments)
 * - view_task_attachments_detail (attachments)
 * - view_task_subtasks (subtasks)
 *
 * @module get-task-normalized-record
 *
 * @example
 * ```typescript
 * // Request via POST with JSON body
 * const response = await fetch('https://xxx.supabase.co/functions/v1/get-task-normalized-record', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer <token>'
 *   },
 *   body: JSON.stringify({
 *     taskId: 'uuid-here',
 *     projectId: 'project-uuid'
 *   })
 * });
 *
 * // Response is plain text Markdown
 * const markdown = await response.text();
 * ```
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseService } from './database-service.ts';
import { formatTaskAsMarkdown } from './markdown-formatter.ts';
import { GetTaskNormalizedRecordRequest } from './types.ts';
import { validateUUID } from '../_shared/validation.ts';
import { formatErrorResponse, generateRequestId } from '../_shared/response-formatter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

serve(async (req) => {
  const OPERATION = 'get-task-normalized-record';
  console.log(`[${OPERATION}] Request received: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Accept both POST and GET methods
    let taskId: string | null = null;
    let projectId: string | null = null;

    if (req.method === 'POST') {
      // Parse JSON body for POST requests
      const body: GetTaskNormalizedRecordRequest = await req.json();
      taskId = body.taskId;
      projectId = body.projectId;
    } else if (req.method === 'GET') {
      // Parse query parameters for GET requests
      const url = new URL(req.url);
      taskId = url.searchParams.get('taskId') || url.searchParams.get('task_id');
      projectId = url.searchParams.get('projectId') || url.searchParams.get('project_id');
    } else {
      return new Response(
        JSON.stringify(formatErrorResponse('METHOD_NOT_ALLOWED', 'Only POST and GET methods are supported', requestId, false)),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required parameters
    if (!projectId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId is required', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!taskId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'taskId is required', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID formats
    if (!validateUUID(projectId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUUID(taskId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'taskId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${OPERATION}] Fetching task: ${taskId} for project: ${projectId}`);

    // Fetch normalized task data
    const dbService = new DatabaseService();
    const taskData = await dbService.getNormalizedTaskData(projectId, taskId);

    if (!taskData) {
      console.log(`[${OPERATION}] Task not found: ${taskId}`);
      return new Response(
        JSON.stringify(formatErrorResponse('NOT_FOUND', 'Task not found or does not belong to the specified project', requestId, false)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format as Markdown
    const markdown = formatTaskAsMarkdown(taskData);
    const processingTime = Date.now() - startTime;

    console.log(`[${OPERATION}] Success: ${taskId} (${markdown.length} chars, ${processingTime}ms)`);

    return new Response(markdown, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Processing-Time-Ms': processingTime.toString(),
        'X-Request-Id': requestId,
      }
    });

  } catch (error) {
    console.error(`[${OPERATION}] Error:`, error);
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
