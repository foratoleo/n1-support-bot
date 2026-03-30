/**
 * Platform Settings Types for Edge Functions
 *
 * Defines types and validation utilities for accessing platform settings,
 * specifically AI configurations stored in the platform_settings table.
 *
 * @module _shared/platform-settings/types
 *
 * @example
 * ```typescript
 * import { validateAIConfiguration, type AIConfigurationKey } from '../_shared/platform-settings/types.ts';
 *
 * const key: AIConfigurationKey = 'ai-create-prd';
 * const config = await platformSettingsService.getAIConfiguration(key);
 *
 * if (validateAIConfiguration(config)) {
 *   console.log('Valid AI configuration:', config);
 * }
 * ```
 */

import type { AIConfiguration } from '../supabase/types.ts';

/**
 * Valid AI configuration keys for document generation and text processing.
 *
 * These keys correspond to entries in the platform_settings table where:
 * - section = 'ai'
 * - key matches one of these values
 * - json_value contains an AIConfiguration object
 *
 * **Available Keys**:
 * - `ai-create-prd`: Configuration for PRD (Product Requirements Document) generation
 * - `ai-create-user-story`: Configuration for User Story generation
 * - `ai-improve-writing`: Configuration for improving writing quality
 * - `ai-correct-spelling-grammar`: Configuration for spelling and grammar correction
 * - `ai-format-organize`: Configuration for text formatting and organization
 *
 * @typedef {string} AIConfigurationKey
 *
 * @example
 * ```typescript
 * // Valid usage
 * const prdKey: AIConfigurationKey = 'ai-create-prd';
 * const userStoryKey: AIConfigurationKey = 'ai-create-user-story';
 *
 * // Type error - invalid key
 * // const invalidKey: AIConfigurationKey = 'invalid-key'; // ❌ Type error
 * ```
 */
export type AIConfigurationKey =
  | 'ai-create-prd'
  | 'ai-create-user-story'
  | 'ai-create-meeting-notes'
  | 'ai-create-technical-specs'
  | 'ai-create-test-cases'
  | 'ai-chat-style-guide'
  | 'ai-improve-writing'
  | 'ai-correct-spelling-grammar'
  | 'ai-format-organize';

/**
 * Type guard to validate if an unknown object is a valid AIConfiguration.
 *
 * Performs runtime validation of all required fields and their types to ensure
 * the configuration object matches the AIConfiguration interface structure.
 *
 * **Validation Rules**:
 * - Must be a non-null object
 * - `system_prompt`: Required string, non-empty
 * - `prompt`: Required string, non-empty
 * - `model`: Required string, non-empty
 * - `temperature`: Required number
 * - `token_limit`: Required number, positive integer
 * - `stream`: Optional boolean
 *
 * @param {unknown} config - Unknown object to validate
 * @returns {boolean} True if config is a valid AIConfiguration
 *
 * @example
 * ```typescript
 * const unknownData = await fetchFromDatabase();
 *
 * if (validateAIConfiguration(unknownData)) {
 *   // TypeScript now knows unknownData is AIConfiguration
 *   console.log('Model:', unknownData.model);
 *   console.log('Temperature:', unknownData.temperature);
 * } else {
 *   console.error('Invalid AI configuration structure');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Valid configuration
 * const validConfig = {
 *   system_prompt: "You are DR, an AI assistant...",
 *   prompt: "Generate a PRD for: {{content}}",
 *   model: "gpt-4o",
 *   temperature: 0.7,
 *   token_limit: 4000,
 *   stream: true
 * };
 * console.log(validateAIConfiguration(validConfig)); // true
 *
 * // Invalid configuration - missing required fields
 * const invalidConfig = {
 *   model: "gpt-4o",
 *   temperature: 0.7
 * };
 * console.log(validateAIConfiguration(invalidConfig)); // false
 * ```
 */
export function validateAIConfiguration(config: unknown): config is AIConfiguration {
  // Check if config is a non-null object
  if (!config || typeof config !== 'object') {
    return false;
  }

  const c = config as Record<string, unknown>;

  // Validate required string fields are non-empty
  if (typeof c.system_prompt !== 'string' || c.system_prompt.trim().length === 0) {
    return false;
  }

  if (typeof c.prompt !== 'string' || c.prompt.trim().length === 0) {
    return false;
  }

  if (typeof c.model !== 'string' || c.model.trim().length === 0) {
    return false;
  }

  // Validate numeric fields
  if (typeof c.temperature !== 'number' || isNaN(c.temperature)) {
    return false;
  }

  if (typeof c.token_limit !== 'number' || isNaN(c.token_limit) || c.token_limit <= 0) {
    return false;
  }

  // Validate optional boolean field
  if (c.stream !== undefined && typeof c.stream !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Type guard to validate if a string is a valid AIConfigurationKey.
 *
 * Useful for validating user input or request parameters at runtime.
 *
 * @param {string} key - String to validate
 * @returns {boolean} True if key is a valid AIConfigurationKey
 *
 * @example
 * ```typescript
 * const userInput = req.body.key;
 *
 * if (isValidAIConfigurationKey(userInput)) {
 *   // Safe to use as AIConfigurationKey
 *   const config = await service.getAIConfiguration(userInput);
 * } else {
 *   return new Response(
 *     JSON.stringify({ error: 'Invalid configuration key' }),
 *     { status: 400 }
 *   );
 * }
 * ```
 */
export function isValidAIConfigurationKey(key: string): key is AIConfigurationKey {
  const validKeys: AIConfigurationKey[] = [
    'ai-create-prd',
    'ai-create-user-story',
    'ai-create-meeting-notes',
    'ai-create-technical-specs',
    'ai-create-test-cases',
    'ai-chat-style-guide',
    'ai-improve-writing',
    'ai-correct-spelling-grammar',
    'ai-format-organize'
  ];
  return validKeys.includes(key as AIConfigurationKey);
}
