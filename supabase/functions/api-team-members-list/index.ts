import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DatabaseService } from './database-service.ts';
import { GetTeamMembersRequest, AppliedFilters } from './types.ts';
import { validateUUID, validatePagination } from './utils/validation.ts';
import { formatSuccessResponse, formatErrorResponse, generateRequestId, generateCacheKey } from './utils/response-formatter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: any; timestamp: number }>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify(formatErrorResponse('METHOD_NOT_ALLOWED', 'Only POST method is supported', requestId, false)),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: GetTeamMembersRequest = await req.json();

    if (body.projectId && !validateUUID(body.projectId)) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', 'projectId must be a valid UUID', requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectId = body.projectId;
    const status = body.status || ['active'];
    const profile = body.profile || [];
    const includeStats = body.includeStats ?? false;
    const page = body.page ?? 1;
    const limit = body.limit ?? 50;

    const paginationValidation = validatePagination(page, limit);
    if (!paginationValidation.valid) {
      return new Response(
        JSON.stringify(formatErrorResponse('INVALID_INPUT', paginationValidation.error!, requestId, false)),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = generateCacheKey(projectId || 'all', status, profile, includeStats, page, limit);
    const cached = cache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      const processingTime = Date.now() - startTime;
      return new Response(
        JSON.stringify(cached.data),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Processing-Time-Ms': processingTime.toString(),
            'X-Cache': 'HIT'
          }
        }
      );
    }

    const dbService = new DatabaseService();
    const { members, totalCount } = await dbService.getTeamMembers({
      projectId,
      status,
      profile,
      includeStats,
      page,
      limit
    });

    const appliedFilters: AppliedFilters = {
      includeStats
    };

    if (projectId) {
      appliedFilters.projectId = projectId;
    }

    if (status.length > 0) {
      appliedFilters.status = status;
    }

    if (profile.length > 0) {
      appliedFilters.profile = profile;
    }

    const response = formatSuccessResponse(members, totalCount, page, limit, appliedFilters);

    cache.set(cacheKey, { data: response, timestamp: now });

    setTimeout(() => cache.delete(cacheKey), CACHE_TTL_MS);

    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTime.toString(),
          'X-Cache': 'MISS'
        }
      }
    );
  } catch (error) {
    console.error('Error in api-team-members-list:', error);
    const processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify(formatErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId, true)),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-Processing-Time-Ms': processingTime.toString(),
        }
      }
    );
  }
});
