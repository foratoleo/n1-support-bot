/**
 * Create Unit Tests Edge Function
 *
 * Generates production-ready unit tests for code functions/classes using OpenAI.
 * Supports multiple languages (JavaScript, TypeScript, Python, Java) and frameworks.
 *
 * Features:
 * - Language-specific test generation with framework best practices
 * - Comprehensive test coverage (happy path, edge cases, errors)
 * - Automatic token usage tracking and cost calculation
 * - Conversation continuity via OpenAI Responses API
 * - Integration with platform settings for configuration
 *
 * @module create-unit-tests
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  UnitTestRequestBody,
  UnitTestFormData,
} from '../_shared/document-generation/types.ts';
import { OpenAIService } from '../_shared/document-generation/openai-service.ts';
import { validateMethod } from '../_shared/document-generation/validation.ts';
import { extractOutputText, buildInputMessages } from '../_shared/document-generation/openai-helper.ts';
import {
  formatSuccessResponse,
  formatErrorResponse,
  getErrorStatusCode,
  createResponse,
  createCorsResponse,
} from '../_shared/document-generation/response-builder.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { PlatformSettingsService } from '../_shared/platform-settings/service.ts';
import { loadConfiguration } from '../_shared/platform-settings/config-loader.ts';
import { CONFIG_KEY, OPENAI_CONFIG } from './config.ts';
import { AIConfigurationKey } from '../_shared/platform-settings/types.ts';
import { AIInteractionService } from '../_shared/document-generation/ai-interaction-service.ts';
import { GeneratedDocumentService } from '../_shared/document-generation/generated-document-service.ts';
import { validateUnitTestRequest, validateBasicFields } from './validation.ts';
import { buildUnitTestPrompts } from './prompt-builder.ts';

const OPERATION = 'create-unit-tests';

// Initialize OpenAI API key
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openaiService = new OpenAIService(OPENAI_API_KEY, OPERATION);

// Initialize Supabase client and services
const supabase = createSupabaseClient();
const platformSettingsService = new PlatformSettingsService(supabase);
const aiInteractionService = new AIInteractionService(supabase, OPERATION);
const documentService = new GeneratedDocumentService(supabase, OPERATION);

/**
 * Main Edge Function handler
 * Processes unit test generation requests with comprehensive error handling
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    // T4.1: Setup request parsing
    console.log(`[${OPERATION}] Processing request`);

    // Validate HTTP method
    const methodValidation = validateMethod(req.method);
    if (!methodValidation.valid) {
      console.error(`[${OPERATION}] Invalid method:`, methodValidation.error);
      const errorData = formatErrorResponse(methodValidation.error!);
      const statusCode = getErrorStatusCode(methodValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Parse request body
    const body: UnitTestRequestBody = await req.json();

    if (body.user_id) {
      console.log(`[${OPERATION}] user_id:`, body.user_id);
    }

    // T4.2: Integrate validation
    console.log(`[${OPERATION}] Validating request`);

    // Validate basic fields (content, project_id)
    const basicValidation = validateBasicFields(body);
    if (!basicValidation.valid) {
      console.error(`[${OPERATION}] Basic validation failed:`, basicValidation.error);
      const errorData = formatErrorResponse(basicValidation.error!);
      const statusCode = getErrorStatusCode(basicValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Validate unit test specific content
    const contentValidation = validateUnitTestRequest(body.content);
    if (!contentValidation.valid) {
      console.error(`[${OPERATION}] Content validation failed:`, contentValidation.error);
      if (contentValidation.details) {
        console.log(`[${OPERATION}] Validation details:`, contentValidation.details);
      }
      const errorData = formatErrorResponse(contentValidation.error!);
      const statusCode = getErrorStatusCode(contentValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Log validation warnings if present
    if (contentValidation.details && contentValidation.details.length > 0) {
      console.warn(`[${OPERATION}] Validation warnings:`, contentValidation.details);
    }

    // Parse validated content
    let formData: UnitTestFormData;
    try {
      formData = JSON.parse(body.content);
      console.log(`[${OPERATION}] Parsed form data:`, {
        language: formData.language,
        framework: formData.framework,
        functionName: formData.functionName,
        scenarioCount: formData.testScenarios.length,
      });
    } catch (error) {
      console.error(`[${OPERATION}] Failed to parse content:`, error);
      throw new Error('Invalid JSON in content field');
    }

    // Load configuration with precedence: request > database > defaults
    console.log(`[${OPERATION}] Loading configuration`);
    const { config } = await loadConfiguration(
      platformSettingsService,
      CONFIG_KEY as AIConfigurationKey,
      OPENAI_CONFIG,
      {
        model: body.model,
        temperature: body.temperature,
        token_limit: body.token_limit,
      },
      `[${OPERATION}]`
    );

    console.log(`[${OPERATION}] Using model:`, config.model, 'temperature:', config.temperature);

    // T4.3: Implement OpenAI call with prompt construction
    console.log(`[${OPERATION}] Building prompts`);

    // Build language and framework-specific prompts
    let systemPrompt: string;
    let userPrompt: string;

    try {
      const prompts = buildUnitTestPrompts(formData);
      systemPrompt = prompts.systemPrompt;
      userPrompt = prompts.userPrompt;

      // Allow system_prompt override from request
      if (body.system_prompt) {
        console.log(`[${OPERATION}] Using custom system prompt from request`);
        systemPrompt = body.system_prompt;
      }

      // Allow user_prompt override from request
      if (body.user_prompt) {
        console.log(`[${OPERATION}] Using custom user prompt from request`);
        userPrompt = body.user_prompt;
      }

      console.log(`[${OPERATION}] Prompts built successfully`);
    } catch (promptError) {
      console.error(`[${OPERATION}] Failed to build prompts:`, promptError);
      throw promptError;
    }

    // Build input messages for OpenAI
    const input = buildInputMessages(systemPrompt, userPrompt, body.content);

    // T4.4: Add interaction tracking
    console.log(`[${OPERATION}] Creating AI interaction record`);

    const interactionId = await aiInteractionService.createInteraction({
      project_id: body.project_id,
      request_prompt: userPrompt,
      request_model: config.model,
      request_parameters: {
        ...config,
        language: formData.language,
        framework: formData.framework,
        functionName: formData.functionName,
        scenarioCount: formData.testScenarios.length,
      },
      previous_interaction_id: body.previous_response_id,
      meeting_transcript_id: body.meeting_transcript_id,
    });

    console.log(`[${OPERATION}] AI interaction created:`, interactionId);

    const startTime = Date.now();

    try {
      // Update interaction status to in_progress
      await aiInteractionService.updateInteractionInProgress(interactionId);
      console.log(`[${OPERATION}] Calling OpenAI API`);

      // Call OpenAI with retry logic (handled by OpenAIService)
      const resp = await openaiService.generateDocument(
        input,
        body.project_id,
        body.previous_response_id,
        config
      );

      // Extract generated test code from response
      const document = extractOutputText(resp);

      if (!document) {
        console.error(`[${OPERATION}] Failed to generate unit tests - empty response`);
        throw new Error('Failed to generate unit tests');
      }

      console.log(`[${OPERATION}] Unit tests generated successfully (${document.length} characters)`);

      // Complete interaction with response data
      await aiInteractionService.completeInteraction(
        interactionId,
        resp,
        document,
        startTime
      );

      console.log(`[${OPERATION}] AI interaction completed`);

      // T4.5: Implement document storage
      console.log(`[${OPERATION}] Storing generated document`);

      const storedDocument = await documentService.storeDocument({
        content: document,
        document_type: 'unit-tests',
        document_name: `Unit Tests - ${formData.functionName}`,
        project_id: body.project_id,
        user_id: body.user_id,
        ai_interaction_id: interactionId,
        meeting_transcript_id: body.meeting_transcript_id,
      });

      console.log(`[${OPERATION}] Document stored successfully`);

      // T4.6: Build response formatting
      const successData = formatSuccessResponse(
        document,
        resp.id,
        storedDocument?.id,
        storedDocument?.name
      );
      return createResponse(successData, 200);

    } catch (genError) {
      // Mark interaction as failed with error details
      console.error(`[${OPERATION}] Generation error:`, genError);
      await aiInteractionService.failInteraction(interactionId, genError as Error, startTime);
      throw genError;
    }

  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    // Format error response based on error type
    const errorData = formatErrorResponse(error);
    const statusCode = getErrorStatusCode(error);
    return createResponse(errorData, statusCode);
  }
});
