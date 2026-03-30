/**
 * Supabase Database Type Definitions for Edge Functions
 *
 * Contains TypeScript interfaces for database tables and related types used across Edge Functions.
 * These types ensure type safety when working with Supabase queries.
 *
 * @module _shared/supabase/types
 */

/**
 * AI Configuration object stored in platform_settings.json_value
 *
 * Defines the complete configuration for AI-powered features including model selection,
 * prompts, and generation parameters.
 *
 * @interface AIConfiguration
 *
 * @property {string} system_prompt - AI system instructions and role definition that shapes behavior
 * @property {string} prompt - User-facing prompt template with {{placeholder}} support
 * @property {string} model - Selected AI model identifier (e.g., 'gpt-4o', 'gpt-4o-mini')
 * @property {number} temperature - Randomness control (0.0-2.0): lower = deterministic, higher = creative
 * @property {number} token_limit - Maximum response length in tokens (100-20000)
 * @property {boolean} [stream] - Optional: Enable real-time response streaming for better UX
 *
 * @example
 * ```typescript
 * const aiConfig: AIConfiguration = {
 *   system_prompt: "You are DR, an AI assistant for IT professionals...",
 *   prompt: "Improve the following IT text: {{texto}}",
 *   model: "gpt-4o",
 *   temperature: 0.7,
 *   token_limit: 2000,
 *   stream: true
 * };
 * ```
 */
export interface AIConfiguration {
  system_prompt: string;
  prompt: string;
  model: string;
  temperature: number;
  token_limit: number;
  stream?: boolean;
}

/**
 * Platform Settings database row
 *
 * Represents the `platform_settings` table structure used to store system-wide configurations
 * including AI settings, feature flags, and other platform parameters.
 *
 * **Table**: `platform_settings`
 * **Section Types**: `ai`, `features`, `system`, etc.
 * **Key Format**: `ai-improve-writing`, `ai-correct-spelling-grammar`, etc.
 *
 * @interface PlatformSetting
 *
 * @property {string} id - UUID primary key
 * @property {string} section - Configuration section grouping (e.g., 'ai', 'features')
 * @property {string} key - Unique identifier within section (e.g., 'ai-improve-writing')
 * @property {string} label - Human-readable name displayed in UI
 * @property {string | null} text_value - Optional text configuration value
 * @property {AIConfiguration | null} json_value - Optional JSON configuration object (typed as AIConfiguration for AI settings)
 * @property {string} created_at - ISO 8601 timestamp of creation
 * @property {string} updated_at - ISO 8601 timestamp of last modification
 * @property {string | null} deleted_at - ISO 8601 timestamp of soft deletion (null if active)
 *
 * @example
 * ```typescript
 * // Query AI settings
 * const { data, error } = await supabase
 *   .from('platform_settings')
 *   .select<'*', PlatformSetting>('*')
 *   .eq('section', 'ai')
 *   .is('deleted_at', null);
 *
 * if (data) {
 *   data.forEach(setting => {
 *     if (setting.json_value) {
 *       console.log(`AI Config: ${setting.label}`, setting.json_value);
 *     }
 *   });
 * }
 * ```
 */
export interface PlatformSetting {
  id: string;
  section: string;
  key: string;
  label: string;
  text_value: string | null;
  json_value: AIConfiguration | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * AI Settings query result type
 *
 * Helper type for querying only AI-related platform settings.
 * Filters settings where section = 'ai' and includes type-safe json_value.
 *
 * @example
 * ```typescript
 * const { data: aiSettings, error } = await supabase
 *   .from('platform_settings')
 *   .select<'*', AISettings>('*')
 *   .eq('section', 'ai')
 *   .is('deleted_at', null);
 *
 * // aiSettings is typed as AISettings[]
 * ```
 */
export type AISettings = PlatformSetting & {
  section: 'ai';
  json_value: AIConfiguration;
};

/**
 * Platform Settings query builder type
 *
 * Type-safe query builder for platform_settings table operations.
 * Use this type when constructing Supabase queries with select/insert/update.
 *
 * @example
 * ```typescript
 * import { createSupabaseClient } from './client.ts';
 * import type { PlatformSetting } from './types.ts';
 *
 * const supabase = createSupabaseClient();
 *
 * // Type-safe query
 * const { data, error } = await supabase
 *   .from('platform_settings')
 *   .select<'*', PlatformSetting>('*')
 *   .eq('key', 'ai-improve-writing')
 *   .single();
 * ```
 */
export type PlatformSettingsQuery = {
  select: <T extends string, R = PlatformSetting>(query: T) => Promise<{ data: R[] | null; error: any }>;
  insert: (values: Partial<PlatformSetting>) => Promise<{ data: PlatformSetting | null; error: any }>;
  update: (values: Partial<PlatformSetting>) => Promise<{ data: PlatformSetting | null; error: any }>;
  delete: () => Promise<{ data: null; error: any }>;
};
