import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { DatabaseQueryResult } from './types.ts';

const QUERY_TIMEOUT_MS = 10000;
const LIGHTWEIGHT_FIELDS = 'id,title,status,assigned_to,tags,priority,estimated_hours,created_at,updated_at,sprint,feature';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async resolveEmailToMemberId(email: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('team_members')
      .select('id')
      .eq('email', email)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      console.log(`No team member found for email: ${email}`);
      return null;
    }

    return data.id;
  }

  async getTasksWithFilters(filters: {
    projectId: string;
    status?: string[];
    assignedTo?: string;
    includeDescription: boolean;
    page: number;
    limit: number;
  }): Promise<DatabaseQueryResult> {
    const startTime = Date.now();

    try {
      const offset = (filters.page - 1) * filters.limit;
      const selectFields = filters.includeDescription ? '*' : LIGHTWEIGHT_FIELDS;

      let query = this.supabase
        .from('view_dev_tasks_with_relations')
        .select(selectFields, { count: 'exact' })
        .eq('project_id', filters.projectId)
        .is('deleted_at', null);

      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.assignedTo) {
        query = query.eq('assigned_to_id', filters.assignedTo);
      }

      query = query
        .order('updated_at', { ascending: false })
        .range(offset, offset + filters.limit - 1);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), QUERY_TIMEOUT_MS)
      );

      const { data, error, count } = await Promise.race([
        query,
        timeoutPromise
      ]) as any;

      const duration = Date.now() - startTime;
      console.log(`Query executed in ${duration}ms, returned ${data?.length || 0} rows`);

      if (error) {
        console.error('Database error:', error);
        throw this.handleDatabaseError(error);
      }

      const totalCount = count || 0;
      const hasMore = offset + filters.limit < totalCount;

      return {
        tasks: data || [],
        totalCount,
        hasMore
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Query failed after ${duration}ms:`, error);
      throw error;
    }
  }

  private handleDatabaseError(error: any): Error {
    if (error.code === '23503') {
      return new Error('Invalid foreign key reference');
    }

    if (error.code === '42501') {
      return new Error('Permission denied');
    }

    if (error.message?.includes('timeout')) {
      return new Error('Database query timeout');
    }

    return new Error(error.message || 'Database operation failed');
  }
}
