/**
 * GitHub Sync Configuration Service
 *
 * Manages GitHub synchronization configuration for repositories.
 * Handles token encryption/decryption, sync frequency, and sync state tracking.
 *
 * @module github/sync-config-service
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

/**
 * Sync frequency options
 */
export type SyncFrequency = 'manual' | 'hourly' | 'daily' | 'realtime';

/**
 * Sync configuration creation parameters
 */
export interface CreateSyncConfigParams {
  repository_id: number;
  github_token_encrypted: string;
  sync_frequency?: SyncFrequency;
  sync_enabled?: boolean;
}

/**
 * Sync configuration update parameters
 */
export interface UpdateSyncConfigParams {
  github_token_encrypted?: string;
  sync_enabled?: boolean;
  sync_frequency?: SyncFrequency;
  sync_cursor?: Record<string, unknown>;
  last_synced_at?: string;
  is_active?: boolean;
}

/**
 * Sync configuration record
 */
export interface SyncConfigRecord {
  id: string;
  repository_id: number;
  github_token_encrypted: string;
  sync_enabled: boolean;
  sync_frequency: SyncFrequency;
  last_synced_at: string | null;
  sync_cursor: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Service for managing GitHub sync configuration.
 * Handles lifecycle: create → update → disable
 */
export class GitHubSyncConfigService {
  constructor(
    private supabaseClient: SupabaseClient,
    private operation: string
  ) {}

  /**
   * Get sync configuration by repository ID
   *
   * @param repositoryId - Repository ID
   * @returns Sync configuration record or null if not found
   */
  async getConfigByRepositoryId(repositoryId: number): Promise<SyncConfigRecord | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('github_sync_config')
        .select('*')
        .eq('repository_id', repositoryId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found - this is expected for new repositories
          console.log(`[${this.operation}] No sync config found for repository ${repositoryId}`);
          return null;
        }
        console.error(`[${this.operation}] Failed to get sync config:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Retrieved sync config for repository ${repositoryId}`);
      return data as SyncConfigRecord;
    } catch (error) {
      console.error(`[${this.operation}] Error getting sync config:`, error);
      throw error;
    }
  }

  /**
   * Get all active sync configurations (for cron job queries)
   *
   * @returns Array of active sync configurations
   */
  async getActiveConfigs(): Promise<SyncConfigRecord[]> {
    try {
      const { data, error } = await this.supabaseClient
        .from('github_sync_config')
        .select('*')
        .eq('is_active', true)
        .eq('sync_enabled', true)
        .is('deleted_at', null)
        .order('last_synced_at', { ascending: true, nullsFirst: true });

      if (error) {
        console.error(`[${this.operation}] Failed to get active configs:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Retrieved ${data.length} active sync configs`);
      return data as SyncConfigRecord[];
    } catch (error) {
      console.error(`[${this.operation}] Error getting active configs:`, error);
      throw error;
    }
  }

  /**
   * Create a new sync configuration
   *
   * @param params - Configuration parameters
   * @returns Created sync configuration record
   */
  async createConfig(params: CreateSyncConfigParams): Promise<SyncConfigRecord> {
    try {
      const configRecord = {
        repository_id: params.repository_id,
        github_token_encrypted: params.github_token_encrypted,
        sync_frequency: params.sync_frequency || 'manual',
        sync_enabled: params.sync_enabled !== undefined ? params.sync_enabled : true,
        is_active: true,
      };

      const { data, error } = await this.supabaseClient
        .from('github_sync_config')
        .insert(configRecord)
        .select('*')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to create sync config:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Created sync config: ${data.id} for repository ${params.repository_id}`);
      return data as SyncConfigRecord;
    } catch (error) {
      console.error(`[${this.operation}] Error creating sync config:`, error);
      throw error;
    }
  }

  /**
   * Update an existing sync configuration
   *
   * @param id - Configuration ID
   * @param updates - Fields to update
   * @returns Updated sync configuration record
   */
  async updateConfig(id: string, updates: UpdateSyncConfigParams): Promise<SyncConfigRecord> {
    try {
      const { data, error } = await this.supabaseClient
        .from('github_sync_config')
        .update(updates)
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to update sync config:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Updated sync config: ${id}`);
      return data as SyncConfigRecord;
    } catch (error) {
      console.error(`[${this.operation}] Error updating sync config:`, error);
      throw error;
    }
  }

  /**
   * Update last synced timestamp and sync cursor
   *
   * @param id - Configuration ID
   * @param cursor - Sync cursor data (optional)
   * @returns Updated sync configuration record
   */
  async updateLastSynced(id: string, cursor?: Record<string, unknown>): Promise<SyncConfigRecord> {
    try {
      const updates: UpdateSyncConfigParams = {
        last_synced_at: new Date().toISOString(),
      };

      if (cursor) {
        updates.sync_cursor = cursor;
      }

      const { data, error } = await this.supabaseClient
        .from('github_sync_config')
        .update(updates)
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to update last synced:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Updated last synced for config: ${id}`);
      return data as SyncConfigRecord;
    } catch (error) {
      console.error(`[${this.operation}] Error updating last synced:`, error);
      throw error;
    }
  }

  /**
   * Disable sync for a configuration (soft disable)
   *
   * @param id - Configuration ID
   * @returns Updated sync configuration record
   */
  async disableSync(id: string): Promise<SyncConfigRecord> {
    try {
      const { data, error } = await this.supabaseClient
        .from('github_sync_config')
        .update({
          sync_enabled: false,
          is_active: false,
        })
        .eq('id', id)
        .is('deleted_at', null)
        .select('*')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to disable sync:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Disabled sync for config: ${id}`);
      return data as SyncConfigRecord;
    } catch (error) {
      console.error(`[${this.operation}] Error disabling sync:`, error);
      throw error;
    }
  }
}
