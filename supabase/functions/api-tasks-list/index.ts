import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { DatabaseService } from './database-service.ts';
import { GetTasksRequest, GetTasksResponse, CacheEntry } from './types.ts';
import {
  validateUUID,
  validatePagination,
  validateStatuses
} from './utils/validation.ts';
import {
  formatSuccessResponse,
  formatErrorResponse,
  generateCacheKey
} from './utils/response-formatter.ts';

const DEFAULT_STATUS = ['todo'];
const DEFAULT_INCLUDE_DESCRIPTION = false;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, CacheEntry>();
const dbService = new DatabaseService();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      const response = formatErrorResponse(
        'METHOD_NOT_ALLOWED',
        'Only POST method is supported',
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body: GetTasksRequest = await req.json();

    if (!body.projectId) {
      const response = formatErrorResponse(
        'INVALID_INPUT',
        'projectId is required',
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!validateUUID(body.projectId)) {
      const response = formatErrorResponse(
        'INVALID_INPUT',
        'projectId must be a valid UUID',
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const status = body.status || DEFAULT_STATUS;
    const includeDescription = body.includeDescription ?? DEFAULT_INCLUDE_DESCRIPTION;
    const page = body.page || DEFAULT_PAGE;
    const limit = body.limit || DEFAULT_LIMIT;

    const statusValidation = validateStatuses(status);
    if (!statusValidation.valid) {
      const response = formatErrorResponse(
        'INVALID_INPUT',
        statusValidation.error!,
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (body.assignedTo && !validateUUID(body.assignedTo)) {
      const response = formatErrorResponse(
        'INVALID_INPUT',
        'assignedTo must be a valid UUID',
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (body.assigneeEmail && body.assignedTo) {
      const response = formatErrorResponse(
        'INVALID_INPUT',
        'Cannot use both assignedTo and assigneeEmail. Use one or the other.',
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let resolvedAssignedTo = body.assignedTo;

    if (body.assigneeEmail) {
      const memberId = await dbService.resolveEmailToMemberId(body.assigneeEmail);
      if (!memberId) {
        const response: GetTasksResponse = {
          success: true,
          data: [],
          metadata: {
            totalCount: 0,
            currentPage: page,
            pageSize: limit,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
            appliedFilters: {
              status,
              assigneeEmail: body.assigneeEmail,
              includeDescription
            }
          }
        };
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
        });
      }
      resolvedAssignedTo = memberId;
    }

    const paginationValidation = validatePagination(page, limit);
    if (!paginationValidation.valid) {
      const response = formatErrorResponse(
        'INVALID_INPUT',
        paginationValidation.error!,
        requestId,
        false
      );
      return new Response(JSON.stringify(response), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Request validated:', {
      requestId,
      projectId: body.projectId,
      status,
      assignedTo: resolvedAssignedTo || 'all',
      assigneeEmail: body.assigneeEmail || undefined,
      includeDescription,
      page,
      limit
    });

    const cacheKey = generateCacheKey(
      body.projectId,
      status,
      resolvedAssignedTo,
      includeDescription,
      page,
      limit
    );

    const cachedEntry = cache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp) < CACHE_TTL_MS) {
      console.log('Cache hit:', cacheKey);
      const response: GetTasksResponse = {
        success: true,
        data: cachedEntry.data,
        metadata: cachedEntry.metadata
      };

      const processingTime = Date.now() - startTime;
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTime.toString(),
          'X-Cache': 'HIT'
        }
      });
    }

    console.log('Cache miss:', cacheKey);

    const result = await dbService.getTasksWithFilters({
      projectId: body.projectId,
      status,
      assignedTo: resolvedAssignedTo,
      includeDescription,
      page,
      limit
    });

    const { data, metadata } = formatSuccessResponse(
      result.tasks,
      result.totalCount,
      page,
      limit,
      {
        status,
        assignedTo: resolvedAssignedTo,
        assigneeEmail: body.assigneeEmail,
        includeDescription
      }
    );

    cache.set(cacheKey, {
      data,
      metadata,
      timestamp: now
    });

    cleanupCache();

    const response: GetTasksResponse = {
      success: true,
      data,
      metadata
    };

    const processingTime = Date.now() - startTime;
    console.log('Request completed:', {
      requestId,
      processingTime,
      tasksReturned: data.length,
      totalCount: result.totalCount
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Processing-Time-Ms': processingTime.toString(),
        'X-Cache': 'MISS'
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);

    const response = formatErrorResponse(
      'INTERNAL_ERROR',
      error instanceof Error ? error.message : 'An unexpected error occurred',
      requestId,
      true
    );

    const processingTime = Date.now() - startTime;
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Processing-Time-Ms': processingTime.toString()
      }
    });
  }
});

function cleanupCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));

  if (keysToDelete.length > 0) {
    console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}
