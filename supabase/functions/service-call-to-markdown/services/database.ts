import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ExternalServiceCall } from '../types.ts';
import { DatabaseError, NotFoundError } from '../utils/validation.ts';

export class ServiceCallRepository {
  constructor(private client: SupabaseClient) {}

  async findById(id: string): Promise<ExternalServiceCall> {
    const { data, error } = await this.client
      .from('view_external_service_calls_active')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new DatabaseError(`Failed to query service call: ${error.message}`, 'select');
    }

    if (!data) {
      throw new NotFoundError(`Service call with ID ${id} not found`);
    }

    return data as unknown as ExternalServiceCall;
  }
}
