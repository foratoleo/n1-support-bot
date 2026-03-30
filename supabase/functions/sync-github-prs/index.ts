/**
 * GitHub PR Synchronization Edge Function
 *
 * Supabase Edge Function for synchronizing GitHub Pull Requests, Reviews,
 * Comments, and Commits with the local database.
 *
 * Supports both single repository sync and batch sync of all due repositories.
 * Implements incremental sync using timestamps and cursors for efficiency.
 *
 * @module sync-github-prs
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase/client.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { SyncOrchestrator } from './sync-orchestrator.ts';
import {
  OPERATION,
  SyncRequest,
  SyncResponse,
  SyncSummary,
  SyncError,
} from './config.ts';
import {
  validateUUID,
  type MultiValidationResult,
} from '../_shared/github/validation.ts';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create CORS preflight response
 */
function createCorsResponse(): Response {
  return new Response('ok', {
    headers: corsHeaders,
    status: 200,
  });
}

/**
 * Create JSON response with CORS headers
 */
function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  });
}

/**
 * Create error response
 */
function createErrorResponse(
  message: string,
  status = 400,
  type: SyncError['type'] = 'unknown'
): Response {
  const error: SyncError = {
    message,
    type,
    timestamp: new Date().toISOString(),
  };

  const response: SyncResponse = {
    success: false,
    summary: {
      repositories_synced: 0,
      pull_requests_synced: 0,
      reviews_synced: 0,
      comments_synced: 0,
      commits_synced: 0,
      errors: [error],
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
    },
    error: message,
  };

  return createJsonResponse(response, status);
}

/**
 * Validate request method
 */
function validateMethod(method: string): { valid: boolean; error?: string } {
  if (method !== 'POST') {
    return {
      valid: false,
      error: `Method ${method} not allowed. Use POST.`,
    };
  }
  return { valid: true };
}

/**
 * Parse and validate request body using validation utilities
 */
function parseRequestBody(body: unknown): {
  valid: boolean;
  data?: SyncRequest;
  errors?: Array<{ field: string; message: string }>;
} {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
    };
  }

  const request = body as SyncRequest;

  // Validate repository_id if provided (can be UUID or numeric string)
  if (request.repository_id !== undefined) {
    if (typeof request.repository_id !== 'string') {
      errors.push({ field: 'repository_id', message: 'repository_id must be a string' });
    } else if (!request.repository_id.trim()) {
      errors.push({ field: 'repository_id', message: 'repository_id cannot be empty' });
    } else {
      // Check if it's a valid UUID or numeric ID
      const uuidResult = validateUUID(request.repository_id, 'repository_id');
      const isNumericId = /^\d+$/.test(request.repository_id.trim());
      if (!uuidResult.valid && !isNumericId) {
        errors.push({ field: 'repository_id', message: 'repository_id must be a valid UUID or numeric ID' });
      }
    }
  }

  // Validate force_full_sync if provided
  if (
    request.force_full_sync !== undefined &&
    typeof request.force_full_sync !== 'boolean'
  ) {
    errors.push({ field: 'force_full_sync', message: 'force_full_sync must be a boolean' });
  }

  // Validate max_prs if provided
  if (request.max_prs !== undefined) {
    if (typeof request.max_prs !== 'number') {
      errors.push({ field: 'max_prs', message: 'max_prs must be a number' });
    } else if (!Number.isInteger(request.max_prs) || request.max_prs <= 0) {
      errors.push({ field: 'max_prs', message: 'max_prs must be a positive integer' });
    } else if (request.max_prs > 1000) {
      errors.push({ field: 'max_prs', message: 'max_prs cannot exceed 1000' });
    }
  }

  // Validate max_pages if provided
  if (request.max_pages !== undefined) {
    if (typeof request.max_pages !== 'number') {
      errors.push({ field: 'max_pages', message: 'max_pages must be a number' });
    } else if (!Number.isInteger(request.max_pages) || request.max_pages <= 0) {
      errors.push({ field: 'max_pages', message: 'max_pages must be a positive integer' });
    } else if (request.max_pages > 100) {
      errors.push({ field: 'max_pages', message: 'max_pages cannot exceed 100' });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: request };
}

/**
 * Create validation error response from multiple errors
 */
function createValidationErrorResponse(
  errors: Array<{ field: string; message: string }>
): Response {
  const errorMessages = errors.map((e) => `${e.field}: ${e.message}`).join('; ');
  return createErrorResponse(errorMessages, 400, 'validation');
}

/**
 * Get repositories due for sync, ordered by most outdated first
 * - NULL last_synced_at = never synced (highest priority)
 * - Oldest last_synced_at = most stale (next priority)
 */
