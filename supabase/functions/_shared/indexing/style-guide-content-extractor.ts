/**
 * Style guide content extractor for style_guides table records
 *
 * Queries the style_guides table directly using an injected Supabase client.
 * Unlike project-scoped extractors, style guides are company-wide (no project_id)
 * and do not require a normalized-record Edge Function intermediary — the content
 * is already structured in the table itself.
 *
 * Generated Markdown format:
 * ```
 * # Style Guide: {name}
 *
 * **Categoria:** {category}
 * **Tags:** {tag1}, {tag2}
 *
 * {description}
 *
 * ---
 *
 * {content}
 * ```
 *
 * @module style-guide-content-extractor
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const LOG_PREFIX = '[style-guide-content-extractor]';

/**
 * UUID v4 validation regex pattern.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Row shape returned from style_guides table query.
 */
interface StyleGuideRow {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  content: string;
  tags: string[] | null;
  deleted_at: string | null;
  is_active: boolean;
}

/**
 * Get style guide content formatted as structured Markdown.
 *
 * Queries the style_guides table using the provided Supabase client.
 * Returns null if the guide is not found, is inactive, has been soft-deleted,
 * or if any query error occurs.
 *
 * Style guides are company-wide and do not have a project_id. When indexed,
 * they use the sentinel UUID `00000000-0000-0000-0000-000000000000` as project_id.
 *
 * @param supabase - The Supabase client instance (service role)
 * @param guideId - The UUID of the style guide to fetch
 * @returns Structured Markdown content or null if unavailable
 *
 * @example
 * ```typescript
 * const content = await getStyleGuideContent(supabase, guideId);
 * if (content) {
 *   console.log('Style guide content length:', content.length);
 * }
 * ```
 */
export async function getStyleGuideContent(
  supabase: SupabaseClient,
  guideId: string
): Promise<string | null> {
  if (!UUID_REGEX.test(guideId)) {
    console.warn(`${LOG_PREFIX} Invalid style guide ID UUID format: ${guideId}`);
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('style_guides')
      .select('id, name, description, category, content, tags, deleted_at, is_active')
      .eq('id', guideId)
      .single();

    if (error) {
      console.error(`${LOG_PREFIX} Query error fetching style guide ${guideId}:`, error.message);
      return null;
    }

    if (!data) {
      console.warn(`${LOG_PREFIX} Style guide ${guideId} not found`);
      return null;
    }

    if (typeof data.name !== 'string') {
      console.warn(`${LOG_PREFIX} Unexpected row shape for style guide ${guideId}`);
      return null;
    }

    const guide = data as StyleGuideRow;

    if (guide.deleted_at !== null) {
      console.warn(`${LOG_PREFIX} Style guide ${guideId} has been soft-deleted`);
      return null;
    }

    if (!guide.is_active) {
      console.warn(`${LOG_PREFIX} Style guide ${guideId} is inactive`);
      return null;
    }

    if (!guide.name || !guide.content) {
      console.warn(`${LOG_PREFIX} Style guide ${guideId} has empty name or content`);
      return null;
    }

    return formatStyleGuideAsMarkdown(guide);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} Failed to fetch style guide ${guideId}:`, errorMsg);
    return null;
  }
}

/**
 * Formats a style guide record as structured Markdown.
 *
 * @param guide - The raw row from style_guides table
 * @returns Structured Markdown string
 */
function formatStyleGuideAsMarkdown(guide: StyleGuideRow): string {
  const lines: string[] = [];

  lines.push(`# Style Guide: ${guide.name}`);
  lines.push('');

  if (guide.category) {
    lines.push(`**Categoria:** ${guide.category}`);
  }

  if (guide.tags && guide.tags.length > 0) {
    lines.push(`**Tags:** ${guide.tags.join(', ')}`);
  }

  if (guide.category || (guide.tags && guide.tags.length > 0)) {
    lines.push('');
  }

  if (guide.description) {
    lines.push(guide.description);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push(guide.content);

  return lines.join('\n');
}
