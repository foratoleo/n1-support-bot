/**
 * Type definitions for the planning-assistant Edge Function
 *
 * Unified API that combines RAG documentation queries with project data queries.
 * Routes queries to appropriate backends and combines results.
 *
 * @module planning-assistant/types
 */

/**
 * Query intent classification
 */
export type QueryIntent = 'documentation' | 'data' | 'combined' | 'unknown';

/**
 * Target data categories for queries
 */
export type DataCategory = 'features' | 'tasks' | 'sprints' | 'backlog_items' | 'team_members' | 'meetings';

/**
 * Documentation categories from RAG system
 */
export type DocCategory = 'route' | 'component' | 'hook' | 'api' | 'data-model';

/**
 * Request payload for the planning-assistant Edge Function.
 */
export interface PlanningAssistantRequest {
  /** Natural language query from the user */
  query: string;
  /** Project ID for filtering data queries */
  project_id: string;
  /** Optional user ID for tracking */
  user_id?: string;
  /** Specific data categories to query (defaults to all) */
  data_categories?: DataCategory[];
  /** Specific doc categories to query (defaults to all) */
  doc_categories?: DocCategory[];
  /** Maximum number of results per category */
  limit?: number;
  /** Minimum similarity threshold for RAG results */
  similarity_threshold?: number;
  /** Whether to include raw data in response */
  include_raw_data?: boolean;
}

/**
 * Response from RAG documentation query
 */
export interface RagResult {
  used: boolean;
  results: RagChunk[];
  total_results: number;
  processing_time_ms: number;
  error?: string;
}

/**
 * Individual RAG search result chunk
 */
export interface RagChunk {
  id: string;
  doc_id: string;
  chunk_index: number;
  similarity: number;
  chunk_text?: string;
  source: ChunkSource;
}

/**
 * Source metadata for a RAG chunk
 */
export interface ChunkSource {
  title: string;
  category: DocCategory;
  file_path: string;
  section?: string;
}

/**
 * Response from project data query
 */
export interface DataResult {
  used: boolean;
  categories: DataQueryResult[];
  total_results: number;
  processing_time_ms: number;
  error?: string;
}

/**
 * Query result for a single data category
 */
export interface DataQueryResult {
  category: DataCategory;
  items: ProjectDataItem[];
  count: number;
}

/**
 * Generic project data item
 */
export interface ProjectDataItem {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Combined response from the planning-assistant
 */
export interface PlanningAssistantResponse {
  success: boolean;
  /** Unique request identifier */
  request_id: string;
  /** The original query */
  query: string;
  /** Classified intent of the query */
  intent: QueryIntent;
  /** Whether documentation was consulted */
  documentation_used: boolean;
  /** Whether project data was consulted */
  data_used: boolean;
  /** Combined confidence score (0-1) */
  confidence: number;
  /** Formatted natural language response */
  response: string;
  /** Documentation chunks if available */
  documentation?: RagChunk[];
  /** Project data items if available */
  data?: DataQueryResult[];
  /** Processing time in milliseconds */
  processing_time_ms: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Intent analysis result
 */
export interface IntentAnalysis {
  intent: QueryIntent;
  target_data_categories: DataCategory[];
  target_doc_categories: DocCategory[];
  confidence: number;
  reasoning: string;
}

/**
 * Keywords that indicate documentation-focused queries
 */
const DOCUMENTATION_KEYWORDS = [
  'como', 'como fazer', 'como criar', 'como implementar',
  'documentação', 'docs', 'document', 'explicar', 'explanation',
  'o que é', 'what is', 'what are', 'entenda', 'learn',
  'arquitetura', 'architecture', 'padrão', 'pattern',
  'roteiro', 'route', 'componente', 'component', 'hook',
  'api', 'endpoint', 'função', 'function',
  'modelo', 'model', 'schema', 'banco', 'database',
];

/**
 * Keywords that indicate data-focused queries
 */
const DATA_KEYWORDS = [
  'status', 'estado', 'andamento', 'progresso',
  'tarefas', 'tasks', 'features', 'sprints',
  'backlog', 'épico', 'equipe', 'team',
  'criar', 'create', 'listar', 'list',
  'buscar', 'search', 'encontrar', 'find',
  'quantos', 'how many', 'total', 'count',
  'andamento', '进度', 'estado atual',
];

/**
 * Keywords that indicate combined queries
 */
const COMBINED_KEYWORDS = [
  'explique', 'explain', 'descreva', 'describe',
  'mostre', 'show', 'detalhes', 'details',
  'resumo', 'summary', 'visão', 'overview',
  'análise', 'analysis', 'relatório', 'report',
];

/**
 * Category mapping from query keywords
 */
const KEYWORD_TO_CATEGORY: Record<string, DataCategory[]> = {
  'feature': ['features'],
  'features': ['features'],
  'tarefa': ['tasks'],
  'tarefas': ['tasks'],
  'task': ['tasks'],
  'tasks': ['tasks'],
  'sprint': ['sprints'],
  'sprints': ['sprints'],
  'backlog': ['backlog_items'],
  'épico': ['backlog_items'],
  'epico': ['backlog_items'],
  'equipe': ['team_members'],
  'team': ['team_members'],
  'membro': ['team_members'],
  'reunião': ['meetings'],
  'meeting': ['meetings'],
  'transcrição': ['meetings'],
};

export { DOCUMENTATION_KEYWORDS, DATA_KEYWORDS, COMBINED_KEYWORDS, KEYWORD_TO_CATEGORY };