async function getRepositoriesDueForSync(): Promise<string[]> {
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from('github_sync_config')
    .select(`
      repository_id,
      project_git_repositories!inner (
        id,
        deleted_at,
        project_knowledge_base!inner (
          id,
          deleted_at
        )
      )
    `)
    .eq('sync_enabled', true)
    .eq('is_active', true)
    .is('deleted_at', null)
    .is('project_git_repositories.deleted_at', null)
    .is('project_git_repositories.project_knowledge_base.deleted_at', null)
    .order('last_synced_at', { ascending: true, nullsFirst: true });

  if (error) {
    console.error(`[${OPERATION}] Failed to fetch repositories:`, error);
    throw new Error(`Failed to fetch repositories: ${error.message}`);
  }

  return data?.map((row) => String(row.repository_id)) || [];
}

/**
 * Merge multiple sync summaries
 */
function mergeSummaries(summaries: SyncSummary[]): SyncSummary {
  if (summaries.length === 0) {
    return {
      repositories_synced: 0,
      pull_requests_synced: 0,
      reviews_synced: 0,
      comments_synced: 0,
      commits_synced: 0,
      errors: [],
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: 0,
    };
  }

  const merged: SyncSummary = {
    repositories_synced: 0,
    pull_requests_synced: 0,
    reviews_synced: 0,
    comments_synced: 0,
    commits_synced: 0,
    errors: [],
    started_at: summaries[0].started_at,
    completed_at: summaries[summaries.length - 1].completed_at,
    duration_ms: 0,
  };

  for (const summary of summaries) {
    merged.repositories_synced += summary.repositories_synced;
    merged.pull_requests_synced += summary.pull_requests_synced;
    merged.reviews_synced += summary.reviews_synced;
    merged.comments_synced += summary.comments_synced;
    merged.commits_synced += summary.commits_synced;
    merged.errors.push(...summary.errors);
  }

  // Calculate total duration
  const startTime = new Date(merged.started_at).getTime();
  const endTime = new Date(merged.completed_at).getTime();
  merged.duration_ms = endTime - startTime;

  return merged;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    // Validate request method
    const methodValidation = validateMethod(req.method);
    if (!methodValidation.valid) {
      return createErrorResponse(
        methodValidation.error!,
        405,
        'validation'
      );
    }

    // Parse request body with comprehensive validation
    const body = await req.json();
    const bodyValidation = parseRequestBody(body);
    if (!bodyValidation.valid) {
      return createValidationErrorResponse(bodyValidation.errors!);
    }

    const request = bodyValidation.data!;

    console.log(`[${OPERATION}] Sync request received:`, {
      repository_id: request.repository_id || 'all',
      force_full_sync: request.force_full_sync || false,
    });

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Create sync orchestrator
    const orchestrator = new SyncOrchestrator(supabase, {
      maxPages: request.max_pages,
      maxPrs: request.max_prs,
    });

    let summary: SyncSummary;

    // Determine sync scope: single repository or batch
    if (request.repository_id) {
      // Single repository sync
      console.log(`[${OPERATION}] Syncing single repository: ${request.repository_id}`);
      summary = await orchestrator.syncRepository(
        request.repository_id,
        request.force_full_sync || false
      );
    } else {
      // Batch sync: get all repositories due for sync
      console.log(`[${OPERATION}] Syncing all due repositories`);
      const repositoryIds = await getRepositoriesDueForSync();

      if (repositoryIds.length === 0) {
        console.log(`[${OPERATION}] No repositories due for sync`);
        summary = {
          repositories_synced: 0,
          pull_requests_synced: 0,
          reviews_synced: 0,
          comments_synced: 0,
          commits_synced: 0,
          errors: [],
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: 0,
        };
      } else {
        console.log(`[${OPERATION}] Found ${repositoryIds.length} repositories to sync`);

        // Sync all repositories sequentially to avoid overwhelming API
        const summaries: SyncSummary[] = [];
        for (const repoId of repositoryIds) {
          const repoSummary = await orchestrator.syncRepository(
            repoId,
            request.force_full_sync || false
          );
          summaries.push(repoSummary);
        }

        // Merge all summaries
        summary = mergeSummaries(summaries);
      }
    }

    console.log(`[${OPERATION}] Sync completed:`, {
      repositories: summary.repositories_synced,
      prs: summary.pull_requests_synced,
      reviews: summary.reviews_synced,
      comments: summary.comments_synced,
      commits: summary.commits_synced,
      errors: summary.errors.length,
      duration_ms: summary.duration_ms,
    });

    // Return success response
    const response: SyncResponse = {
      success: summary.errors.length === 0,
      summary,
    };

    return createJsonResponse(response, 200);
  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    return createErrorResponse(errorMessage, 500, 'unknown');
  }
});
