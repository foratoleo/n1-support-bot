/**
 * Knowledge base content extractor for company_knowledge_base articles
 *
 * Queries the company_knowledge_base table directly using the Supabase service
 * role key. Unlike other extractors, this does NOT use createContentExtractor
 * because knowledge base articles are company-wide (no project_id scope) and
 * do not require a normalized-record Edge Function intermediary — the content
 * is already structured in the table itself.
 *
 * Generated Markdown format:
 * ```
 * # {title}
 *
 * **Category**: {category}
 * **Tags**: {tag1}, {tag2}
 *
 * {content}
 * ```
 *
 * @module knowledge-base-content-extractor
 */

const LOG_PREFIX = '[knowledge-base-content-extractor]';

/**
 * UUID v4 validation regex pattern.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Row shape returned from company_knowledge_base table query.
 */
interface KnowledgeBaseRow {
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
}

/**
 * Get knowledge base article content formatted as structured Markdown.
 *
 * Queries the company_knowledge_base table directly using the Supabase REST API
 * with the service role key. Returns null if the article is not found, the
 * environment is misconfigured, or any network/query error occurs.
 *
 * @param articleId - The UUID of the knowledge base article to fetch
 * @returns Structured Markdown content or null if unavailable
 *
 * @example
 * ```typescript
 * const content = await getKnowledgeBaseContent(articleId);
 * if (content) {
 *   console.log('Article content length:', content.length);
 * }
 * ```
 */
export async function getKnowledgeBaseContent(articleId: string): Promise<string | null> {
  if (!UUID_REGEX.test(articleId)) {
    console.warn(`${LOG_PREFIX} Invalid article ID UUID format: ${articleId}`);
    return null;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${LOG_PREFIX} Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
    return null;
  }

  const endpoint =
    `${supabaseUrl}/rest/v1/company_knowledge_base` +
    `?id=eq.${encodeURIComponent(articleId)}` +
    `&select=title,content,category,tags` +
    `&limit=1`;

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `${LOG_PREFIX} HTTP ${response.status} fetching article ${articleId}: ${response.statusText}`
      );
      return null;
    }

    const rows: KnowledgeBaseRow[] = await response.json();

    if (!rows || rows.length === 0) {
      console.warn(`${LOG_PREFIX} Article ${articleId} not found`);
      return null;
    }

    const article = rows[0];

    if (!article.title || !article.content) {
      console.warn(`${LOG_PREFIX} Article ${articleId} has empty title or content`);
      return null;
    }

    return formatArticleAsMarkdown(article);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${LOG_PREFIX} Failed to fetch article ${articleId}:`, errorMsg);
    return null;
  }
}

/**
 * Formats a knowledge base article as structured Markdown.
 *
 * @param article - The raw row from company_knowledge_base
 * @returns Structured Markdown string
 */
function formatArticleAsMarkdown(article: KnowledgeBaseRow): string {
  const lines: string[] = [];

  lines.push(`# ${article.title}`);
  lines.push('');

  if (article.category) {
    lines.push(`**Category**: ${article.category}`);
  }

  if (article.tags && article.tags.length > 0) {
    lines.push(`**Tags**: ${article.tags.join(', ')}`);
  }

  if (article.category || (article.tags && article.tags.length > 0)) {
    lines.push('');
  }

  lines.push(article.content);

  return lines.join('\n');
}
