/**
 * get-meeting-normalized-record Edge Function
 *
 * Returns a normalized meeting record formatted as Markdown plain text.
 * Combines data from multiple tables:
 * - meeting_transcripts (transcript data)
 * - meetings (meeting metadata)
 * - meeting_participants + team_members (participants)
 * - sprints (sprint context)
 *
 * @module get-meeting-normalized-record
 *
 * @example
 * ```typescript
 * // Request via POST with JSON body
 * const response = await fetch('https://xxx.supabase.co/functions/v1/get-meeting-normalized-record', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer <token>'
 *   },
 *   body: JSON.stringify({
 *     meetingTranscriptId: 'uuid-here',
 *     projectId: 'project-uuid'
 *   })
 * });
 *
 * // Response is plain text Markdown
 * const markdown = await response.text();
 * ```
 */

import { corsHeaders } from '../_shared/cors.ts';
import { DatabaseService } from './database-service.ts';
import { formatMeetingAsMarkdown } from './markdown-formatter.ts';
import { GetMeetingNormalizedRecordRequest } from './types.ts';
import { validateUUID } from '../_shared/validation.ts';
import { formatErrorResponse, generateRequestId } from '../_shared/response-formatter.ts';

Deno.serve(async (req: Request) => {
  const OPERATION = 'get-meeting-normalized-record';
  console.log(`[${OPERATION}] Request received: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Accept both POST and GET methods
    let meetingTranscriptId: string | null = null;
    let projectId: string | null = null;

    if (req.method === 'POST') {
      // Parse JSON body for POST requests
      const body: GetMeetingNormalizedRecordRequest = await req.json();
      meetingTranscriptId = body.meetingTranscriptId;
      projectId = body.projectId;
    } else if (req.method === 'GET') {
      // Parse query parameters for GET requests
      const url = new URL(req.url);
      meetingTranscriptId = url.searchParams.get('meetingTranscriptId') || url.searchParams.get('meeting_transcript_id');
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

    if (!meetingTranscriptId) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'meetingTranscriptId is required', requestId, false)),
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

    if (!validateUUID(meetingTranscriptId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'meetingTranscriptId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${OPERATION}] Fetching meeting transcript: ${meetingTranscriptId} for project: ${projectId}`);

    // Fetch normalized meeting data
    const dbService = new DatabaseService();
    const meetingData = await dbService.getNormalizedMeetingData(projectId, meetingTranscriptId);

    if (!meetingData) {
      console.log(`[${OPERATION}] Meeting transcript not found: ${meetingTranscriptId}`);
      return new Response(
        JSON.stringify(formatErrorResponse('NOT_FOUND', 'Meeting transcript not found or does not belong to the specified project', requestId, false)),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format as Markdown
    const markdown = formatMeetingAsMarkdown(meetingData);
    const processingTime = Date.now() - startTime;

    console.log(`[${OPERATION}] Success: ${meetingTranscriptId} (${markdown.length} chars, ${processingTime}ms)`);

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
          'X-Request-Id': requestId,
        }
      }
    );
  }
});
