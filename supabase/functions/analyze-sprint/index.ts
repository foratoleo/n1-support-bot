import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { RequestBody } from '../_shared/document-generation/types.ts';
import { OpenAIService } from '../_shared/document-generation/openai-service.ts';
import { validateRequestBody, validateMethod } from '../_shared/document-generation/validation.ts';
import { extractOutputText, buildInputMessages } from '../_shared/document-generation/openai-helper.ts';
import {
  formatSuccessResponse,
  formatErrorResponse,
  getErrorStatusCode,
  createResponse,
  createCorsResponse
} from '../_shared/document-generation/response-builder.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { PlatformSettingsService } from '../_shared/platform-settings/service.ts';
import { loadConfiguration } from '../_shared/platform-settings/config-loader.ts';
import { buildPrompts } from '../_shared/document-generation/prompt-builder.ts';
import { CONFIG_KEY, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT, OPENAI_CONFIG } from './config.ts';
import { AIConfigurationKey } from '../_shared/platform-settings/types.ts';
import { AIInteractionService } from '../_shared/document-generation/ai-interaction-service.ts';

const OPERATION = 'analyze-sprint';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openaiService = new OpenAIService(OPENAI_API_KEY, OPERATION);

const supabase = createSupabaseClient();
const platformSettingsService = new PlatformSettingsService(supabase);
const aiInteractionService = new AIInteractionService(supabase, OPERATION);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    const methodValidation = validateMethod(req.method);
    if (!methodValidation.valid) {
      const errorData = formatErrorResponse(methodValidation.error!);
      const statusCode = getErrorStatusCode(methodValidation.error!);
      return createResponse(errorData, statusCode);
    }

    const body: RequestBody = await req.json();

    if (body.user_id) {
      console.log(`[${OPERATION}] user_id:`, body.user_id);
    }

    const bodyValidation = validateRequestBody(body);
    if (!bodyValidation.valid) {
      const errorData = formatErrorResponse(bodyValidation.error!);
      const statusCode = getErrorStatusCode(bodyValidation.error!);
      return createResponse(errorData, statusCode);
    }

    const { config } = await loadConfiguration(
      platformSettingsService,
      CONFIG_KEY as AIConfigurationKey,
      OPENAI_CONFIG,
      {
        model: body.model,
        temperature: body.temperature,
        token_limit: body.token_limit
      },
      `[${OPERATION}]`
    );

    const dbConfig = await platformSettingsService.getAIConfiguration(CONFIG_KEY as AIConfigurationKey);
    const { systemPrompt, userPrompt } = buildPrompts(
      body.content,
      DEFAULT_SYSTEM_PROMPT,
      DEFAULT_USER_PROMPT,
      dbConfig || {},
      {
        system_prompt: body.system_prompt,
        user_prompt: body.user_prompt
      },
      `[${OPERATION}]`
    );

    const input = buildInputMessages(systemPrompt, userPrompt, body.content);

    const interactionId = await aiInteractionService.createInteraction({
      project_id: body.project_id,
      request_prompt: userPrompt,
      request_model: config.model,
      request_parameters: config,
      previous_interaction_id: body.previous_response_id,
    });

    const startTime = Date.now();

    try {
      await aiInteractionService.updateInteractionInProgress(interactionId);

      const resp = await openaiService.generateDocument(
        input,
        body.project_id,
        body.previous_response_id,
        config
      );

      const document = extractOutputText(resp);

      if (!document) {
        console.error(`[${OPERATION}] Failed to generate analysis`);
        throw new Error('Failed to generate analysis');
      }

      try {
        JSON.parse(document);
      } catch (parseError) {
        console.error(`[${OPERATION}] Invalid JSON response:`, parseError);
        throw new Error('Generated analysis is not valid JSON');
      }

      console.log(`[${OPERATION}] Analysis generated successfully`);

      await aiInteractionService.completeInteraction(
        interactionId,
        resp,
        document,
        startTime
      );

      const successData = formatSuccessResponse(
        document,
        resp.id,
        undefined,
        undefined
      );
      return createResponse(successData, 200);
    } catch (genError) {
      await aiInteractionService.failInteraction(interactionId, genError as Error, startTime);
      throw genError;
    }

  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    const errorData = formatErrorResponse(error);
    const statusCode = getErrorStatusCode(error);
    return createResponse(errorData, statusCode);
  }
});
