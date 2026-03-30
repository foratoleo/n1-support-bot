/**
 * JIRA Health Check Endpoint
 *
 * Provides comprehensive health checks for the JIRA synchronization system
 * including database connectivity, JIRA API connectivity, and system health.
 *
 * @endpoint GET /jira-health
 * @endpoint GET /jira-health/:projectId
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { JiraClient } from '../_shared/jira-client.ts';
import { JiraDbService } from '../_shared/jira-db-service.ts';

// Health status types
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface HealthCheckResult {
  status: HealthStatus;
  latency?: number;
  message?: string;
  details?: Record<string, any>;
}

interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  checks: {
    database: HealthCheckResult;
    jira_api?: HealthCheckResult;
    system: HealthCheckResult;
  };
  metrics?: {
    uptime_seconds: number;
    memory_usage_mb: number;
    recent_error_rate: number;
    recent_success_rate: number;
  };
  version: string;
}

const VERSION = '1.0.0';

// Database health check
async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Test simple query
    const { error: queryError } = await supabase
      .from('jira_sync_config')
      .select('count')
      .limit(1);

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    const latency = Date.now() - startTime;

    if (latency > 100) {
      return {
        status: 'degraded',
        latency,
        message: 'Database responding slowly',
      };
    }

    return {
      status: 'healthy',
      latency,
      message: 'Database connection healthy',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `Database health check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

// JIRA API health check
async function checkJiraApiHealth(projectId?: string): Promise<HealthCheckResult> {
  const startTime = Date.now();

  try {
    // Get JIRA config for the project
    const dbService = new JiraDbService();

    if (!projectId) {
      return {
        status: 'healthy',
        message: 'No project specified, skipping JIRA API check',
      };
    }

    const config = await dbService.getConfig(projectId);

    if (!config || !config.is_active) {
      return {
        status: 'healthy',
        message: 'No active JIRA configuration found',
      };
    }

    // Create JIRA client
    const jiraClient = new JiraClient({
      baseUrl: config.jira_url,
      apiToken: config.api_token_encrypted, // Note: In production, decrypt this
      email: config.jira_email,
      projectKey: config.jira_project_key,
    });

    // Test JIRA API with a simple search
    const searchResult = await jiraClient.searchIssues(
      `project = ${config.jira_project_key}`,
      0,
      1
    );

    const latency = Date.now() - startTime;

    // Check rate limiting
    const rateLimitUsage = 0; // Would parse from response headers in production

    if (latency > 1000) {
      return {
        status: 'degraded',
        latency,
        message: 'JIRA API responding slowly',
        details: {
          rate_limit_usage: rateLimitUsage,
        },
      };
    }

    if (rateLimitUsage > 80) {
      return {
        status: 'degraded',
        latency,
        message: 'JIRA API rate limit approaching',
        details: {
          rate_limit_usage: rateLimitUsage,
        },
      };
    }

    return {
      status: 'healthy',
      latency,
      message: 'JIRA API connection healthy',
      details: {
        rate_limit_usage: rateLimitUsage,
        issues_found: searchResult.total,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime,
      message: `JIRA API health check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

// System health check
async function checkSystemHealth(projectId?: string): Promise<HealthCheckResult> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get memory usage
    const memoryUsage = (Deno.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    // Get recent sync logs to calculate error rate
    const { data: recentLogs, error: logsError } = await supabase
      .from('jira_sync_log')
      .select('status')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .eq('project_id', projectId || '');

    if (logsError) {
      throw new Error(`Failed to fetch sync logs: ${logsError.message}`);
    }

    const totalSyncs = recentLogs?.length || 0;
    const errorSyncs = recentLogs?.filter(log => log.status === 'error').length || 0;
    const errorRate = totalSyncs > 0 ? errorSyncs / totalSyncs : 0;
    const successRate = totalSyncs > 0 ? 1 - errorRate : 1;

    // Determine health status
    let status: HealthStatus = 'healthy';
    let message = 'System operating normally';

    if (errorRate > 0.05) {
      status = 'degraded';
      message = 'Elevated error rate detected';
    }

    if (errorRate > 0.15) {
      status = 'unhealthy';
      message = 'High error rate detected';
    }

    return {
      status,
      message,
      details: {
        memory_usage_mb: parseFloat(memoryUsage),
        recent_syncs: totalSyncs,
        error_rate: errorRate,
        success_rate: successRate,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `System health check failed: ${error.message}`,
      details: {
        error: error.message,
      },
    };
  }
}

// Determine overall health status
function determineOverallStatus(checks: HealthCheckResponse['checks']): HealthStatus {
  const statuses = Object.values(checks)
    .filter(check => check !== undefined)
    .map(check => check.status);

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }

  if (statuses.includes('degraded')) {
    return 'degraded';
  }

  return 'healthy';
}

// Calculate uptime
const startTime = Date.now();
function getUptimeSeconds(): number {
  return Math.floor((Date.now() - startTime) / 1000);
}

// Main handler
serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Parse URL for project ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[1]; // /jira-health/:projectId

    // Run health checks in parallel
    const [databaseCheck, jiraApiCheck, systemCheck] = await Promise.all([
      checkDatabaseHealth(),
      checkJiraApiHealth(projectId),
      checkSystemHealth(projectId),
    ]);

    // Build response
    const checks: HealthCheckResponse['checks'] = {
      database: databaseCheck,
      system: systemCheck,
    };

    // Only include JIRA API check if project specified
    if (projectId) {
      checks.jira_api = jiraApiCheck;
    }

    const response: HealthCheckResponse = {
      status: determineOverallStatus(checks),
      timestamp: new Date().toISOString(),
      checks,
      metrics: {
        uptime_seconds: getUptimeSeconds(),
        memory_usage_mb: systemCheck.details?.memory_usage_mb || 0,
        recent_error_rate: systemCheck.details?.error_rate || 0,
        recent_success_rate: systemCheck.details?.success_rate || 1,
      },
      version: VERSION,
    };

    // Set HTTP status based on health
    const httpStatus = response.status === 'healthy' ? 200
      : response.status === 'degraded' ? 200
      : 503;

    return new Response(JSON.stringify(response, null, 2), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Health check error:', error);

    const errorResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: 'unhealthy',
          message: 'Health check failed',
        },
        system: {
          status: 'unhealthy',
          message: error.message,
        },
      },
      version: VERSION,
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
