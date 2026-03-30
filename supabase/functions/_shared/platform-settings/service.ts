/**
 * Platform Settings Service for Edge Functions
 *
 * Provides centralized access to platform-wide configuration settings stored in the
 * platform_settings database table. This service handles AI configuration retrieval
 * with proper validation, error handling, and graceful degradation.
 *
 * **Design Principles**:
 * - Never throw errors - always return null for missing/invalid configurations
 * - Validate all configurations at runtime for type safety
 * - Log all operations with structured context for debugging
 * - Implement graceful degradation for production resilience
 *
 * @module _shared/platform-settings/service
 *
 * @example
 * ```typescript
 * import { createSupabaseClient } from '../_shared/supabase/client.ts';
 * import { PlatformSettingsService } from '../_shared/platform-settings/service.ts';
 *
 * const supabase = createSupabaseClient();
 * const settingsService = new PlatformSettingsService(supabase);
 *
 * // Retrieve AI configuration
 * const prdConfig = await settingsService.getAIConfiguration('ai-create-prd');
 *
 * if (prdConfig) {
 *   console.log('Using PRD configuration:', prdConfig.model);
 * } else {
 *   console.log('PRD configuration not found, using defaults');
 * }
 * ```
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import type { AIConfiguration, PlatformSetting } from '../supabase/types.ts';
import { validateAIConfiguration, type AIConfigurationKey } from './types.ts';

/**
 * Service class for accessing platform settings from the database.
 *
 * Provides type-safe access to platform configurations with built-in validation,
 * error handling, and logging. Designed for use in Supabase Edge Functions.
 *
 * **Features**:
 * - Type-safe AI configuration retrieval
 * - Runtime validation of configuration structure
 * - Graceful error handling with null returns
 * - Comprehensive structured logging
 * - Soft-delete awareness (filters deleted_at IS NULL)
 *
 * @class PlatformSettingsService
 *
 * @example
 * ```typescript
 * // Initialize service with Supabase client
 * const supabase = createSupabaseClient();
 * const service = new PlatformSettingsService(supabase);
 *
 * // Retrieve configuration
 * const config = await service.getAIConfiguration('ai-create-user-story');
 *
 * if (!config) {
 *   return new Response(
 *     JSON.stringify({ error: 'Configuration not found' }),
 *     { status: 404 }
 *   );
 * }
 *
 * // Use configuration for OpenAI
 * const response = await openai.chat.completions.create({
 *   model: config.model,
 *   temperature: config.temperature,
 *   max_tokens: config.token_limit,
 *   messages: [
 *     { role: 'system', content: config.system_prompt },
 *     { role: 'user', content: config.prompt }
 *   ]
 * });
 * ```
 */
export class PlatformSettingsService {
  private supabase: SupabaseClient;

