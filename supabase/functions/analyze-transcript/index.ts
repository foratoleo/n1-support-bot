import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { OpenAIService } from '../_shared/document-generation/openai-service.ts';
import { validateMethod } from '../_shared/document-generation/validation.ts';
import { extractOutputText, buildInputMessages } from '../_shared/document-generation/openai-helper.ts';
import {
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

const OPERATION = 'analyze-transcript';
const MAX_TRANSCRIPT_SIZE = 50000;

/**
 * Request body interface for analyze-transcript Edge Function
 */
interface AnalyzeTranscriptRequest {
  content: string;
  project_id?: string;
  user_id?: string;
  model?: string;
  temperature?: number;
  token_limit?: number;
}

/**
 * Transcript analysis result structure
 */
interface TranscriptAnalysis {
  title: string;
  description: string;
  meeting_date: string | null;
  tags: string[];
  recommended_documents: string[];
  confidence_scores: {
    title: number;
    description: number;
    meeting_date: number;
  };
}

/**
 * Response data interface for analyze-transcript Edge Function
 */
interface AnalyzeTranscriptResponse {
  success: boolean;
  analysis?: TranscriptAnalysis;
  response_id?: string;
  error?: string;
}

/**
 * Validates the request body for analyze-transcript
 */
function validateRequestBody(body: AnalyzeTranscriptRequest): { valid: boolean; error?: string } {
  if (!body.content?.trim()) {
    return { valid: false, error: 'Content is required' };
  }

  if (body.content.length > MAX_TRANSCRIPT_SIZE) {
    return { valid: false, error: `Transcript too large. Maximum size is ${MAX_TRANSCRIPT_SIZE} characters` };
  }

  return { valid: true };
}

/**
 * Formats success response for analyze-transcript
 */
function formatSuccessResponse(
  analysis: TranscriptAnalysis,
  responseId: string
): AnalyzeTranscriptResponse {
  return {
    success: true,
    analysis,
    response_id: responseId
  };
}

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openaiService = new OpenAIService(OPENAI_API_KEY, OPERATION);

// Initialize Supabase client and Platform Settings Service
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

    const body: AnalyzeTranscriptRequest = await req.json();

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
      {},
      `[${OPERATION}]`
    );

    const input = buildInputMessages(systemPrompt, userPrompt, body.content);

    // Create AI interaction record if project_id is provided
    let interactionId: string | undefined;
    if (body.project_id) {
      interactionId = await aiInteractionService.createInteraction({
        project_id: body.project_id,
        request_prompt: userPrompt,
        request_model: config.model,
        request_parameters: config,
      });
    }

    const startTime = Date.now();

    try {
      // Update interaction to in_progress if tracking
      if (interactionId) {
        await aiInteractionService.updateInteractionInProgress(interactionId);
      }

      const resp = await openaiService.generateDocument(
        input,
        body.project_id || 'no-project',
        undefined,
        config
      );

      const rawOutput = extractOutputText(resp);

      if (!rawOutput) {
        console.error(`[${OPERATION}] Failed to extract analysis from response`);
        throw new Error('Failed to extract analysis from response');
      }

      // Parse JSON from the output (may be wrapped in code fences)
      let analysis: TranscriptAnalysis;
      try {
        // Try to extract JSON from code fences or parse directly
        const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        analysis = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error(`[${OPERATION}] Failed to parse analysis JSON:`, rawOutput);
        throw new Error('Invalid JSON response from AI');
      }

      console.log(`[${OPERATION}] Analysis completed successfully`);

      // Complete interaction with response data if tracking
      if (interactionId) {
        await aiInteractionService.completeInteraction(
          interactionId,
          resp,
          JSON.stringify(analysis),
          startTime
        );
      }

      const successData = formatSuccessResponse(analysis, resp.id);
      return createResponse(successData, 200);
    } catch (genError) {
      // Mark interaction as failed if tracking
      if (interactionId) {
        await aiInteractionService.failInteraction(interactionId, genError as Error, startTime);
      }
      throw genError;
    }

  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    const errorData = formatErrorResponse(error);
    const statusCode = getErrorStatusCode(error);
    return createResponse(errorData, statusCode);
  }
});
