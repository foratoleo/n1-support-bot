import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { extractTokenUsage, extractResponseMetadata } from './token-extractor.ts';
import { AIInteractionParams, InteractionMetadata } from './types.ts';

const INTERACTION_TYPE = 'document_generation';

/**
 * Service for managing AI interaction tracking in the ai_interactions table.
 * Handles lifecycle: pending → in_progress → completed/failed
 */
export class AIInteractionService {
  constructor(
    private supabaseClient: SupabaseClient,
    private operation: string
  ) {}

  /**
   * Create a new AI interaction record with pending status
   */
  async createInteraction(params: AIInteractionParams): Promise<string> {
    try {
      const { data, error } = await this.supabaseClient
        .from('ai_interactions')
        .insert({
          project_id: params.project_id,
          interaction_type: INTERACTION_TYPE,
          status: 'pending',
          request_prompt: params.request_prompt,
          request_model: params.request_model,
          request_parameters: params.request_parameters,
          previous_interaction_id: params.previous_interaction_id,
          meeting_transcript_id: params.meeting_transcript_id,
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to create interaction:`, error);
        throw error;
      }

      console.log(`[${this.operation}] Created interaction: ${data.id}`);
      return data.id;
    } catch (error) {
      console.error(`[${this.operation}] Error creating interaction:`, error);
      throw error;
    }
  }

  /**
   * Update interaction status to in_progress and set started_at timestamp
   */
  async updateInteractionInProgress(interactionId: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient
        .from('ai_interactions')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', interactionId);

      if (error) {
        console.error(`[${this.operation}] Failed to update interaction:`, error);
      }
    } catch (error) {
      console.error(`[${this.operation}] Error updating interaction:`, error);
    }
  }

  /**
   * Complete interaction with response data, token usage, and duration
   */
  async completeInteraction(
    interactionId: string,
    response: any,
    document: string,
    startTime: number
  ): Promise<void> {
    try {
      const duration = Date.now() - startTime;
      const tokenUsage = extractTokenUsage(response);
      const metadata: InteractionMetadata = extractResponseMetadata(response);

      const { error } = await this.supabaseClient
        .from('ai_interactions')
        .update({
          status: 'completed',
          response_text: document,
          token_usage: tokenUsage,
          openai_conversation_id: metadata.conversation_id,
          response_metadata: metadata,
          duration_ms: duration,
          completed_at: new Date().toISOString(),
        })
        .eq('id', interactionId);

      if (error) {
        console.error(`[${this.operation}] Failed to complete interaction:`, error);
      } else {
        console.log(`[${this.operation}] Completed interaction: ${interactionId} (${duration}ms)`);
      }
    } catch (error) {
      console.error(`[${this.operation}] Error completing interaction:`, error);
    }
  }

  /**
   * Mark interaction as failed with error details
   */
  async failInteraction(
    interactionId: string,
    error: Error,
    startTime: number
  ): Promise<void> {
    try {
      const duration = Date.now() - startTime;

      const { error: updateError } = await this.supabaseClient
        .from('ai_interactions')
        .update({
          status: 'failed',
          error_message: error.message,
          error_details: {
            name: error.name,
            stack: error.stack,
            timestamp: new Date().toISOString(),
          },
          duration_ms: duration,
          completed_at: new Date().toISOString(),
        })
        .eq('id', interactionId);

      if (updateError) {
        console.error(`[${this.operation}] Failed to mark interaction as failed:`, updateError);
      } else {
        console.log(`[${this.operation}] Marked interaction as failed: ${interactionId}`);
      }
    } catch (err) {
      console.error(`[${this.operation}] Error marking interaction as failed:`, err);
    }
  }
}
