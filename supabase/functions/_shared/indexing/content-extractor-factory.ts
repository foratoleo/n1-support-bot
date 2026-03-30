/**
 * Content extractor factory for normalized records
 *
 * Provides a generic factory function to create content extractors that call
 * Edge Functions to fetch rich Markdown content with full entity context.
 * Eliminates code duplication across task, backlog, and feature extractors.
 *
 * @module content-extractor-factory
 */

/**
 * UUID v4 validation regex pattern.
 * Matches standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID v4 format.
 *
 * @param id - The string to validate
 * @returns True if the string matches UUID v4 format
 */
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Configuration for a content extractor
 */
export interface ContentExtractorConfig {
  /** Name used in log messages (e.g., 'task', 'backlog', 'feature') */
  entityName: string;
  /** Edge Function endpoint name (e.g., 'get-task-normalized-record') */
  endpointName: string;
  /** Parameter name for the entity ID in the request body (e.g., 'taskId', 'backlogItemId') */
  entityIdParam: string;
}

/**
 * Options for content extraction with retry and timeout configuration
 */
export interface ContentExtractorOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

/**
 * Default options for content extraction
 */
const DEFAULT_OPTIONS: Required<ContentExtractorOptions> = {
  maxRetries: 3,
  timeout: 10000,
};

/**
 * Creates a content extractor function for a specific entity type.
 *
 * The returned function fetches normalized content via internal Edge Function call,
 * with retry logic and exponential backoff.
 *
 * @param config - Configuration for the extractor (entity name, endpoint, parameter name)
 * @returns An async function that fetches normalized content for the entity
 *
 * @example
 * ```typescript
 * const getTaskContent = createContentExtractor({
 *   entityName: 'task',
 *   endpointName: 'get-task-normalized-record',
 *   entityIdParam: 'taskId',
 * });
 *
 * const content = await getTaskContent(taskId, projectId);
 * ```
 */
export function createContentExtractor(
  config: ContentExtractorConfig
): (entityId: string, projectId: string, options?: ContentExtractorOptions) => Promise<string | null> {
  const logPrefix = `[${config.entityName}-content-extractor]`;

  return async function getNormalizedContent(
    entityId: string,
    projectId: string,
    options?: ContentExtractorOptions
  ): Promise<string | null> {
    // Validate UUID format before making API call
    if (!isValidUUID(entityId)) {
      console.warn(`${logPrefix} Invalid ${config.entityName} ID UUID format: ${entityId}`);
      return null;
    }
    if (!isValidUUID(projectId)) {
      console.warn(`${logPrefix} Invalid projectId UUID format: ${projectId}`);
      return null;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`${logPrefix} Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
      return null;
    }

    const { maxRetries, timeout } = { ...DEFAULT_OPTIONS, ...options };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${config.endpointName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            [config.entityIdParam]: entityId,
            projectId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            console.warn(`${logPrefix} ${capitalize(config.entityName)} ${entityId} not found`);
            return null;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Response is plain text Markdown
        const content = await response.text();
        return content || null;

      } catch (error) {
        clearTimeout(timeoutId);
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (error instanceof DOMException && error.name === 'AbortError') {
          console.warn(`${logPrefix} Attempt ${attempt}/${maxRetries} timed out for ${config.entityName} ${entityId}`);
        } else {
          console.error(`${logPrefix} Attempt ${attempt}/${maxRetries} failed for ${config.entityName} ${entityId}:`, errorMsg);
        }

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
        }
      }
    }

    console.error(`${logPrefix} All ${maxRetries} attempts failed for ${config.entityName} ${entityId}`);
    return null;
  };
}

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
