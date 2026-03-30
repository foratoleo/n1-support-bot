import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { OpenAIService } from '../_shared/document-generation/openai-service.ts';
import { extractOutputText, extractRawOutputText, buildInputMessages } from '../_shared/document-generation/openai-helper.ts';
import {
  formatErrorResponse,
  getErrorStatusCode,
  createResponse,
  createCorsResponse,
} from '../_shared/document-generation/response-builder.ts';
import type { ResponseData } from '../_shared/document-generation/types.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { PlatformSettingsService } from '../_shared/platform-settings/service.ts';
import { loadConfiguration } from '../_shared/platform-settings/config-loader.ts';
import { AIInteractionService } from '../_shared/document-generation/ai-interaction-service.ts';
import { extractTokenUsage } from '../_shared/document-generation/token-extractor.ts';

import {
  CONFIG_KEY,
  OPERATION,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  OPENAI_CONFIG,
  DEFAULT_EXTENDED_CONFIG,
  FINAL_GENERATION_TOKEN_LIMIT,
  buildConfigurableSystemPrompt,
  extractExtendedConfig,
  type StyleGuideChatExtendedConfig,
} from './config.ts';
import { StyleGuideChatService } from './service.ts';
import { validateRequestBody, validateMethod } from './validation.ts';
import {
  ChatStyleGuideRequest,
  ChatStyleGuideResponse,
  ChatMetadata,
  type GenerationPhase,
  type ProposedOutline,
} from './types.ts';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize OpenAI API key
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

// Initialize services
const openaiService = new OpenAIService(OPENAI_API_KEY, OPERATION);
const supabase = createSupabaseClient();
const platformSettingsService = new PlatformSettingsService(supabase);
const aiInteractionService = new AIInteractionService(supabase, OPERATION);
const styleGuideChatService = new StyleGuideChatService(supabase);

/**
 * Formats a successful chat response with optional two-phase fields.
 */
function formatChatResponse(
  response: string,
  conversationId: string | null,
  suggestedContent: string | null,
  suggestedName: string | null,
  suggestedCategory: string | null,
  actionRequired: ChatStyleGuideResponse['action_required'],
  metadata: ChatMetadata,
  proposedOutline?: ProposedOutline | null
): ChatStyleGuideResponse {
  return {
    success: true,
    response,
    conversation_id: conversationId || undefined,
    suggested_content: suggestedContent || undefined,
    suggested_name: suggestedName || undefined,
    suggested_category: suggestedCategory || undefined,
    action_required: actionRequired,
    metadata,
    proposed_outline: proposedOutline || undefined,
  };
}

/**
 * Formats an error response.
 */
