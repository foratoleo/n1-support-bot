import { TokenUsage, InteractionMetadata } from './types.ts';

/**
 * Extract token usage data from OpenAI response
 * Handles missing or malformed data gracefully
 */
export function extractTokenUsage(response: any): TokenUsage {
  const usage = response?.usage || {};

  return {
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    total_tokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0),
  };
}

/**
 * Extract response metadata from OpenAI response
 * Includes conversation ID and other relevant metadata
 */
export function extractResponseMetadata(response: any): InteractionMetadata {
  return {
    conversation_id: response?.id || null,
    model: response?.model || null,
    created: response?.created || null,
    object: response?.object || null,
  };
}
