/**
 * Data Querier for planning-assistant
 *
 * Handles querying the main Supabase database for project data.
 * Supports features, tasks, sprints, backlog_items, team_members, and meetings.
 *
 * @module planning-assistant/data-querier
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import type {
  DataCategory,
  DataResult,
  DataQueryResult,
  ProjectDataItem,
} from './types.ts';

// Environment variable names for main Supabase connection
const MAIN_SUPABASE_URL = 'SUPABASE_URL';
const MAIN_SUPABASE_SERVICE_ROLE = 'SUPABASE_SERVICE_ROLE';

/**
 * Singleton client for main Supabase
 */
let mainSupabaseClient: SupabaseClient | null = null;

/**
 * Create or get the main Supabase client
 */
function getMainSupabaseClient(): SupabaseClient {
  if (mainSupabaseClient) {
    return mainSupabaseClient;
  }

  const supabaseUrl = Deno.env.get(MAIN_SUPABASE_URL);
  const serviceRoleKey = Deno.env.get(MAIN_SUPABASE_SERVICE_ROLE);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `Missing required environment variables: ${MAIN_SUPABASE_URL} or ${MAIN_SUPABASE_SERVICE_ROLE}`
    );
  }

  mainSupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return mainSupabaseClient;
}

/**
 * Reset the client (for testing)
 */
export function resetMainSupabaseClient(): void {
  mainSupabaseClient = null;
}

/**
 * Query features for a project
 */
async function queryFeatures(
  client: SupabaseClient,
  projectId: string,
  limit: number
): Promise<ProjectDataItem[]> {
  const { data, error } = await client
    .from('features')
    .select('id, title, description, status, priority')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[data-querier] Error querying features:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status || undefined,
    priority: row.priority || undefined,
    metadata: {
      source: 'features',
    },
  }));
}

/**
 * Query tasks for a project
 */
async function queryTasks(
  client: SupabaseClient,
  projectId: string,
  limit: number
): Promise<ProjectDataItem[]> {
  const { data, error } = await client
    .from('dev_tasks')
    .select('id, title, description, status, priority')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[data-querier] Error querying tasks:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status || undefined,
    priority: row.priority || undefined,
    metadata: {
      source: 'dev_tasks',
    },
  }));
}

/**
 * Query sprints for a project
 */
async function querySprints(
  client: SupabaseClient,
  projectId: string,
  limit: number
): Promise<ProjectDataItem[]> {
  const { data, error } = await client
    .from('sprints')
    .select('id, name, description, status')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[data-querier] Error querying sprints:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.name,
    description: row.description || undefined,
    status: row.status || undefined,
    metadata: {
      source: 'sprints',
    },
  }));
}

/**
 * Query backlog items for a project
 */
async function queryBacklogItems(
  client: SupabaseClient,
  projectId: string,
  limit: number
): Promise<ProjectDataItem[]> {
  const { data, error } = await client
    .from('backlog_items')
    .select('id, title, description, status, priority')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[data-querier] Error querying backlog_items:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status || undefined,
    priority: row.priority || undefined,
    metadata: {
      source: 'backlog_items',
    },
  }));
}

/**
 * Query team members for a project
 */
async function queryTeamMembers(
  client: SupabaseClient,
  projectId: string,
  limit: number
): Promise<ProjectDataItem[]> {
  const { data, error } = await client
    .from('team_members')
    .select('id, name, email, role')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[data-querier] Error querying team_members:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.name,
    description: row.email || undefined,
    status: row.role || undefined,
    metadata: {
      source: 'team_members',
    },
  }));
}

/**
 * Query meetings/transcripts for a project
 */
async function queryMeetings(
  client: SupabaseClient,
  projectId: string,
  limit: number
): Promise<ProjectDataItem[]> {
  const { data, error } = await client
    .from('meeting_transcripts')
    .select('id, title, status')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[data-querier] Error querying meeting_transcripts:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status || undefined,
    metadata: {
      source: 'meeting_transcripts',
    },
  }));
}

/**
 * Query a single category of data
 */
async function queryCategory(
  client: SupabaseClient,
  category: DataCategory,
  projectId: string,
  limit: number
): Promise<DataQueryResult> {
  let items: ProjectDataItem[] = [];

  switch (category) {
    case 'features':
      items = await queryFeatures(client, projectId, limit);
      break;
    case 'tasks':
      items = await queryTasks(client, projectId, limit);
      break;
    case 'sprints':
      items = await querySprints(client, projectId, limit);
      break;
    case 'backlog_items':
      items = await queryBacklogItems(client, projectId, limit);
      break;
    case 'team_members':
      items = await queryTeamMembers(client, projectId, limit);
      break;
    case 'meetings':
      items = await queryMeetings(client, projectId, limit);
      break;
    default:
      console.warn(`[data-querier] Unknown category: ${category}`);
  }

  return {
    category,
    items,
    count: items.length,
  };
}

