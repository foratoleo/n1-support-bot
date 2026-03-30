/**
 * Configuration defaults, constants and loader for the RAG Context module
 *
 * Provides default configuration values and a database-backed loader that
 * merges stored settings with defaults. Falls back to defaults gracefully
 * on any error, ensuring RAG context always has a valid configuration.
 *
 * Configuration is stored in platform_settings:
 *   - section: 'rag'
 *   - key: 'rag-context-config'
 *
 * @module _shared/rag-context/config
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import type { RagContextConfig } from './types.ts';

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_MAX_CONTEXT_TOKENS = 6000;
const DEFAULT_SEMANTIC_WEIGHT = 0.7;
const DEFAULT_KEYWORD_WEIGHT = 0.3;

const MIN_SIMILARITY_THRESHOLD = 0.0;
const MAX_SIMILARITY_THRESHOLD = 1.0;

const MIN_MAX_RESULTS = 1;
const MAX_MAX_RESULTS = 50;

const MIN_MAX_CONTEXT_TOKENS = 100;
const MAX_MAX_CONTEXT_TOKENS = 16000;

const MIN_WEIGHT = 0.0;
const MAX_WEIGHT = 1.0;

const WEIGHT_SUM_TARGET = 1.0;
const WEIGHT_SUM_TOLERANCE = 0.001;

/** Key used to look up the RAG configuration in platform_settings */
export const PLATFORM_SETTINGS_RAG_KEY = 'rag-context-config';

/** Section used to look up the RAG configuration in platform_settings */
export const PLATFORM_SETTINGS_RAG_SECTION = 'rag';

/**
 * Characters-per-token heuristic for estimating token counts.
 * Matches the same constant used by the chunker in _shared/indexing.
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Default RAG context configuration.
 * Applied when no entry exists in platform_settings or when the stored
 * configuration is invalid or missing.
 */
export const RAG_CONTEXT_DEFAULTS: RagContextConfig = {
  enabled: true,
  max_results: DEFAULT_MAX_RESULTS,
  similarity_threshold: DEFAULT_SIMILARITY_THRESHOLD,
  max_context_tokens: DEFAULT_MAX_CONTEXT_TOKENS,
  scope: 'project_only',
  semantic_weight: DEFAULT_SEMANTIC_WEIGHT,
  keyword_weight: DEFAULT_KEYWORD_WEIGHT,
  content_types_by_creation: {
    tasks: ['task', 'feature', 'backlog-item', 'prd', 'user-story', 'technical-specs', 'knowledge-base', 'project-document', 'style-guide'],
    features: ['feature', 'prd', 'user-story', 'meeting-notes', 'meeting-transcript', 'backlog-item', 'knowledge-base', 'project-document'],
    backlog_items: ['backlog-item', 'task', 'feature', 'prd', 'user-story', 'knowledge-base', 'project-document'],
  },
};

/**
 * Fixed Markdown instruction injected into the user prompt when RAG context is used.
 * Guides the AI to leverage the retrieved context when generating new artefacts.
 * Only included when ragResult.used === true.
 */
export const RAG_PROMPT_INSTRUCTION = `## Instructions for Using Project Context

The "Project Context" block above contains relevant documents retrieved from the project knowledge base.
When generating output, leverage this context to:
1. **Avoid duplication**: If you find very similar items, reference or explicitly differentiate them
2. **Align naming**: Use the same names, terms, and patterns already established in the project
3. **Consider dependencies**: Take into account relationships with existing items
4. **Maintain consistency**: Respect previous architectural and product decisions

If the context is not relevant to the item being created, ignore it.`.trim();

/**
 * Validates a merged RagContextConfig against the allowed value constraints (RF-05).
 * Invalid fields are replaced with the corresponding default value and a warning is logged.
 *
 * @param config - The merged configuration to validate and sanitize
 * @param logPrefix - Log prefix for structured logging
 * @returns A sanitized RagContextConfig with all values within allowed ranges
 */
