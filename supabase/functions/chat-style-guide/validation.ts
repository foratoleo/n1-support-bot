import {
  ChatStyleGuideRequest,
  ValidationResult,
  GenerationPhase,
  VALID_GENERATION_PHASES,
  ProposedOutline,
} from './types.ts';
import { VALID_ACTIONS, ChatAction } from './config.ts';

/**
 * Validates the request body for chat-style-guide Edge Function.
 *
 * @param body - The request body to validate
 * @returns Validation result with error message if invalid
 */
export function validateRequestBody(body: ChatStyleGuideRequest): ValidationResult {
  // Validate message
  if (!body.message?.trim()) {
    return { valid: false, error: 'Message is required' };
  }

  // Validate action
  if (!body.action) {
    return { valid: false, error: 'Action is required' };
  }

  if (!VALID_ACTIONS.includes(body.action as ChatAction)) {
    return {
      valid: false,
      error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
    };
  }

  // Validate project_id
  if (!body.project_id?.trim()) {
    return { valid: false, error: 'Project ID is required' };
  }

  // Validate target_guide_id is provided for modify action
  if (body.action === 'modify' && !body.target_guide_id?.trim()) {
    return {
      valid: false,
      error: 'Target guide ID is required for modify action',
    };
  }

  // Validate optional fields if provided
  if (body.temperature !== undefined) {
    if (typeof body.temperature !== 'number' || body.temperature < 0 || body.temperature > 2) {
      return {
        valid: false,
        error: 'Temperature must be a number between 0 and 2',
      };
    }
  }

  if (body.token_limit !== undefined) {
    if (typeof body.token_limit !== 'number' || body.token_limit < 100 || body.token_limit > 100000) {
      return {
        valid: false,
        error: 'Token limit must be a number between 100 and 100000',
      };
    }
  }

  // Validate generation_phase if provided
  if (body.generation_phase !== undefined) {
    if (!VALID_GENERATION_PHASES.includes(body.generation_phase as GenerationPhase)) {
      return {
        valid: false,
        error: `Invalid generation_phase. Must be one of: ${VALID_GENERATION_PHASES.join(', ')}`,
      };
    }

    // generation_phase is only applicable for 'generate' action
    if (body.action !== 'generate') {
      return {
        valid: false,
        error: 'generation_phase is only applicable for the generate action',
      };
    }
  }

  // Validate confirmed_outline when generation_phase is 'final'
  if (body.generation_phase === 'final') {
    const outlineValidation = validateConfirmedOutline(body.confirmed_outline);
    if (!outlineValidation.valid) {
      return outlineValidation;
    }
  }

  return { valid: true };
}

/**
 * Validates the confirmed_outline structure for the final generation phase.
 *
 * @param outline - The confirmed outline to validate
 * @returns Validation result with error message if invalid
 */
export function validateConfirmedOutline(
  outline: ProposedOutline | undefined
): ValidationResult {
  if (!outline) {
    return {
      valid: false,
      error: 'confirmed_outline is required when generation_phase is "final"',
    };
  }

  // Validate title
  if (!outline.title || typeof outline.title !== 'string' || !outline.title.trim()) {
    return {
      valid: false,
      error: 'confirmed_outline.title is required and must be a non-empty string',
    };
  }

  // Validate category
  if (!outline.category || typeof outline.category !== 'string' || !outline.category.trim()) {
    return {
      valid: false,
      error: 'confirmed_outline.category is required and must be a non-empty string',
    };
  }

  // Validate sections
  if (!outline.sections || !Array.isArray(outline.sections)) {
    return {
      valid: false,
      error: 'confirmed_outline.sections is required and must be an array',
    };
  }

  // Must have at least one included section
  const includedSections = outline.sections.filter((s) => s.included !== false);
  if (includedSections.length === 0) {
    return {
      valid: false,
      error: 'confirmed_outline must have at least one included section',
    };
  }

  // Validate each section structure
  for (const section of outline.sections) {
    if (!section.id || typeof section.id !== 'string') {
      return {
        valid: false,
        error: 'Each section must have a valid string "id"',
      };
    }

    if (!section.title || typeof section.title !== 'string') {
      return {
        valid: false,
        error: `Section "${section.id}" must have a valid string "title"`,
      };
    }

    if (section.subsections && !Array.isArray(section.subsections)) {
      return {
        valid: false,
        error: `Section "${section.id}" subsections must be an array`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates the HTTP method.
 *
 * @param method - HTTP method to validate
 * @returns Validation result with error message if invalid
 */
export function validateMethod(method: string): ValidationResult {
  if (method !== 'POST') {
    return { valid: false, error: 'Method not allowed' };
  }

  return { valid: true };
}
