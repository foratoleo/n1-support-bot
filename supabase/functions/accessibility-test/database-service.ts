import { SupabaseClient } from '@supabase/supabase-js';
import { PageSpeedResult, ValidationResults } from './types.ts';
import { DatabaseError } from './utils/validation.ts';
import { DOCUMENT_TYPE, IS_CURRENT_VERSION, INTERACTION_TYPE, REQUEST_MODEL } from './config.ts';

/**
 * Service for database operations related to accessibility testing
 */
export class AccessibilityDatabaseService {
  constructor(private supabaseClient: SupabaseClient) {}

  /**
   * Creates an AI interaction record for tracking
   * @param projectId - Project UUID
   * @param requestData - Complete request data sent to API
   * @returns Created interaction ID
   */
  async createAIInteraction(
    projectId: string,
    requestData: {
      target_url: string;
      strategy: string;
      locale: string;
    }
  ): Promise<string> {
    try {
      const { data, error } = await this.supabaseClient
        .from('ai_interactions')
        .insert({
          project_id: projectId,
          interaction_type: INTERACTION_TYPE,
          status: 'pending',
          request_data: requestData,
          request_model: REQUEST_MODEL,
          request_parameters: {
            timeout: 30000,
          },
          started_at: new Date().toISOString(),
          sequence_order: 1,
        })
        .select('id')
        .single();

      if (error) {
        console.error('Database error creating AI interaction:', error);
        throw new DatabaseError(
          `Failed to create AI interaction: ${error.message}`,
          'createAIInteraction',
          error.code
        );
      }

      if (!data || !data.id) {
        throw new DatabaseError(
          'AI interaction created but no ID returned',
          'createAIInteraction'
        );
      }

      console.log('AI interaction created:', { id: data.id, projectId });
      return data.id;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle foreign key constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; message: string };
        if (pgError.code === '23503') {
          throw new DatabaseError(
            'Invalid project_id: project does not exist',
            'createAIInteraction',
            'foreign_key_violation'
          );
        }
      }

