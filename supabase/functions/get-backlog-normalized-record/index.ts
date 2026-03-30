/**
 * get-backlog-normalized-record Edge Function
 *
 * Returns a normalized backlog item (epic) record formatted as Markdown plain text.
 * Combines data from multiple views:
 * - view_backlog_item_full_detail (main backlog item data)
 * - view_backlog_item_features (associated features)
 * - view_backlog_item_tasks (tasks via features)
 *
 * @module get-backlog-normalized-record
 *
 * @example
 * ```typescript
 * // Request via POST with JSON body
 * const response = await fetch('https://xxx.supabase.co/functions/v1/get-backlog-normalized-record', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer <token>'
 *   },
 *   body: JSON.stringify({
 *     backlogItemId: 'uuid-here',
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
import { formatBacklogItemAsMarkdown } from './markdown-formatter.ts';
import { GetBacklogNormalizedRecordRequest } from './types.ts';
import { validateUUID } from '../_shared/validation.ts';
import { formatErrorResponse, generateRequestId } from '../_shared/response-formatter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Accept both POST and GET methods
    let backlogItemId: string | null = null;
    let projectId: string | null = null;

    if (req.method === 'POST') {
      // Parse JSON body for POST requests
      const body: GetBacklogNormalizedRecordRequest = await req.json();
      backlogItemId = body.backlogItemId;
      projectId = body.projectId;
    } else if (req.method === 'GET') {
      // Parse query parameters for GET requests
      const url = new URL(req.url);
      backlogItemId = url.searchParams.get('backlogItemId') || url.searchParams.get('backlog_item_id');
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

    if (!backlogItemId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'backlogItemId is required', requestId, false)),
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

    if (!validateUUID(backlogItemId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'backlogItemId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch normalized backlog item data
    const dbService = new DatabaseService();
    const backlogItemData = await dbService.getNormalizedBacklogItemData(projectId, backlogItemId);

    if (!backlogItemData) {
      return new Response(
        JSON.stringify(formatErrorResponse('NOT_FOUND', 'Backlog item not found or does not belong to the specified project', requestId, false)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format as Markdown
    const markdown = formatBacklogItemAsMarkdown(backlogItemData);
    const processingTime = Date.now() - startTime;

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
    console.error('Error in get-backlog-normalized-record:', error);
    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(formatErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId, true)),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTime.toString(),
          'X-Request-Id': requestId,
        }
      }
    );
  }
});
