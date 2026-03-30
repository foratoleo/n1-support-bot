import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateRequest, ValidationError, NotFoundError, DatabaseError } from './utils/validation.ts';
import { formatSuccessResponse, formatErrorResponse } from './utils/response-formatter.ts';
import { FUNCTION_TIMEOUT } from './config.ts';
import { SupabaseClientFactory } from './services/supabase-factory.ts';
import { RequestParser } from './services/request-parser.ts';
import { ServiceCallRepository } from './services/database.ts';
import { ServiceCallValidator } from './services/validator.ts';
import { MarkdownGenerator } from './services/markdown-generator.ts';
import { Logger } from './services/logger.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let timeoutId: number | undefined;

  try {
    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed. Use POST.', 'method');
    }

    const parser = new RequestParser();
    const logger = new Logger();

    const body = await parser.parse(req);
    logger.logRequest(body);

    validateRequest(body);

    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Function execution timeout exceeded'));
      }, FUNCTION_TIMEOUT);
    });

    const workflowPromise = (async () => {
      const supabaseClient = SupabaseClientFactory.create(req.headers.get('Authorization') || '');
      const repository = new ServiceCallRepository(supabaseClient);
      const validator = new ServiceCallValidator();
      const generator = new MarkdownGenerator();

      logger.logFetching(body.id);
      const serviceCall = await repository.findById(body.id);

      validator.validateFilters(serviceCall, body.serviceName, body.serviceCategory);

      logger.logFound(
        serviceCall.id,
        serviceCall.service_name,
        serviceCall.service_category,
        serviceCall.response_status
      );

      logger.logFormatterSelected(serviceCall.service_category, serviceCall.service_name);
      logger.logGenerating();

      const { markdown, metadata } = generator.generate(serviceCall, body.resultType);

      logger.logSuccess(serviceCall.id, markdown.length);

      return { markdown, metadata };
    })();

    const { markdown, metadata } = await Promise.race([
      workflowPromise,
      timeoutPromise,
    ]) as { markdown: string; metadata: any };

    const executionTime = Date.now() - startTime;
    logger.logCompletion(body.id, executionTime, markdown.length);

    return formatSuccessResponse({
      markdown,
      metadata,
      executionTime,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const logger = new Logger();

    if (error instanceof Error) {
      logger.logError(error, executionTime);
    }

    if (error instanceof ValidationError) {
      return formatErrorResponse(error, 400);
    }

    if (error instanceof NotFoundError) {
      return formatErrorResponse(error, 404);
    }

    if (error instanceof DatabaseError) {
      return formatErrorResponse(error, 500);
    }

    return formatErrorResponse(
      error instanceof Error ? error : new Error('An unexpected error occurred'),
      500
    );
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
});
