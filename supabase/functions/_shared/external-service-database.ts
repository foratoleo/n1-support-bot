import { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  CreateServiceCallRequest,
  UpdateServiceCallResponse,
  ExternalServiceCall,
  ServiceCallFilters,
  ServiceCallMetrics,
  ServiceCallError,
  ServiceCallPerformance,
  ServiceCallCostAnalysis,
  ServiceHealthStatus,
  ExternalServiceCallRow,
  ServiceName,
  rowToServiceCall,
  requestToDbInsert,
  updateToDbUpdate,
} from './external-service-types.ts';

/**
 * Custom error class for database operations
 */
export class ExternalServiceDatabaseError extends Error {
  constructor(
    message: string,
    public operation: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ExternalServiceDatabaseError';
  }
}

/**
 * Service class for external service calls database operations
 *
 * This service provides a comprehensive API for tracking, querying,
 * and analyzing external service API calls.
 */
export class ExternalServiceCallService {
  constructor(private supabaseClient: SupabaseClient) {}

  /**
   * Creates a new service call record
   *
   * @param request - Service call request data
   * @returns Created service call ID
   * @throws ExternalServiceDatabaseError on database errors
   */
  async createServiceCall(request: CreateServiceCallRequest): Promise<string> {
    try {
      const insertData = requestToDbInsert(request);

      const { data, error } = await this.supabaseClient
        .from('external_service_calls')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error('Database error creating service call:', error);
        throw new ExternalServiceDatabaseError(
          `Failed to create service call: ${error.message}`,
          'createServiceCall',
          error.code
        );
      }

      if (!data || !data.id) {
        throw new ExternalServiceDatabaseError(
          'Service call created but no ID returned',
          'createServiceCall'
        );
      }

      console.log('Service call created:', {
        id: data.id,
        serviceName: request.serviceName,
        projectId: request.projectId,
      });

      return data.id;
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      // Handle foreign key constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; message: string };
        if (pgError.code === '23503') {
          throw new ExternalServiceDatabaseError(
            'Invalid project_id or ai_interaction_id: referenced record does not exist',
            'createServiceCall',
            'foreign_key_violation'
          );
        }
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error creating service call: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'createServiceCall'
      );
    }
  }

  /**
   * Updates a service call record with response data
   *
   * @param callId - Service call ID
   * @param update - Update data
   * @throws ExternalServiceDatabaseError on database errors
   */
  async updateServiceCall(
    callId: string,
    update: UpdateServiceCallResponse
  ): Promise<void> {
    try {
      const updateData = updateToDbUpdate(update);

      const { error } = await this.supabaseClient
        .from('external_service_calls')
        .update(updateData)
        .eq('id', callId);

      if (error) {
        console.error('Database error updating service call:', error);
        throw new ExternalServiceDatabaseError(
          `Failed to update service call: ${error.message}`,
          'updateServiceCall',
          error.code
        );
      }

      console.log('Service call updated:', {
        callId,
        status: update.status,
        durationMs: update.durationMs,
      });
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error updating service call: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'updateServiceCall'
      );
    }
  }

  /**
   * Retrieves a single service call by ID
   *
   * @param callId - Service call ID
   * @returns Service call record or null if not found
   */
  async getServiceCall(callId: string): Promise<ExternalServiceCall | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('external_service_calls')
        .select('*')
        .eq('id', callId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new ExternalServiceDatabaseError(
          `Failed to get service call: ${error.message}`,
          'getServiceCall',
          error.code
        );
      }

      return data ? rowToServiceCall(data as ExternalServiceCallRow) : null;
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error getting service call: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'getServiceCall'
      );
    }
  }

  /**
   * Queries service calls with filters
   *
   * @param filters - Query filters
   * @returns Array of service call records
   */
  async getServiceCalls(filters: ServiceCallFilters = {}): Promise<ExternalServiceCall[]> {
    try {
      let query = this.supabaseClient
        .from('external_service_calls')
        .select('*')
        .is('deleted_at', null);

      // Apply filters
      if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
      }

      if (filters.serviceName) {
        if (Array.isArray(filters.serviceName)) {
          query = query.in('service_name', filters.serviceName);
        } else {
          query = query.eq('service_name', filters.serviceName);
        }
      }

      if (filters.serviceCategory) {
        if (Array.isArray(filters.serviceCategory)) {
          query = query.in('service_category', filters.serviceCategory);
        } else {
          query = query.eq('service_category', filters.serviceCategory);
        }
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.operationType) {
        query = query.eq('operation_type', filters.operationType);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters.aiInteractionId) {
        query = query.eq('ai_interaction_id', filters.aiInteractionId);
      }

      // Order by created_at descending
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new ExternalServiceDatabaseError(
          `Failed to query service calls: ${error.message}`,
          'getServiceCalls',
          error.code
        );
      }

      return (data || []).map(row => rowToServiceCall(row as ExternalServiceCallRow));
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error querying service calls: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'getServiceCalls'
      );
    }
  }

  /**
   * Gets aggregated metrics for service calls
   *
   * @param projectId - Optional project ID filter
   * @param serviceName - Optional service name filter
   * @returns Array of service call metrics
   */
  async getServiceMetrics(
    projectId?: string,
    serviceName?: ServiceName
  ): Promise<ServiceCallMetrics[]> {
    try {
      let query = this.supabaseClient
        .from('external_service_calls')
        .select('service_name, status, duration_ms, cost_usd, tokens_used')
        .is('deleted_at', null);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      if (serviceName) {
        query = query.eq('service_name', serviceName);
      }

      const { data, error } = await query;

      if (error) {
        throw new ExternalServiceDatabaseError(
          `Failed to get service metrics: ${error.message}`,
          'getServiceMetrics',
          error.code
        );
      }

      // Aggregate metrics by service name
      const metricsMap = new Map<ServiceName, ServiceCallMetrics>();

      for (const row of data || []) {
        const service = row.service_name as ServiceName;
        const existing = metricsMap.get(service) || {
          serviceName: service,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          successRate: 0,
          averageDurationMs: 0,
          totalCostUsd: 0,
          totalTokensUsed: 0,
        };

        existing.totalCalls++;

        if (row.status === 'completed') {
          existing.successfulCalls++;
        } else if (row.status === 'failed') {
          existing.failedCalls++;
        }

        if (row.duration_ms) {
          existing.averageDurationMs =
            (existing.averageDurationMs * (existing.totalCalls - 1) + row.duration_ms) /
            existing.totalCalls;
        }

        if (row.cost_usd) {
          existing.totalCostUsd += parseFloat(row.cost_usd);
        }

        if (row.tokens_used) {
          existing.totalTokensUsed = (existing.totalTokensUsed || 0) + row.tokens_used;
        }

        metricsMap.set(service, existing);
      }

      // Calculate success rates and average tokens
      const metrics = Array.from(metricsMap.values()).map(m => ({
        ...m,
        successRate: m.totalCalls > 0 ? (m.successfulCalls / m.totalCalls) * 100 : 0,
        averageTokensPerCall:
          m.totalTokensUsed && m.totalCalls > 0 ? m.totalTokensUsed / m.totalCalls : undefined,
      }));

      return metrics;
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error getting service metrics: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'getServiceMetrics'
      );
    }
  }

  /**
   * Gets recent errors for debugging
   *
   * @param projectId - Optional project ID filter
   * @param limit - Maximum number of errors to return
   * @returns Array of service call errors
   */
  async getRecentErrors(projectId?: string, limit = 50): Promise<ServiceCallError[]> {
    try {
      let query = this.supabaseClient
        .from('external_service_calls')
        .select('id, service_name, error_message, error_details, retry_count, created_at')
        .eq('status', 'failed')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        throw new ExternalServiceDatabaseError(
          `Failed to get recent errors: ${error.message}`,
          'getRecentErrors',
          error.code
        );
      }

      return (data || []).map(row => ({
        callId: row.id,
        serviceName: row.service_name as ServiceName,
        errorMessage: row.error_message || 'Unknown error',
        errorDetails: row.error_details,
        retryCount: row.retry_count,
        timestamp: row.created_at,
      }));
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error getting recent errors: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'getRecentErrors'
      );
    }
  }

  /**
   * Gets performance metrics for services
   *
   * @param projectId - Optional project ID filter
   * @returns Array of service performance metrics
   */
  async getPerformanceMetrics(projectId?: string): Promise<ServiceCallPerformance[]> {
    try {
      let query = this.supabaseClient
        .from('external_service_calls')
        .select('service_name, endpoint_path, duration_ms')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('duration_ms', 'is', null);

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) {
        throw new ExternalServiceDatabaseError(
          `Failed to get performance metrics: ${error.message}`,
          'getPerformanceMetrics',
          error.code
        );
      }

      // Group by service and endpoint
      const perfMap = new Map<string, number[]>();

      for (const row of data || []) {
        const key = `${row.service_name}:${row.endpoint_path}`;
        const durations = perfMap.get(key) || [];
        durations.push(row.duration_ms);
        perfMap.set(key, durations);
      }

      // Calculate percentiles
      const metrics: ServiceCallPerformance[] = [];

      for (const [key, durations] of perfMap.entries()) {
        const [serviceName, endpointPath] = key.split(':');
        const sorted = durations.sort((a, b) => a - b);

        metrics.push({
          serviceName: serviceName as ServiceName,
          endpointPath,
          averageDurationMs: durations.reduce((a, b) => a + b, 0) / durations.length,
          minDurationMs: sorted[0],
          maxDurationMs: sorted[sorted.length - 1],
          p50DurationMs: sorted[Math.floor(sorted.length * 0.5)],
          p95DurationMs: sorted[Math.floor(sorted.length * 0.95)],
          p99DurationMs: sorted[Math.floor(sorted.length * 0.99)],
          callCount: durations.length,
        });
      }

      return metrics;
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error getting performance metrics: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'getPerformanceMetrics'
      );
    }
  }

  /**
   * Soft deletes a service call record
   *
   * @param callId - Service call ID
   */
  async deleteServiceCall(callId: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from('external_service_calls')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', callId);

      if (error) {
        throw new ExternalServiceDatabaseError(
          `Failed to delete service call: ${error.message}`,
          'deleteServiceCall',
          error.code
        );
      }

      console.log('Service call deleted:', { callId });
    } catch (error) {
      if (error instanceof ExternalServiceDatabaseError) {
        throw error;
      }

      throw new ExternalServiceDatabaseError(
        `Unexpected error deleting service call: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'deleteServiceCall'
      );
    }
  }
}