      throw new DatabaseError(
        `Unexpected error creating AI interaction: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'createAIInteraction'
      );
    }
  }

  /**
   * Stores the PageSpeed test result in the database
   * @param projectId - Project UUID
   * @param aiInteractionId - AI interaction UUID from createAIInteraction
   * @param result - PageSpeed API result
   * @param requestUrl - Original URL that was tested
   * @returns Created document ID
   */
  async storeTestResult(
    projectId: string,
    aiInteractionId: string,
    result: PageSpeedResult,
    requestUrl: string
  ): Promise<string> {
    try {
      // Extract metrics from the result
      const validationResults = this.extractValidationResults(result);

      // Generate document name with timestamp
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const documentName = `Accessibility Test - ${requestUrl} - ${timestamp}`;

      // Prepare document data
      const documentData = {
        project_id: projectId,
        ai_interaction_id: aiInteractionId,
        document_type: DOCUMENT_TYPE,
        document_name: documentName,
        version: 1,
        is_current_version: IS_CURRENT_VERSION,
        content: JSON.stringify(result),
        raw_content: JSON.stringify(result.lighthouseResult),
        content_format: 'json',
        validation_results: validationResults,
      };

      const { data, error } = await this.supabaseClient
        .from('generated_documents')
        .insert(documentData)
        .select('id')
        .single();

      if (error) {
        console.error('Database error storing test result:', error);
        throw new DatabaseError(
          `Failed to store test result: ${error.message}`,
          'storeTestResult',
          error.code
        );
      }

      if (!data || !data.id) {
        throw new DatabaseError(
          'Test result stored but no ID returned',
          'storeTestResult'
        );
      }

      console.log('Test result stored:', {
        documentId: data.id,
        projectId,
        aiInteractionId,
        url: requestUrl,
      });

      return data.id;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      // Handle specific database constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; message: string };

        switch (pgError.code) {
          case '23503':
            throw new DatabaseError(
              'Foreign key constraint violation: invalid project_id or ai_interaction_id',
              'storeTestResult',
              'foreign_key_violation'
            );
          case '23505':
            throw new DatabaseError(
              'Duplicate document entry',
              'storeTestResult',
              'unique_violation'
            );
          case '23514':
            throw new DatabaseError(
              'Check constraint violation: invalid data values',
              'storeTestResult',
              'check_violation'
            );
          default:
            throw new DatabaseError(
              `Database constraint error: ${pgError.message}`,
              'storeTestResult',
              pgError.code
            );
        }
      }

      throw new DatabaseError(
        `Unexpected error storing test result: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'storeTestResult'
      );
    }
  }

  /**
   * Extracts validation metrics from PageSpeed result
   */
  private extractValidationResults(result: PageSpeedResult): ValidationResults {
    const categories = result.lighthouseResult.categories;
    const audits = result.lighthouseResult.audits || {};

    // Extract accessibility score
    const accessibilityScore = categories.accessibility?.score ?? null;

    // Count audits by status
    const auditEntries = Object.values(audits);
    const totalAudits = auditEntries.length;
    const passedAudits = auditEntries.filter(
      (audit) => audit.score === 1 || audit.score === null
    ).length;
    const failedAudits = auditEntries.filter(
      (audit) => audit.score !== null && audit.score < 1
    ).length;

    // Extract WCAG violations from accessibility audits
    const wcagViolations = [];
    if (categories.accessibility?.auditRefs) {
      for (const auditRef of categories.accessibility.auditRefs) {
        const audit = audits[auditRef.id];
        if (audit && audit.score !== null && audit.score < 1) {
          wcagViolations.push({
            id: audit.id,
            title: audit.title,
            description: audit.description,
            impact: this.getImpactLevel(audit.score),
          });
        }
      }
    }

    return {
      accessibility_score: accessibilityScore,
      total_audits: totalAudits,
      passed_audits: passedAudits,
      failed_audits: failedAudits,
      wcag_violations: wcagViolations.length > 0 ? wcagViolations : undefined,
    };
  }

  /**
   * Maps audit score to impact level
   */
  private getImpactLevel(score: number | null): string {
    if (score === null) return 'unknown';
    if (score >= 0.9) return 'minor';
    if (score >= 0.5) return 'moderate';
    return 'serious';
  }

  /**
   * Updates AI interaction with completion data
   * @param interactionId - AI interaction UUID
   * @param updateData - Data to update
   */
  async updateAIInteraction(
    interactionId: string,
    updateData: {
      status: 'completed' | 'failed';
      responseData?: any;
      errorMessage?: string;
      durationMs?: number;
    }
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const dbUpdate: any = {
        status: updateData.status,
        completed_at: now,
        updated_at: now,
      };

      if (updateData.durationMs !== undefined) {
        dbUpdate.duration_ms = updateData.durationMs;
      }

      if (updateData.responseData) {
        dbUpdate.response_data = updateData.responseData;
      }

      if (updateData.errorMessage) {
        dbUpdate.error_message = updateData.errorMessage;
      }

      const { error } = await this.supabaseClient
        .from('ai_interactions')
        .update(dbUpdate)
        .eq('id', interactionId);

      if (error) {
        console.error('Database error updating AI interaction:', error);
        throw new DatabaseError(
          `Failed to update AI interaction: ${error.message}`,
          'updateAIInteraction',
          error.code
        );
      }

      console.log('AI interaction updated:', {
        interactionId,
        status: updateData.status,
        durationMs: updateData.durationMs,
      });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      throw new DatabaseError(
        `Unexpected error updating AI interaction: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'updateAIInteraction'
      );
    }
  }

  /**
   * Updates test status (for future use with status tracking)
   */
  async updateTestStatus(
    documentId: string,
    status: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (metadata) {
        updateData.validation_results = metadata;
      }

      const { error } = await this.supabaseClient
        .from('generated_documents')
        .update(updateData)
        .eq('id', documentId);

      if (error) {
        console.error('Database error updating test status:', error);
        throw new DatabaseError(
          `Failed to update test status: ${error.message}`,
          'updateTestStatus',
          error.code
        );
      }

      console.log('Test status updated:', { documentId, status });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      throw new DatabaseError(
        `Unexpected error updating test status: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'updateTestStatus'
      );
    }
  }
}