function validateAndSanitize(config: RagContextConfig, logPrefix: string): RagContextConfig {
  const validated = { ...config };

  // similarity_threshold: must be between 0.0 and 1.0
  if (
    typeof validated.similarity_threshold !== 'number' ||
    validated.similarity_threshold < MIN_SIMILARITY_THRESHOLD ||
    validated.similarity_threshold > MAX_SIMILARITY_THRESHOLD
  ) {
    console.warn(
      `${logPrefix} [RAG config] Invalid similarity_threshold: ${validated.similarity_threshold}. Resetting to default.`
    );
    validated.similarity_threshold = RAG_CONTEXT_DEFAULTS.similarity_threshold;
  }

  // max_results: must be a positive integer between 1 and 50
  if (
    typeof validated.max_results !== 'number' ||
    !Number.isInteger(validated.max_results) ||
    validated.max_results < MIN_MAX_RESULTS ||
    validated.max_results > MAX_MAX_RESULTS
  ) {
    console.warn(
      `${logPrefix} [RAG config] Invalid max_results: ${validated.max_results}. Resetting to default.`
    );
    validated.max_results = RAG_CONTEXT_DEFAULTS.max_results;
  }

  // max_context_tokens: must be a positive integer between 100 and 16000
  if (
    typeof validated.max_context_tokens !== 'number' ||
    !Number.isInteger(validated.max_context_tokens) ||
    validated.max_context_tokens < MIN_MAX_CONTEXT_TOKENS ||
    validated.max_context_tokens > MAX_MAX_CONTEXT_TOKENS
  ) {
    console.warn(
      `${logPrefix} [RAG config] Invalid max_context_tokens: ${validated.max_context_tokens}. Resetting to default.`
    );
    validated.max_context_tokens = RAG_CONTEXT_DEFAULTS.max_context_tokens;
  }

  // Individual range check: each weight must be in [0.0, 1.0]
  if (
    typeof validated.semantic_weight !== 'number' ||
    validated.semantic_weight < MIN_WEIGHT ||
    validated.semantic_weight > MAX_WEIGHT ||
    typeof validated.keyword_weight !== 'number' ||
    validated.keyword_weight < MIN_WEIGHT ||
    validated.keyword_weight > MAX_WEIGHT
  ) {
    console.warn(
      `${logPrefix} [RAG config] Weight out of range [0.0, 1.0]: semantic_weight=${validated.semantic_weight}, keyword_weight=${validated.keyword_weight}. Resetting both to defaults.`
    );
    validated.semantic_weight = RAG_CONTEXT_DEFAULTS.semantic_weight;
    validated.keyword_weight = RAG_CONTEXT_DEFAULTS.keyword_weight;
  }

  // semantic_weight + keyword_weight must sum to 1.0 (tolerance: 0.001)
  const weightSum = (validated.semantic_weight ?? 0) + (validated.keyword_weight ?? 0);
  if (Math.abs(weightSum - WEIGHT_SUM_TARGET) > WEIGHT_SUM_TOLERANCE) {
    console.warn(
      `${logPrefix} [RAG config] semantic_weight (${validated.semantic_weight}) + keyword_weight (${validated.keyword_weight}) = ${weightSum} != 1.0. Resetting both to defaults.`
    );
    validated.semantic_weight = RAG_CONTEXT_DEFAULTS.semantic_weight;
    validated.keyword_weight = RAG_CONTEXT_DEFAULTS.keyword_weight;
  }

  // enabled: must be a boolean
  if (typeof validated.enabled !== 'boolean') {
    console.warn(
      `${logPrefix} [RAG config] Invalid enabled value: ${validated.enabled}. Resetting to default.`
    );
    validated.enabled = RAG_CONTEXT_DEFAULTS.enabled;
  }

  // scope: must be one of the allowed enum values
  const allowedScopes = ['project_only', 'project_and_company'] as const;
  if (!allowedScopes.includes(validated.scope as typeof allowedScopes[number])) {
    console.warn(
      `${logPrefix} [RAG config] Invalid scope: ${validated.scope}. Resetting to default.`
    );
    validated.scope = RAG_CONTEXT_DEFAULTS.scope;
  }

  // content_types_by_creation: must be an object with at least one valid CreationType key
  if (
    typeof validated.content_types_by_creation !== 'object' ||
    validated.content_types_by_creation === null ||
    !Object.values(validated.content_types_by_creation).every(Array.isArray)
  ) {
    console.warn(
      `${logPrefix} [RAG config] Invalid content_types_by_creation. Resetting to default.`
    );
    validated.content_types_by_creation = RAG_CONTEXT_DEFAULTS.content_types_by_creation;
  }

  return validated;
}

/**
 * Loads the RAG context configuration from platform_settings.
 *
 * Performs a direct query to the platform_settings table (avoiding circular
 * dependency with PlatformSettingsService). Merges the stored json_value with
 * RAG_CONTEXT_DEFAULTS (defaults first, stored values override), then validates
 * all fields against allowed constraints.
 *
 * Never throws — returns RAG_CONTEXT_DEFAULTS on any error for graceful degradation.
 *
 * @param supabase - Configured Supabase client
 * @param logPrefix - Log prefix for structured logging (e.g., '[CREATE-TASKS]')
 * @returns Validated RagContextConfig — either from the database or defaults
 *
 * @example
 * ```typescript
 * const ragConfig = await loadRagContextConfig(supabase, '[CREATE-TASKS]');
 * // ragConfig is always a valid RagContextConfig — never throws
 * ```
 */
export async function loadRagContextConfig(
  supabase: SupabaseClient,
  logPrefix: string
): Promise<RagContextConfig> {
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('json_value')
      .eq('section', PLATFORM_SETTINGS_RAG_SECTION)
      .eq('key', PLATFORM_SETTINGS_RAG_KEY)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      // PGRST116 = no rows found — expected when not configured yet
      if (error.code === 'PGRST116') {
        console.log(
          `${logPrefix} [RAG config] No configuration found in platform_settings, using defaults.`
        );
        return RAG_CONTEXT_DEFAULTS;
      }

      console.error(
        `${logPrefix} [RAG config] Database query error:`,
        { code: error.code, message: error.message }
      );
      return RAG_CONTEXT_DEFAULTS;
    }

    if (!data || !data.json_value) {
      console.log(
        `${logPrefix} [RAG config] Configuration row found but json_value is empty, using defaults.`
      );
      return RAG_CONTEXT_DEFAULTS;
    }

    // Merge: defaults first, stored values override
    const merged: RagContextConfig = {
      ...RAG_CONTEXT_DEFAULTS,
      ...(data.json_value as Partial<RagContextConfig>),
    };

    // Validate merged configuration and sanitize invalid values
    const validated = validateAndSanitize(merged, logPrefix);

    console.log(
      `${logPrefix} [RAG config] Configuration loaded and validated:`,
      {
        enabled: validated.enabled,
        max_results: validated.max_results,
        similarity_threshold: validated.similarity_threshold,
        max_context_tokens: validated.max_context_tokens,
        scope: validated.scope,
      }
    );

    return validated;

  } catch (error) {
    console.error(
      `${logPrefix} [RAG config] Unexpected error loading configuration, using defaults:`,
      error instanceof Error ? error.message : String(error)
    );
    return RAG_CONTEXT_DEFAULTS;
  }
}
