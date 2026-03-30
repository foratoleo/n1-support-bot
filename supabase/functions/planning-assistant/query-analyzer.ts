/**
 * Query Analyzer for planning-assistant
 *
 * Analyzes natural language queries to determine:
 * 1. Query intent (documentation, data, or combined)
 * 2. Target categories to search
 * 3. Confidence score
 *
 * @module planning-assistant/query-analyzer
 */

import type {
  QueryIntent,
  DataCategory,
  DocCategory,
  IntentAnalysis,
  PlanningAssistantRequest,
} from './types.ts';
import {
  DOCUMENTATION_KEYWORDS,
  DATA_KEYWORDS,
  COMBINED_KEYWORDS,
  KEYWORD_TO_CATEGORY,
} from './types.ts';

/**
 * Normalize text for analysis (lowercase, remove accents)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Count keyword matches in text
 */
function countMatches(text: string, keywords: string[]): number {
  const normalizedText = normalizeText(text);
  let count = 0;
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (normalizedText.includes(normalizedKeyword)) {
      count++;
    }
  }
  return count;
}

/**
 * Extract data category targets from query
 */
function extractDataCategories(query: string): DataCategory[] {
  const normalizedQuery = normalizeText(query);
  const categories: Set<DataCategory> = new Set();

  for (const [keyword, categoryList] of Object.entries(KEYWORD_TO_CATEGORY)) {
    if (normalizedQuery.includes(keyword)) {
      for (const category of categoryList) {
        categories.add(category as DataCategory);
      }
    }
  }

  // If no specific categories found, default to all
  if (categories.size === 0) {
    return ['features', 'tasks', 'sprints', 'backlog_items'];
  }

  return Array.from(categories);
}

/**
 * Extract documentation category targets from query
 */
function extractDocCategories(query: string): DocCategory[] {
  const normalizedQuery = normalizeText(query);
  const categories: Set<DocCategory> = new Set();

  const docCategoryKeywords: Record<DocCategory, string[]> = {
    route: ['rota', 'route', 'página', 'page'],
    component: ['componente', 'component', 'ui', 'interface'],
    hook: ['hook', 'use', 'hooks'],
    api: ['api', 'endpoint', 'função', 'function', 'edge'],
    'data-model': ['modelo', 'model', 'schema', 'tabela', 'banco'],
  };

  for (const [category, keywords] of Object.entries(docCategoryKeywords)) {
    for (const keyword of keywords) {
      if (normalizedQuery.includes(keyword)) {
        categories.add(category as DocCategory);
        break;
      }
    }
  }

  // If no specific categories found, default to all
  if (categories.size === 0) {
    return ['route', 'component', 'hook', 'api', 'data-model'];
  }

  return Array.from(categories);
}

/**
 * Analyze query intent based on keyword matching
 */
function analyzeKeywordIntent(query: string): { docScore: number; dataScore: number; combinedScore: number } {
  const docScore = countMatches(query, DOCUMENTATION_KEYWORDS);
  const dataScore = countMatches(query, DATA_KEYWORDS);
  const combinedScore = countMatches(query, COMBINED_KEYWORDS);

  return { docScore, dataScore, combinedScore };
}

/**
 * Determine query intent from scores
 */
function determineIntent(
  docScore: number,
  dataScore: number,
  combinedScore: number
): { intent: QueryIntent; confidence: number } {
  // Combined intent triggers
  if (combinedScore >= 1) {
    if (docScore >= 1 && dataScore >= 1) {
      return { intent: 'combined', confidence: 0.9 };
    }
    if (docScore >= 1) {
      return { intent: 'documentation', confidence: 0.7 + combinedScore * 0.1 };
    }
    if (dataScore >= 1) {
      return { intent: 'data', confidence: 0.7 + combinedScore * 0.1 };
    }
  }

  // Documentation-focused
  if (docScore > dataScore && docScore > 0) {
    return { intent: 'documentation', confidence: Math.min(0.5 + docScore * 0.15, 0.95) };
  }

  // Data-focused
  if (dataScore > docScore && dataScore > 0) {
    return { intent: 'data', confidence: Math.min(0.5 + dataScore * 0.15, 0.95) };
  }

  // Equal scores or no matches - default to combined
  if (docScore === dataScore && docScore > 0) {
    return { intent: 'combined', confidence: 0.6 };
  }

  // No clear intent
  return { intent: 'unknown', confidence: 0.3 };
}

/**
 * Build reasoning string for the analysis
 */
function buildReasoning(
  intent: QueryIntent,
  docScore: number,
  dataScore: number,
  combinedScore: number,
  targetDocCategories: DocCategory[],
  targetDataCategories: DataCategory[]
): string {
  const parts: string[] = [];

  switch (intent) {
    case 'documentation':
      parts.push(`Documentation-focused query (doc_score=${docScore})`);
      break;
    case 'data':
      parts.push(`Data-focused query (data_score=${dataScore})`);
      break;
    case 'combined':
      parts.push(`Combined query (doc_score=${docScore}, data_score=${dataScore})`);
      break;
    default:
      parts.push(`Unclear intent - defaulting to combined approach`);
  }

  if (targetDocCategories.length > 0) {
    parts.push(`Doc categories: ${targetDocCategories.join(', ')}`);
  }

  if (targetDataCategories.length > 0) {
    parts.push(`Data categories: ${targetDataCategories.join(', ')}`);
  }

  return parts.join(' | ');
}

/**
 * Main query analysis function
 *
 * Analyzes a natural language query to determine:
 * - Query intent (documentation, data, combined, unknown)
 * - Target categories for documentation search
 * - Target categories for data search
 * - Confidence score
 *
 * @param query - The natural language query to analyze
 * @param request - Optional request with category preferences
 * @returns IntentAnalysis with detailed breakdown
 */
export function analyzeQuery(
  query: string,
  request?: Pick<PlanningAssistantRequest, 'data_categories' | 'doc_categories'>
): IntentAnalysis {
  // Get keyword-based scores
  const { docScore, dataScore, combinedScore } = analyzeKeywordIntent(query);

  // Determine intent and confidence
  const { intent, confidence } = determineIntent(docScore, dataScore, combinedScore);

  // Extract target categories
  let targetDocCategories = extractDocCategories(query);
  let targetDataCategories = extractDataCategories(query);

  // Override with request preferences if provided
  if (request?.doc_categories && request.doc_categories.length > 0) {
    targetDocCategories = request.doc_categories;
  }

  if (request?.data_categories && request.data_categories.length > 0) {
    targetDataCategories = request.data_categories;
  }

  const reasoning = buildReasoning(
    intent,
    docScore,
    dataScore,
    combinedScore,
    targetDocCategories,
    targetDataCategories
  );

  return {
    intent,
    target_data_categories: targetDataCategories,
    target_doc_categories: targetDocCategories,
    confidence,
    reasoning,
  };
}

/**
 * Quick check if query is likely documentation-focused
 */
export function isDocumentationQuery(query: string): boolean {
  const { intent } = analyzeQuery(query);
  return intent === 'documentation';
}

/**
 * Quick check if query is likely data-focused
 */
export function isDataQuery(query: string): boolean {
  const { intent } = analyzeQuery(query);
  return intent === 'data';
}

/**
 * Quick check if query needs combined results
 */
export function isCombinedQuery(query: string): boolean {
  const { intent } = analyzeQuery(query);
  return intent === 'combined' || intent === 'unknown';
}
