/**
 * get-generated-document-normalized-record Edge Function
 *
 * Returns a normalized generated document record formatted as Markdown plain text.
 * Combines data from multiple sources:
 * - view_generated_document_full_detail (main document data with meeting, sprint, AI context)
 * - meeting_participants (participants of the originating meeting)
 * - feature_documents JOIN features (linked features)
 * - generated_documents (related documents from the same meeting)
 *
 * Supports 8 document types: prd, user-story, meeting-notes, technical-specs,
 * test-cases, unit-tests, accessibility-test-result, performance-test-result
 *
 * @module get-generated-document-normalized-record
 *
 * @example
 * ```typescript
 * // Request via POST with JSON body
 * const response = await fetch('https://xxx.supabase.co/functions/v1/get-generated-document-normalized-record', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'Authorization': 'Bearer <token>'
 *   },
 *   body: JSON.stringify({
 *     generatedDocumentId: 'uuid-here',
 *     projectId: 'project-uuid'
 *   })
 * });
 *
 * // Response is plain text Markdown
 * const markdown = await response.text();
 * ```
 */

import { DatabaseService } from './database-service.ts';
import { getFormatter } from './formatters/index.ts';
import { GetGeneratedDocumentNormalizedRecordRequest } from './types.ts';
import { validateUUID } from '../_shared/validation.ts';
import { formatErrorResponse, generateRequestId } from '../_shared/response-formatter.ts';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const OPERATION = 'get-generated-document-normalized-record';
  console.log(`[${OPERATION}] Request received: ${req.method}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // Accept only POST method
    let generatedDocumentId: string | null = null;
    let projectId: string | null = null;

    if (req.method === 'POST') {
      // Parse JSON body for POST requests
      const body: GetGeneratedDocumentNormalizedRecordRequest = await req.json();
      generatedDocumentId = body.generatedDocumentId;
      projectId = body.projectId;
    } else {
      return new Response(
        JSON.stringify(
          formatErrorResponse(
            'METHOD_NOT_ALLOWED',
            'Only POST method is supported',
            requestId,
            false
          )
        ),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required parameters
    if (!projectId) {
      return new Response(
        JSON.stringify(
          formatErrorResponse('INVALID_INPUT', 'projectId is required', requestId, false)
        ),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!generatedDocumentId) {
      return new Response(
        JSON.stringify(
          formatErrorResponse(
            'INVALID_INPUT',
            'generatedDocumentId is required',
            requestId,
            false
          )
        ),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID formats
    if (!validateUUID(projectId)) {
      return new Response(
        JSON.stringify(
          formatErrorResponse('INVALID_INPUT', 'projectId must be a valid UUID', requestId, false)
        ),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!validateUUID(generatedDocumentId)) {
      return new Response(
        JSON.stringify(
          formatErrorResponse(
            'INVALID_INPUT',
            'generatedDocumentId must be a valid UUID',
            requestId,
            false
          )
        ),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[${OPERATION}] Fetching document: ${generatedDocumentId} for project: ${projectId}`
    );

    // Fetch normalized document data
    const dbService = new DatabaseService();
    const documentData = await dbService.getNormalizedDocumentData(
      projectId,
      generatedDocumentId
    );

    if (!documentData) {
      console.log(`[${OPERATION}] Document not found: ${generatedDocumentId}`);
      return new Response(
        JSON.stringify(
          formatErrorResponse(
            'NOT_FOUND',
            'Generated document not found or does not belong to the specified project',
            requestId,
            false
          )
        ),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format as Markdown using the appropriate formatter for this document type
    const formatter = getFormatter(documentData.document.document_type);
    const markdown = formatter.format(documentData);
    const processingTime = Date.now() - startTime;

    console.log(
      `[${OPERATION}] Success: ${generatedDocumentId} type=${documentData.document.document_type} (${markdown.length} chars, ${processingTime}ms)`
    );

    return new Response(markdown, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Processing-Time-Ms': processingTime.toString(),
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    console.error(`[${OPERATION}] Error:`, error);
    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(
        formatErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId, true)
      ),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTime.toString(),
        },
      }
    );
  }
});
