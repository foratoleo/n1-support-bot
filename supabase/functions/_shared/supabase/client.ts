/**
 * Supabase Client Factory for Edge Functions
 *
 * Provides a centralized, singleton Supabase client for Edge Functions with service role authentication.
 * This module ensures consistent Supabase client configuration across all Edge Functions.
 *
 * @module _shared/supabase/client
 *
 * @example
 * ```typescript
 * import { createSupabaseClient } from '../_shared/supabase/client.ts';
 *
 * const supabase = createSupabaseClient();
 * const { data, error } = await supabase
 *   .from('platform_settings')
 *   .select('*')
 *   .eq('section', 'ai');
 * ```
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Singleton instance of the Supabase client.
 * Reused across function invocations to optimize performance and reduce initialization overhead.
 */
let supabaseInstance: SupabaseClient | null = null;

/**
 * Creates and returns a singleton Supabase client with service role authentication.
 *
 * This function implements the singleton pattern to ensure only one Supabase client
 * instance is created and reused across multiple function invocations. This approach
 * reduces initialization overhead and improves performance.
 *
 * **Authentication**: Uses service role key for full database access, bypassing RLS policies.
 * Use with caution and ensure proper request validation.
 *
 * **Environment Variables Required**:
 * - `SUPABASE_URL`: Your Supabase project URL
 * - `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin-level access
 *
 * @returns {SupabaseClient} Configured Supabase client instance
 *
 * @throws {Error} If required environment variables are missing
 *
 * @example
 * ```typescript
 * // Basic usage
 * const supabase = createSupabaseClient();
 *
 * // Query platform settings
 * const { data, error } = await supabase
 *   .from('platform_settings')
 *   .select('*')
 *   .eq('section', 'ai')
 *   .is('deleted_at', null);
 *
 * if (error) {
 *   console.error('Database query failed:', error);
 *   throw error;
 * }
 * ```
 */
export function createSupabaseClient(): SupabaseClient {
  // Return existing instance if already initialized
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Retrieve and validate environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error(
      'Missing required environment variable: SUPABASE_URL. ' +
      'Please ensure SUPABASE_URL is set in your Edge Function environment.'
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY. ' +
      'Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Edge Function environment.'
    );
  }

  // Create and cache Supabase client instance
  supabaseInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseInstance;
}

/**
 * Resets the singleton instance.
 * Primarily used for testing purposes to ensure clean state between tests.
 *
 * @internal
 */
export function resetSupabaseClient(): void {
  supabaseInstance = null;
}
