import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { PerformanceTestRequest, PerformanceTestResponse, FormattedPerformanceResult, CoreWebVital } from './types.ts';
import { validateTestRequest } from './utils/validation.ts';
import { formatSuccessResponse, formatErrorResponse } from './utils/response-formatter.ts';
import { ValidationError, ApiError, DatabaseError } from './utils/validation.ts';
import { PageSpeedClient } from './pagespeed-client.ts';
import { ServiceCallTracker, sanitizeHeaders } from '../_shared/external-service-utils.ts';
import {
  FUNCTION_TIMEOUT,
  PAGESPEED_API_BASE_URL,
  PAGESPEED_API_HOST,
  CORE_WEB_VITALS_METRICS
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
    let body: PerformanceTestRequest;
    try {
      body = await req.json();
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body', 'body');
    }

    // Log request (without sensitive data)
    console.log('Performance test request received:', {
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
        serviceCategory: 'performance',
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
          category: 'PERFORMANCE',
          strategy: body.strategy,
          locale: body.locale || 'en-US',
        },
      });

      try {
        // Step 1: Start tracking
        console.log('Starting service call tracking...');
        const callId = await tracker.start();

        // Step 2: Run PageSpeed performance test
        console.log('Running PageSpeed performance test...', {
          url: body.targetUrl,
          strategy: body.strategy,
        });
        const result = await pageSpeedClient.runTest(
          body.targetUrl,
          body.strategy,
          body.locale || 'en-US',
          body.timeout || 30000
        );

        // Step 3: Extract Core Web Vitals from audits
        const audits = result.lighthouseResult.audits;
        const metrics: FormattedPerformanceResult['metrics'] = {};

        // Extract LCP (Largest Contentful Paint)
        if (audits[CORE_WEB_VITALS_METRICS.LCP]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.LCP];
          metrics.lcp = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'millisecond',
          };
        }

        // Extract FID approximation (Max Potential FID)
        if (audits[CORE_WEB_VITALS_METRICS.FID]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.FID];
          metrics.fid = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'millisecond',
          };
        }

        // Extract CLS (Cumulative Layout Shift)
        if (audits[CORE_WEB_VITALS_METRICS.CLS]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.CLS];
          metrics.cls = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'unitless',
          };
        }

        // Extract FCP (First Contentful Paint)
        if (audits[CORE_WEB_VITALS_METRICS.FCP]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.FCP];
          metrics.fcp = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'millisecond',
          };
        }

        // Extract SI (Speed Index)
        if (audits[CORE_WEB_VITALS_METRICS.SI]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.SI];
          metrics.si = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'millisecond',
          };
        }

        // Extract TBT (Total Blocking Time)
        if (audits[CORE_WEB_VITALS_METRICS.TBT]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.TBT];
          metrics.tbt = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'millisecond',
          };
        }

        // Extract TTI (Time to Interactive)
        if (audits[CORE_WEB_VITALS_METRICS.TTI]) {
          const audit = audits[CORE_WEB_VITALS_METRICS.TTI];
          metrics.tti = {
            id: audit.id,
            title: audit.title,
            description: audit.description,
            score: audit.score || 0,
            numericValue: audit.numericValue || 0,
            displayValue: audit.displayValue || '',
            numericUnit: audit.numericUnit || 'millisecond',
          };
        }

        // Step 4: Extract performance opportunities
        const opportunities: FormattedPerformanceResult['opportunities'] = [];
        const performanceCategory = result.lighthouseResult.categories.performance;

        if (performanceCategory.auditRefs) {
          for (const auditRef of performanceCategory.auditRefs) {
            const audit = audits[auditRef.id];
            // Only include opportunities with savings and low scores
            if (audit && audit.score !== null && audit.score < 1 && audit.details?.overallSavingsMs) {
              opportunities.push({
                id: audit.id,
                title: audit.title,
                description: audit.description,
                score: audit.score,
                numericValue: audit.numericValue || 0,
                overallSavingsMs: audit.details.overallSavingsMs,
              });
            }
          }
        }

        // Sort opportunities by potential savings (descending)
        opportunities.sort((a, b) => (b.overallSavingsMs || 0) - (a.overallSavingsMs || 0));

        // Step 5: Extract resource summary
        let resourceSummary = undefined;
        if (audits['resource-summary']) {
          resourceSummary = audits['resource-summary'].details;
        }

        // Step 6: Prepare formatted result
        const formattedResult: FormattedPerformanceResult = {
          score: result.lighthouseResult.categories.performance.score * 100,
          categories: {
            performance: {
              score: result.lighthouseResult.categories.performance.score * 100,
              title: result.lighthouseResult.categories.performance.title,
              auditRefs: result.lighthouseResult.categories.performance.auditRefs
            }
          },
          metrics,
          audits: result.lighthouseResult.audits,
          resourceSummary,
          opportunities,
          fetchTime: result.lighthouseResult.fetchTime,
          requestedUrl: result.lighthouseResult.requestedUrl,
          finalUrl: result.lighthouseResult.finalUrl,
          warnings: result.lighthouseResult.runWarnings,
          timestamp: new Date().toISOString()
        };

        // Step 7: Record successful completion with full response
        console.log('Recording successful API call...');
        try {
          await tracker.complete(200, formattedResult);
        } catch (trackerError) {
          console.error('Failed to record success in tracker:', trackerError);
        }

        // Step 8: Return formatted response with callId as documentId
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
    ]) as { documentId: string; result: FormattedPerformanceResult };

    const executionTime = Date.now() - startTime;
    console.log('Performance test completed successfully', {
      documentId,
      executionTime,
      url: body.targetUrl,
      score: result.score,
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
