import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from '../_shared/cors.ts';
import { AccessibilityTestRequest, AccessibilityTestResponse } from './types.ts';
import { validateTestRequest } from './utils/validation.ts';
import { formatSuccessResponse, formatErrorResponse } from './utils/response-formatter.ts';
import { ValidationError, ApiError, DatabaseError } from './utils/validation.ts';
import { PageSpeedClient } from './pagespeed-client.ts';
import { ServiceCallTracker, sanitizeHeaders } from '../_shared/external-service-utils.ts';
import {
  FUNCTION_TIMEOUT,
  PAGESPEED_API_BASE_URL,
  PAGESPEED_API_HOST
} from './config.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let timeoutId: number | undefined;

  try {
    // Validate request method
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed', 'method');
    }

    // Parse request body with error handling
    let body: AccessibilityTestRequest;
    try {
      body = await req.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body', 'body');
    }

    // Log request (without sensitive data)
    console.log('Accessibility test request received:', {
      projectId: body.projectId,
      targetUrl: body.targetUrl,
      strategy: body.strategy,
      timestamp: new Date().toISOString(),
    });

    // Validate request body
    validateTestRequest(body);

    // Set function timeout to prevent exceeding Supabase limits
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Function execution timeout exceeded'));
      }, FUNCTION_TIMEOUT);
    });

    // Create Supabase client with request auth headers for RLS compliance
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration not found');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') || '',
        },
      },
    });

    // Instantiate PageSpeed client
    const pageSpeedClient = new PageSpeedClient();

    // Execute test workflow with Promise.race for timeout
    const workflowPromise = (async () => {
      // Initialize service call tracker
      const tracker = new ServiceCallTracker(supabaseClient, {
        projectId: body.projectId,
        serviceName: 'pagespeed',
        serviceCategory: 'accessibility',
        endpointPath: '/run_pagespeed',
        operationType: 'test',
        requestMethod: 'GET',
        requestUrl: PAGESPEED_API_BASE_URL,
        requestHeaders: sanitizeHeaders({
          'x-rapidapi-key': '[REDACTED]',
          'x-rapidapi-host': PAGESPEED_API_HOST,
          'Accept': 'application/json',
        }),
        requestParameters: {
          url: body.targetUrl,
          category: 'ACCESSIBILITY',
          strategy: body.strategy,
          locale: body.locale || 'en-US',
        },
      });

      try {
        // Step 1: Start tracking
        console.log('Starting service call tracking...');
        const callId = await tracker.start();

        // Step 2: Run PageSpeed accessibility test
        console.log('Running PageSpeed accessibility test...', {
          url: body.targetUrl,
          strategy: body.strategy,
        });
        const result = await pageSpeedClient.runTest(
          body.targetUrl,
          body.strategy,
          body.locale || 'en-US',
          body.timeout || 30000
        );

        // Step 3: Prepare formatted result
        const formattedResult = {
          score: result.lighthouseResult.categories.accessibility.score * 100,
          categories: {
            accessibility: {
              score: result.lighthouseResult.categories.accessibility.score * 100,
              title: result.lighthouseResult.categories.accessibility.title,
              auditRefs: result.lighthouseResult.categories.accessibility.auditRefs
            }
          },
          audits: result.lighthouseResult.audits,
          fetchTime: result.lighthouseResult.fetchTime,
          requestedUrl: result.lighthouseResult.requestedUrl,
          finalUrl: result.lighthouseResult.finalUrl,
          timestamp: new Date().toISOString()
        };

        // Step 4: Record successful completion with full response
        console.log('Recording successful API call...');
        try {
          await tracker.complete(200, formattedResult);
        } catch (trackerError) {
          console.error('Failed to record success in tracker:', trackerError);
        }

        // Step 5: Return formatted response with callId as documentId
        return { documentId: callId, result: formattedResult };
      } catch (error) {
        // Record failure
        console.error('PageSpeed API call failed, recording error...');
        try {
          await tracker.fail(error instanceof Error ? error : new Error('Unknown error'));
        } catch (trackerError) {
          console.error('Failed to record error in tracker:', trackerError);
        }
        // Re-throw the original error
        throw error;
      }
    })();

    // Race between workflow and timeout
    const { documentId, result } = await Promise.race([
      workflowPromise,
      timeoutPromise,
    ]) as { documentId: string; result: any };

    const executionTime = Date.now() - startTime;
    console.log('Accessibility test completed successfully', {
      documentId,
      executionTime,
      url: body.targetUrl,
    });

    return formatSuccessResponse({
      documentId,
      result,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('Edge function error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      executionTime,
    });

    // Handle specific error types
    if (error instanceof ValidationError) {
      return formatErrorResponse(error, 400);
    }

    if (error instanceof ApiError) {
      return formatErrorResponse(error, error.statusCode);
    }

    if (error instanceof DatabaseError) {
      return formatErrorResponse(error, 500);
    }

    // Generic error handling
    return formatErrorResponse(
      error instanceof Error ? error : new Error('An unexpected error occurred'),
      500
    );
  } finally {
    // Cleanup timeout
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
});
