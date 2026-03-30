/**
 * get-feature-normalized-record Edge Function
 *
 * Returns a normalized feature record formatted as Markdown plain text.
 * Combines data from multiple views:
 * - view_feature_full_detail (main feature data)
 * - view_feature_tasks (tasks)
 * - view_feature_sprints_detail (sprints)
 * - view_feature_attachments_detail (attachments)
 * - feature_meetings with meeting_transcripts (meetings)
 * - feature_documents with generated_documents/project_documents (documents)
 *
 * @module get-feature-normalized-record
 *
 * @example
 * ```typescript
 * // Request via POST with JSON body
 * const response = await fetch('https://xxx.supabase.co/functions/v1/get-feature-normalized-record', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer <token>'
 *   },
 *   body: JSON.stringify({
 *     featureId: 'uuid-here',
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
import { formatFeatureAsMarkdown } from './markdown-formatter.ts';
import { GetFeatureNormalizedRecordRequest } from './types.ts';
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
    let featureId: string | null = null;
    let projectId: string | null = null;

    if (req.method === 'POST') {
      // Parse JSON body for POST requests
      const body: GetFeatureNormalizedRecordRequest = await req.json();
      featureId = body.featureId;
      projectId = body.projectId;
    } else if (req.method === 'GET') {
      // Parse query parameters for GET requests
      const url = new URL(req.url);
      featureId = url.searchParams.get('featureId') || url.searchParams.get('feature_id');
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

    if (!featureId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'featureId is required', requestId, false)),
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

    if (!validateUUID(featureId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'featureId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch normalized feature data
    const dbService = new DatabaseService();
    const featureData = await dbService.getNormalizedFeatureData(projectId, featureId);

    if (!featureData) {
      return new Response(
        JSON.stringify(formatErrorResponse('NOT_FOUND', 'Feature not found or does not belong to the specified project', requestId, false)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format as Markdown
    const markdown = formatFeatureAsMarkdown(featureData);
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
    console.error('Error in get-feature-normalized-record:', error);
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
