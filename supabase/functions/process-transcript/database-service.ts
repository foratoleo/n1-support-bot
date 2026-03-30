import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface FileRequest {
  id: string;
  file_content: string;
  context_data: any;
  status: 'pending' | 'processing' | 'ai_processing' | 'post_processing' | 'completed' | 'failed';
  result_data?: any;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

interface ProcessingMetadata {
  processingTime: number;
  tokensUsed: number;
  modelUsed: string;
  generatedAt: string;
  version: string;
}

export class DatabaseService {
  private supabase: SupabaseClient;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor(url?: string, serviceKey?: string) {
    const supabaseUrl = url || Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = serviceKey || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Create a new file request with initial status
   */
  async createRequest(
    id: string,
    transcript: string,
    context: any,
    status: FileRequest['status'] = 'ai_processing'
  ): Promise<{ data: FileRequest | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('file_requests')
        .insert({
          id,
          file_content: transcript,
          context_data: context,
          status,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Database insert error:', error);
        return { data: null, error: new Error(error.message) };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Unexpected database error:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Update request status with atomic operation
   */
  async updateStatus(
    requestId: string,
    status: FileRequest['status'],
    errorMessage?: string
  ): Promise<{ success: boolean; error: Error | null }> {
    let attempts = 0;
    
    while (attempts < this.maxRetries) {
      try {
        const updateData: any = {
          status,
          updated_at: new Date().toISOString()
        };
        
        if (errorMessage) {
          updateData.error_message = errorMessage;
        }
        
        const { error } = await this.supabase
          .from('file_requests')
          .update(updateData)
          .eq('id', requestId);

        if (!error) {
          return { success: true, error: null };
        }

        // Log error and retry if retryable
        console.error(`Status update attempt ${attempts + 1} failed:`, error);
        
        if (attempts < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempts)); // Exponential backoff
          attempts++;
          continue;
        }
        
        return { success: false, error: new Error(error.message) };
      } catch (error) {
        console.error('Unexpected error updating status:', error);
        
        if (attempts < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempts));
          attempts++;
          continue;
        }
        
        return { success: false, error: error as Error };
      }
    }
    
    return { success: false, error: new Error('Max retries exceeded') };
  }

  /**
   * Store processing results with JSONB optimization
   */
  async storeResults(
    requestId: string,
    results: any,
    metadata?: ProcessingMetadata
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      // Prepare optimized JSONB structure
      const resultData = {
        ...results,
        metadata: metadata || {
          processingTime: 0,
          tokensUsed: 0,
          modelUsed: 'unknown',
          generatedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      const { error } = await this.supabase
        .from('file_requests')
        .update({
          status: 'completed',
          result_data: resultData,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) {
        console.error('Failed to store results:', error);
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Unexpected error storing results:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Get request by ID
   */
  async getRequest(requestId: string): Promise<{ data: FileRequest | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('file_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error fetching request:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Update request with partial data
   */
  async updateRequest(
    requestId: string,
    updates: Partial<FileRequest>
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await this.supabase
        .from('file_requests')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) {
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Error updating request:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Handle transaction rollback for failed processing
   */
  async rollbackRequest(
    requestId: string,
    errorMessage: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await this.supabase
        .from('file_requests')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) {
        console.error('Rollback failed:', error);
        return { success: false, error: new Error(error.message) };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Unexpected rollback error:', error);
      return { success: false, error: error as Error };
    }
  }

  /**
   * Get processing statistics for monitoring
   */
  async getProcessingStats(
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{ data: any; error: Error | null }> {
    try {
      const timeMap = {
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000
      };
      
      const since = new Date(Date.now() - timeMap[timeRange]).toISOString();
      
      const { data, error } = await this.supabase
        .from('file_requests')
        .select('status, created_at')
        .gte('created_at', since);

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      // Calculate statistics
      const stats = {
        total: data.length,
        completed: data.filter(r => r.status === 'completed').length,
        failed: data.filter(r => r.status === 'failed').length,
        processing: data.filter(r => ['processing', 'ai_processing', 'post_processing'].includes(r.status)).length,
        successRate: 0
      };
      
      if (stats.total > 0) {
        stats.successRate = (stats.completed / stats.total) * 100;
      }

      return { data: stats, error: null };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Clean up old failed requests
   */
  async cleanupOldRequests(daysOld = 7): Promise<{ deletedCount: number; error: Error | null }> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await this.supabase
        .from('file_requests')
        .delete()
        .eq('status', 'failed')
        .lt('created_at', cutoffDate)
        .select('id');

      if (error) {
        return { deletedCount: 0, error: new Error(error.message) };
      }

      return { deletedCount: data?.length || 0, error: null };
    } catch (error) {
      console.error('Cleanup error:', error);
      return { deletedCount: 0, error: error as Error };
    }
  }

  /**
   * Helper function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check database connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('file_requests')
        .select('id')
        .limit(1);
      
      return !error;
    } catch {
      return false;
    }
  }
}