/**
 * Query project data across multiple categories
 *
 * @param projectId - Project ID to query
 * @param categories - Categories to query (defaults to all)
 * @param limit - Maximum results per category
 * @returns Combined data query results
 */
export async function queryProjectData(
  projectId: string,
  categories?: DataCategory[],
  limit: number = 5
): Promise<DataResult> {
  const startTime = Date.now();
  const defaultCategories: DataCategory[] = [
    'features',
    'tasks',
    'sprints',
    'backlog_items',
  ];

  const categoriesToQuery = categories && categories.length > 0 ? categories : defaultCategories;

  try {
    const client = getMainSupabaseClient();

    const results: DataQueryResult[] = [];
    let totalResults = 0;

    for (const category of categoriesToQuery) {
      try {
        const result = await queryCategory(client, category, projectId, limit);
        results.push(result);
        totalResults += result.count;
      } catch (error) {
        console.error(`[data-querier] Error querying category ${category}:`, error);
        // Continue with other categories even if one fails
      }
    }

    return {
      used: true,
      categories: results,
      total_results: totalResults,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[data-querier] Fatal error:', errorMessage);

    return {
      used: false,
      categories: [],
      total_results: 0,
      processing_time_ms: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Search project data by text query
 *
 * @param projectId - Project ID to query
 * @param searchQuery - Text to search for
 * @param categories - Categories to search (defaults to all)
 * @param limit - Maximum results per category
 * @returns Combined data query results
 */
export async function searchProjectData(
  projectId: string,
  searchQuery: string,
  categories?: DataCategory[],
  limit: number = 5
): Promise<DataResult> {
  const startTime = Date.now();
  const defaultCategories: DataCategory[] = [
    'features',
    'tasks',
    'sprints',
    'backlog_items',
  ];

  const categoriesToQuery = categories && categories.length > 0 ? categories : defaultCategories;

  try {
    const client = getMainSupabaseClient();

    const results: DataQueryResult[] = [];
    let totalResults = 0;

    // Build search query for Supabase text search
    const searchPattern = `%${searchQuery}%`;

    for (const category of categoriesToQuery) {
      try {
        let queryResult: DataQueryResult;

        switch (category) {
          case 'features': {
            const { data, error } = await client
              .from('features')
              .select('id, title, description, status, priority')
              .eq('project_id', projectId)
              .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
              .limit(limit);

            if (error) throw error;

            queryResult = {
              category,
              items: (data || []).map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description || undefined,
                status: row.status || undefined,
                priority: row.priority || undefined,
                metadata: { source: 'features' },
              })),
              count: (data || []).length,
            };
            break;
          }

          case 'tasks': {
            const { data, error } = await client
              .from('dev_tasks')
              .select('id, title, description, status, priority')
              .eq('project_id', projectId)
              .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
              .limit(limit);

            if (error) throw error;

            queryResult = {
              category,
              items: (data || []).map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description || undefined,
                status: row.status || undefined,
                priority: row.priority || undefined,
                metadata: { source: 'dev_tasks' },
              })),
              count: (data || []).length,
            };
            break;
          }

          case 'sprints': {
            const { data, error } = await client
              .from('sprints')
              .select('id, name, description, status')
              .eq('project_id', projectId)
              .or(`name.ilike.${searchPattern},description.ilike.${searchPattern}`)
              .limit(limit);

            if (error) throw error;

            queryResult = {
              category,
              items: (data || []).map((row) => ({
                id: row.id,
                title: row.name,
                description: row.description || undefined,
                status: row.status || undefined,
                metadata: { source: 'sprints' },
              })),
              count: (data || []).length,
            };
            break;
          }

          case 'backlog_items': {
            const { data, error } = await client
              .from('backlog_items')
              .select('id, title, description, status, priority')
              .eq('project_id', projectId)
              .or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`)
              .limit(limit);

            if (error) throw error;

            queryResult = {
              category,
              items: (data || []).map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description || undefined,
                status: row.status || undefined,
                priority: row.priority || undefined,
                metadata: { source: 'backlog_items' },
              })),
              count: (data || []).length,
            };
            break;
          }

          default:
            queryResult = { category, items: [], count: 0 };
        }

        results.push(queryResult);
        totalResults += queryResult.count;
      } catch (error) {
        console.error(`[data-querier] Error searching category ${category}:`, error);
      }
    }

    return {
      used: true,
      categories: results,
      total_results: totalResults,
      processing_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[data-querier] Fatal search error:', errorMessage);

    return {
      used: false,
      categories: [],
      total_results: 0,
      processing_time_ms: Date.now() - startTime,
      error: errorMessage,
    };
  }
}
