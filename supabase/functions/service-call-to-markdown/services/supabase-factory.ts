import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export class SupabaseClientFactory {
  static create(authHeader: string): SupabaseClient {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration not found');
    }

    return createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader || '',
        },
      },
    });
  }
}