function formatChatErrorResponse(error: Error | string): ChatStyleGuideResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : error,
    action_required: 'none',
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  const startTime = Date.now();

  try {
    // Validate HTTP method
    const methodValidation = validateMethod(req.method);
    if (!methodValidation.valid) {
      const errorData = formatChatErrorResponse(methodValidation.error!);
      return createResponse(errorData as ResponseData, 405);
    }

    // Parse request body
    const body: ChatStyleGuideRequest = await req.json();

    // Resolve the effective generation phase
    const generationPhase = styleGuideChatService.resolveGenerationPhase(
      body.action,
      body.generation_phase
    );

    console.log(`[${OPERATION}] Received request:`, {
      action: body.action,
      project_id: body.project_id,
      user_id: body.user_id,
      generation_phase: generationPhase,
      has_target_guide: !!body.target_guide_id,
      has_previous_response: !!body.previous_response_id,
      has_confirmed_outline: !!body.confirmed_outline,
    });

    // Validate request body
    const bodyValidation = validateRequestBody(body);
    if (!bodyValidation.valid) {
      const errorData = formatChatErrorResponse(bodyValidation.error!);
      return createResponse(errorData as ResponseData, 400);
    }

    // Load configuration with precedence: request > database > default
    const { config, source } = await loadConfiguration(
      platformSettingsService,
      CONFIG_KEY,
      OPENAI_CONFIG,
      {
        model: body.model,
        temperature: body.temperature,
        token_limit: body.token_limit,
      },
      `[${OPERATION}]`
    );

    // Override token limit for final generation phase
    if (generationPhase === 'final' && !body.token_limit) {
      config.max_output_tokens = FINAL_GENERATION_TOKEN_LIMIT;
      config.token_limit = FINAL_GENERATION_TOKEN_LIMIT;
      console.log(`[${OPERATION}] Final phase: increased token limit to ${FINAL_GENERATION_TOKEN_LIMIT}`);
    }

    // Extract extended configuration from database config (if available)
    // The loadConfiguration returns merged config, but we need the raw DB config for extended fields
    let extendedConfig: StyleGuideChatExtendedConfig = { ...DEFAULT_EXTENDED_CONFIG };

    // Try to extract extended config from the loaded config object
    // These fields are stored in the same json_value in platform_settings
    const rawConfig = config as Record<string, unknown>;
    const extractedExtended = extractExtendedConfig(rawConfig);

    // Merge with defaults, giving precedence to extracted values
    extendedConfig = {
      ...DEFAULT_EXTENDED_CONFIG,
      ...extractedExtended,
    };

    console.log(`[${OPERATION}] Extended configuration:`, {
      guideLanguage: extendedConfig.guideLanguage,
      detailLevel: extendedConfig.detailLevel,
      includeExamples: extendedConfig.includeExamples,
      maxGuidesInContext: extendedConfig.maxGuidesInContext,
      hasActionQueries: !!extendedConfig.actionQueries,
      configSource: source,
      generationPhase,
    });

    // Fetch active style guides for context (respecting maxGuidesInContext)
    const styleGuides = await styleGuideChatService.fetchActiveStyleGuides(
      extendedConfig.maxGuidesInContext
    );

    // If modify action, also fetch the target guide
    let targetGuide = null;
    if (body.action === 'modify' && body.target_guide_id) {
      targetGuide = await styleGuideChatService.fetchStyleGuideById(body.target_guide_id);
      if (!targetGuide) {
        const errorData = formatChatErrorResponse('Target style guide not found');
        return createResponse(errorData as ResponseData, 404);
      }
    }

    // Build context from style guides
    const context = styleGuideChatService.buildContext(styleGuides);

    // Build system prompt with configurable placeholders replaced
    const baseSystemPrompt = config.system_prompt || DEFAULT_SYSTEM_PROMPT;
    const systemPromptConfigured = buildConfigurableSystemPrompt(baseSystemPrompt, extendedConfig);

    // Inject context into system prompt
    let systemPromptWithContext = systemPromptConfigured.replace('{{context}}', context);

    // Append phase-specific instructions to the system prompt
    if (generationPhase === 'proposal') {
      systemPromptWithContext += '\n\n' + styleGuideChatService.buildProposalInstructions(extendedConfig.guideLanguage);
      console.log(`[${OPERATION}] Proposal phase: appended proposal instructions (language: ${extendedConfig.guideLanguage})`);
    } else if (generationPhase === 'final' && body.confirmed_outline) {
      systemPromptWithContext += '\n\n' + styleGuideChatService.buildFinalGenerationPrompt(body.confirmed_outline, extendedConfig.guideLanguage);
      console.log(`[${OPERATION}] Final phase: appended final generation instructions with ${body.confirmed_outline.sections.filter(s => s.included !== false).length} confirmed sections (language: ${extendedConfig.guideLanguage})`);
    }

    // Build action-specific instructions (may use custom instructions from config)
    const actionInstructions = styleGuideChatService.buildActionInstructions(
      body.action,
      body.target_guide_id,
      extendedConfig.actionQueries
    );

    // Build user message with action instructions
    let userMessage = body.message + actionInstructions;

    // If modifying, include the target guide content
    if (targetGuide) {
      userMessage += `\n\n## Guia de Estilo Atual (${targetGuide.name}):\n\n${targetGuide.content}`;
    }

    // Build input messages for OpenAI
    const input = buildInputMessages(
      systemPromptWithContext,
      DEFAULT_USER_PROMPT,
      userMessage
    );

    // Create AI interaction record
    const interactionId = await aiInteractionService.createInteraction({
      project_id: body.project_id,
      request_prompt: userMessage,
      request_model: config.model,
      request_parameters: {
        ...config,
        action: body.action,
        generation_phase: generationPhase,
        target_guide_id: body.target_guide_id,
        // Include extended config for tracking
        guideLanguage: extendedConfig.guideLanguage,
        detailLevel: extendedConfig.detailLevel,
        includeExamples: extendedConfig.includeExamples,
      },
      previous_interaction_id: body.previous_response_id,
    });

    try {
      // Update interaction to in_progress
      await aiInteractionService.updateInteractionInProgress(interactionId);

      // Call OpenAI API
      const resp = await openaiService.generateDocument(
        input,
        body.project_id,
        body.previous_response_id || body.conversation_id,
        config
      );

      // Extract response text - use raw for content extraction, cleaned for display
      const rawResponse = extractRawOutputText(resp);
      const aiResponse = extractOutputText(resp); // Cleaned version for display

      if (!aiResponse) {
        console.error(`[${OPERATION}] Failed to generate response`);
        throw new Error('Failed to generate response');
      }

      console.log(`[${OPERATION}] Response generated successfully, raw length: ${rawResponse.length}, cleaned length: ${aiResponse.length}`);

      // Extract conversation ID from response
      const conversationId = resp.id || null;

      // Phase-specific response processing
      let actionRequired: ChatStyleGuideResponse['action_required'];
      let suggestedContent: string | null = null;
      let suggestedName: string | null = null;
      let suggestedCategory: string | null = null;
      let proposedOutline: ProposedOutline | null = null;

      if (generationPhase === 'proposal') {
        // PROPOSAL PHASE: Extract the proposed outline from AI response
        proposedOutline = styleGuideChatService.extractProposedOutline(rawResponse);

        if (proposedOutline) {
          actionRequired = 'review_outline';
          suggestedName = proposedOutline.title;
          suggestedCategory = proposedOutline.category;
          console.log(`[${OPERATION}] Proposal phase: extracted outline with ${proposedOutline.sections.length} sections`);
        } else {
          // Fallback: AI didn't produce a parseable outline - treat as standard response
          actionRequired = styleGuideChatService.determineAction(body.action, aiResponse);
          suggestedContent = styleGuideChatService.extractSuggestedContent(rawResponse);
          console.log(`[${OPERATION}] Proposal phase: no outline found, falling back to standard processing`);
        }
      } else if (generationPhase === 'final') {
        // FINAL PHASE: Extract the full generated document
        actionRequired = styleGuideChatService.determineAction(body.action, aiResponse);
        suggestedContent = styleGuideChatService.extractSuggestedContent(rawResponse);

        console.log(`[${OPERATION}] Final phase: content extraction result: ${suggestedContent ? `found (${suggestedContent.length} chars)` : 'not found'}, action: ${actionRequired}`);
      } else {
        // STANDARD FLOW: Non-generate actions or direct generation
        actionRequired = styleGuideChatService.determineAction(body.action, aiResponse);
        suggestedContent = styleGuideChatService.extractSuggestedContent(rawResponse);

        console.log(`[${OPERATION}] Standard flow: content extraction result: ${suggestedContent ? `found (${suggestedContent.length} chars)` : 'not found'}, action: ${actionRequired}`);
      }

      // Extract suggested name and category for create/modify actions (if not already set by proposal)
      if (actionRequired !== 'none' && actionRequired !== 'review_outline' && suggestedContent) {
        if (!suggestedName) {
          suggestedName = styleGuideChatService.extractSuggestedName(suggestedContent, aiResponse);
        }
        if (!suggestedCategory) {
          suggestedCategory = styleGuideChatService.extractSuggestedCategory(aiResponse);
        }
        console.log(`[${OPERATION}] Metadata extraction: name="${suggestedName}", category="${suggestedCategory}"`);
      }

      // Extract sources used
      const sourcesUsed = styleGuideChatService.extractSourcesUsed(aiResponse, styleGuides);

      // Extract token usage
      const tokenUsage = extractTokenUsage(resp);

      // Build metadata
      const metadata: ChatMetadata = {
        sources_used: sourcesUsed,
        token_usage: tokenUsage,
        action_processed: body.action,
        processing_time_ms: Date.now() - startTime,
        generation_phase: generationPhase || undefined,
      };

      // Complete AI interaction record
      await aiInteractionService.completeInteraction(
        interactionId,
        resp,
        aiResponse,
        startTime
      );

      // Build and return success response
      const successData = formatChatResponse(
        aiResponse,
        conversationId,
        suggestedContent,
        suggestedName,
        suggestedCategory,
        actionRequired,
        metadata,
        proposedOutline
      );

      return new Response(JSON.stringify(successData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      });
    } catch (genError) {
      // Mark interaction as failed
      await aiInteractionService.failInteraction(interactionId, genError as Error, startTime);
      throw genError;
    }
  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    const errorData = formatChatErrorResponse(error as Error);
    const statusCode = getErrorStatusCode(error as Error);

    return new Response(JSON.stringify(errorData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      status: statusCode,
    });
  }
});