  /**
   * Creates a new PlatformSettingsService instance.
   *
   * @param {SupabaseClient} supabase - Configured Supabase client with service role authentication
   *
   * @example
   * ```typescript
   * import { createSupabaseClient } from '../_shared/supabase/client.ts';
   * import { PlatformSettingsService } from '../_shared/platform-settings/service.ts';
   *
   * const supabase = createSupabaseClient();
   * const service = new PlatformSettingsService(supabase);
   * ```
   */
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Retrieves an AI configuration from platform settings by key.
   *
   * Queries the platform_settings table for a specific AI configuration, validates
   * the structure, and returns it as a type-safe AIConfiguration object.
   *
   * **Query Details**:
   * - Table: `platform_settings`
   * - Filters: `section = 'ai'`, `key = [parameter]`, `deleted_at IS NULL`
   * - Returns: Single row or null
   *
   * **Error Handling**:
   * - Database errors: Logged and returns null
   * - Not found: Returns null without logging (expected case)
   * - Invalid structure: Logged and returns null
   * - Validation failure: Logged and returns null
   *
   * **Return Behavior**:
   * - Success: Returns valid AIConfiguration object
   * - Not found: Returns null (graceful)
   * - Error: Returns null (graceful) + logs error
   *
   * @param {AIConfigurationKey} key - Configuration key (e.g., 'ai-create-prd', 'ai-create-user-story')
   * @returns {Promise<AIConfiguration | null>} Valid AI configuration or null
   *
   * @example
   * ```typescript
   * // Retrieve PRD generation configuration
   * const prdConfig = await service.getAIConfiguration('ai-create-prd');
   *
   * if (prdConfig) {
   *   console.log('PRD Model:', prdConfig.model);
   *   console.log('Temperature:', prdConfig.temperature);
   *   console.log('Token Limit:', prdConfig.token_limit);
   * } else {
   *   console.log('Configuration not found - using defaults');
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Handle multiple configurations with fallback
   * const userStoryConfig =
   *   await service.getAIConfiguration('ai-create-user-story') ||
   *   {
   *     system_prompt: 'You are DR, an AI assistant...',
   *     prompt: 'Generate user stories for: {{content}}',
   *     model: 'gpt-4o',
   *     temperature: 0.7,
   *     token_limit: 2000,
   *     stream: false
   *   };
   * ```
   *
   * @example
   * ```typescript
   * // Use in Edge Function
   * serve(async (req) => {
   *   const { key } = await req.json();
   *
   *   const config = await settingsService.getAIConfiguration(key);
   *
   *   if (!config) {
   *     return new Response(
   *       JSON.stringify({ error: 'AI configuration not found' }),
   *       { status: 404, headers: { 'Content-Type': 'application/json' } }
   *     );
   *   }
   *
   *   // Use config for AI processing...
   * });
   * ```
   */
  async getAIConfiguration(key: AIConfigurationKey): Promise<AIConfiguration | null> {
    const timestamp = new Date().toISOString();
    const logContext = {
      timestamp,
      operation: 'getAIConfiguration',
      key,
      section: 'ai'
    };

    try {
      console.log('[PlatformSettingsService] Fetching AI configuration:', logContext);

      // Query platform_settings table
      const { data, error } = await this.supabase
        .from('platform_settings')
        .select<'*', PlatformSetting>('*')
        .eq('section', 'ai')
        .eq('key', key)
        .is('deleted_at', null)
        .single();

      // Handle database query errors
      if (error) {
        // PGRST116 = No rows found (expected case, not an error)
        if (error.code === 'PGRST116') {
          console.log('[PlatformSettingsService] Configuration not found (expected):', {
            ...logContext,
            code: error.code
          });
          return null;
        }

        // Unexpected database error
        console.error('[PlatformSettingsService] Database query error:', {
          ...logContext,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        return null;
      }

      // Handle no data returned (should not happen with .single() but defensive)
      if (!data) {
        console.log('[PlatformSettingsService] No data returned:', logContext);
        return null;
      }

      // Extract json_value
      const jsonValue = data.json_value;

      // Validate json_value exists
      if (!jsonValue) {
        console.error('[PlatformSettingsService] json_value is null:', {
          ...logContext,
          settingId: data.id,
          label: data.label
        });
        return null;
      }

      // Validate configuration structure
      if (!validateAIConfiguration(jsonValue)) {
        console.error('[PlatformSettingsService] Invalid AI configuration structure:', {
          ...logContext,
          settingId: data.id,
          label: data.label,
          receivedKeys: Object.keys(jsonValue)
        });
        return null;
      }

      // Success - return validated configuration
      console.log('[PlatformSettingsService] Successfully retrieved AI configuration:', {
        ...logContext,
        settingId: data.id,
        label: data.label,
        model: jsonValue.model,
        temperature: jsonValue.temperature,
        tokenLimit: jsonValue.token_limit,
        stream: jsonValue.stream ?? false
      });

      return jsonValue;

    } catch (error) {
      // Catch any unexpected errors (network issues, serialization errors, etc.)
      console.error('[PlatformSettingsService] Unexpected error in getAIConfiguration:', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return null;
    }
  }

  /**
   * Retrieves all AI configurations from platform settings.
   *
   * Queries all active AI configurations and returns them as a key-value map
   * for bulk operations or caching.
   *
   * **Query Details**:
   * - Table: `platform_settings`
   * - Filters: `section = 'ai'`, `deleted_at IS NULL`
   * - Returns: Array of configurations mapped by key
   *
   * @returns {Promise<Record<string, AIConfiguration>>} Map of key to configuration
   *
   * @example
   * ```typescript
   * // Retrieve all AI configurations for caching
   * const allConfigs = await service.getAllAIConfigurations();
   *
   * console.log('Available configurations:', Object.keys(allConfigs));
   * // ['ai-create-prd', 'ai-create-user-story', 'ai-improve-writing']
   *
   * // Access specific configuration
   * const prdConfig = allConfigs['ai-create-prd'];
   * ```
   */
  async getAllAIConfigurations(): Promise<Record<string, AIConfiguration>> {
    const timestamp = new Date().toISOString();
    const logContext = {
      timestamp,
      operation: 'getAllAIConfigurations',
      section: 'ai'
    };

    try {
      console.log('[PlatformSettingsService] Fetching all AI configurations:', logContext);

      const { data, error } = await this.supabase
        .from('platform_settings')
        .select<'*', PlatformSetting>('*')
        .eq('section', 'ai')
        .is('deleted_at', null)
        .order('key', { ascending: true });

      if (error) {
        console.error('[PlatformSettingsService] Database query error:', {
          ...logContext,
          error: error.message,
          code: error.code
        });
        return {};
      }

      if (!data || data.length === 0) {
        console.log('[PlatformSettingsService] No AI configurations found:', logContext);
        return {};
      }

      // Build configurations map with validation
      const configurations: Record<string, AIConfiguration> = {};

      for (const setting of data) {
        if (setting.json_value && validateAIConfiguration(setting.json_value)) {
          configurations[setting.key] = setting.json_value;
        } else {
          console.warn('[PlatformSettingsService] Skipping invalid configuration:', {
            ...logContext,
            key: setting.key,
            settingId: setting.id
          });
        }
      }

      console.log('[PlatformSettingsService] Successfully retrieved AI configurations:', {
        ...logContext,
        count: Object.keys(configurations).length,
        keys: Object.keys(configurations)
      });

      return configurations;

    } catch (error) {
      console.error('[PlatformSettingsService] Unexpected error in getAllAIConfigurations:', {
        ...logContext,
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }
}
