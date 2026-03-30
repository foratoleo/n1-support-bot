import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { StoreDocumentParams } from './types.ts';

// Reading speed constant (words per minute)
const READING_SPEED_WPM = 200;

/**
 * Service for managing generated documents in the generated_documents table.
 * Handles document storage with automatic metadata calculation.
 */
export class GeneratedDocumentService {
  constructor(
    private supabaseClient: SupabaseClient,
    private operation: string
  ) {}

  /**
   * Calculate word count from document content
   */
  private calculateWordCount(content: string): number {
    // Remove markdown syntax, extra whitespace, and count words
    const cleanText = content
      .replace(/[#*_~`\[\]()]/g, '') // Remove markdown characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return cleanText.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Calculate section count from markdown headers
   */
  private calculateSectionCount(content: string): number {
    // Count markdown headers (lines starting with #)
    const headerPattern = /^#{1,6}\s+.+$/gm;
    const matches = content.match(headerPattern);
    return matches ? matches.length : 0;
  }

  /**
   * Calculate estimated reading time in minutes
   */
  private calculateReadingTime(wordCount: number): number {
    return Math.ceil(wordCount / READING_SPEED_WPM);
  }

  /**
   * Extract document title from markdown content
   * Looks for first H1 heading (# Title) or first non-empty line
   */
  private extractTitleFromMarkdown(content: string): string | null {
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('# ')) {
        const title = trimmedLine.substring(2).trim();
        if (title.length > 0 && title.length <= 200) {
          return title;
        }
      }
    }

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 0 && !trimmedLine.startsWith('#')) {
        if (trimmedLine.length <= 200) {
          return trimmedLine;
        }
      }
    }

    return null;
  }

  /**
   * Generate document name based on type and timestamp
   */
  private generateDocumentName(documentType: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const formattedType = documentType
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return `${formattedType} - ${timestamp}`;
  }

  /**
   * Detect content format based on document type and content structure
   */
  private detectContentFormat(documentType: string, content: string): 'json' | 'markdown' {
    // Tasks always use JSON format
    if (documentType === 'tasks') {
      return 'json';
    }

    // Try to parse as JSON
    try {
      JSON.parse(content.trim());
      return 'json';
    } catch {
      return 'markdown';
    }
  }

  /**
   * Store a generated document in the database with calculated metadata
   *
   * @param params - Document storage parameters
   * @returns Object with document ID and name on success, null on failure
   */
  async storeDocument(params: StoreDocumentParams): Promise<{ id: string; name: string } | null> {
    try {
      // Detect content format
      const contentFormat = this.detectContentFormat(params.document_type, params.content);
      console.log(`[${this.operation}] Detected content format: ${contentFormat}`);

      // Calculate metadata (skip for JSON as it's not human-readable)
      const wordCount = contentFormat === 'markdown' ? this.calculateWordCount(params.content) : 0;
      const sectionCount = contentFormat === 'markdown' ? this.calculateSectionCount(params.content) : 0;
      const estimatedReadingTime = contentFormat === 'markdown' ? this.calculateReadingTime(wordCount) : 0;

      // Determine document name with priority: params > extracted (only for markdown) > generated
      let documentName = params.document_name;

      if (!documentName) {
        // Only try to extract title from markdown content
        if (contentFormat === 'markdown') {
          const extractedTitle = this.extractTitleFromMarkdown(params.content);
          if (extractedTitle) {
            documentName = extractedTitle;
            console.log(`[${this.operation}] Extracted title from markdown: "${documentName}"`);
          } else {
            documentName = this.generateDocumentName(params.document_type);
            console.log(`[${this.operation}] Generated fallback title: "${documentName}"`);
          }
        } else {
          // For JSON content, always generate a name
          documentName = this.generateDocumentName(params.document_type);
          console.log(`[${this.operation}] Generated title for JSON content: "${documentName}"`);
        }
      } else {
        console.log(`[${this.operation}] Using provided document name: "${documentName}"`);
      }

      // Prepare document record
      const documentRecord = {
        content: params.content,
        document_type: params.document_type,
        document_name: documentName,
        project_id: params.project_id,
        ai_interaction_id: params.ai_interaction_id,
        submitted_by: params.user_id || null,
        meeting_transcript_id: params.meeting_transcript_id || null,
        sprint_id: params.sprint_id || null,
        status: 'draft',
        content_format: contentFormat,
        version: 1,
        is_current_version: true,
        word_count: wordCount,
        section_count: sectionCount,
        estimated_reading_time: estimatedReadingTime,
      };

      // Insert document
      const { data, error } = await this.supabaseClient
        .from('generated_documents')
        .insert(documentRecord)
        .select('id, document_name')
        .single();

      if (error) {
        console.error(`[${this.operation}] Failed to store document:`, error);
        return null;
      }

      console.log(`[${this.operation}] Stored document: ${data.id} (${wordCount} words, ${sectionCount} sections, ~${estimatedReadingTime} min read)`);
      return { id: data.id, name: data.document_name };
    } catch (error) {
      console.error(`[${this.operation}] Error storing document:`, error);
      return null;
    }
  }
}
