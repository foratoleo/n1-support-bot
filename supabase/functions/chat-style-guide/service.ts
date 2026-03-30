import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import {
  StyleGuideSummary,
  ActionRequired,
  ProposedOutline,
  ProposedSection,
  ProposedSubsection,
  GenerationPhase,
} from './types.ts';
import {
  ChatAction,
  MAX_GUIDE_CONTENT_LENGTH,
  MAX_GUIDES_IN_CONTEXT,
  OPERATION,
  PROPOSAL_PHASE_INSTRUCTIONS,
  FINAL_PHASE_INSTRUCTIONS,
  LANGUAGE_INSTRUCTIONS,
  DEFAULT_GUIDE_LANGUAGE,
  type ActionQueryConfig,
  type GuideLanguage,
} from './config.ts';

/**
 * Service class for style guide chat operations.
 * Handles fetching style guides, building context, and determining actions.
 */
export class StyleGuideChatService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Fetches all active, non-deleted style guides for context building.
   * Content is truncated to MAX_GUIDE_CONTENT_LENGTH to manage token usage.
   *
   * @param maxGuides - Optional maximum number of guides to fetch (defaults to MAX_GUIDES_IN_CONTEXT)
   * @returns Array of style guide summaries
   */
  async fetchActiveStyleGuides(maxGuides?: number): Promise<StyleGuideSummary[]> {
    try {
      const limit = maxGuides && maxGuides > 0 ? maxGuides : MAX_GUIDES_IN_CONTEXT;
      console.log(`[${OPERATION}] Fetching active style guides (limit: ${limit})`);

      const { data, error } = await this.supabase
        .from('style_guides')
        .select('id, name, category, content')
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('category', { ascending: true })
        .order('name', { ascending: true })
        .limit(limit);

      if (error) {
        console.error(`[${OPERATION}] Error fetching style guides:`, error);
        return [];
      }

      if (!data || data.length === 0) {
        console.log(`[${OPERATION}] No active style guides found`);
        return [];
      }

      // Truncate content for context size management
      const summaries: StyleGuideSummary[] = data.map((guide) => ({
        id: guide.id,
        name: guide.name,
        category: guide.category,
        content: this.truncateContent(guide.content, MAX_GUIDE_CONTENT_LENGTH),
      }));

      console.log(`[${OPERATION}] Fetched ${summaries.length} style guides`);
      return summaries;
    } catch (error) {
      console.error(`[${OPERATION}] Unexpected error fetching style guides:`, error);
      return [];
    }
  }

  /**
   * Fetches a specific style guide by ID.
   *
   * @param guideId - The UUID of the style guide
   * @returns Style guide summary or null if not found
   */
  async fetchStyleGuideById(guideId: string): Promise<StyleGuideSummary | null> {
    try {
      console.log(`[${OPERATION}] Fetching style guide: ${guideId}`);

      const { data, error } = await this.supabase
        .from('style_guides')
        .select('id, name, category, content')
        .eq('id', guideId)
        .is('deleted_at', null)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`[${OPERATION}] Style guide not found: ${guideId}`);
          return null;
        }
        console.error(`[${OPERATION}] Error fetching style guide:`, error);
        return null;
      }

      return {
        id: data.id,
        name: data.name,
        category: data.category,
        content: data.content, // Full content for specific guide
      };
    } catch (error) {
      console.error(`[${OPERATION}] Unexpected error fetching style guide:`, error);
      return null;
    }
  }

  /**
   * Builds a formatted context string from style guide summaries.
   * Groups guides by category for better organization.
   *
   * @param guides - Array of style guide summaries
   * @returns Formatted markdown context string
   */
  buildContext(guides: StyleGuideSummary[]): string {
    if (guides.length === 0) {
      return 'No style guides available in the system.';
    }

    // Group guides by category
    const groupedGuides = guides.reduce((acc, guide) => {
      if (!acc[guide.category]) {
        acc[guide.category] = [];
      }
      acc[guide.category].push(guide);
      return acc;
    }, {} as Record<string, StyleGuideSummary[]>);

    // Build formatted context
    let context = '';

    for (const [category, categoryGuides] of Object.entries(groupedGuides)) {
      context += `\n### Category: ${category}\n\n`;

      for (const guide of categoryGuides) {
        context += `#### ${guide.name} (ID: ${guide.id})\n`;
        context += `${guide.content}\n\n`;
        context += '---\n';
      }
    }

    return context.trim();
  }

  /**
   * Determines what action is required based on the AI response and request action.
   *
   * @param action - The requested action type
   * @param aiResponse - The AI response text
   * @returns The action required from the user
   */
  determineAction(action: ChatAction, aiResponse: string): ActionRequired {
    // For query and suggest actions, no confirmation needed
    if (action === 'query' || action === 'suggest') {
      return 'none';
    }

    // For generate action, ask for confirmation to create
    if (action === 'generate') {
      // Check if response contains content that could be saved
      if (this.hasGeneratedContent(aiResponse)) {
        return 'confirm_create';
      }
      return 'none';
    }

    // For modify action, ask for confirmation to update
    if (action === 'modify') {
      if (this.hasGeneratedContent(aiResponse)) {
        return 'confirm_update';
      }
      return 'none';
    }

    return 'none';
  }

  /**
   * Extracts suggested content from AI response.
   * Uses XML tags <style-guide>...</style-guide> for reliable extraction.
   * Falls back to legacy methods for backwards compatibility.
   *
   * @param aiResponse - The AI response text
   * @returns Extracted content or null if not found
   */
  extractSuggestedContent(aiResponse: string): string | null {
    if (!aiResponse || aiResponse.trim().length === 0) {
      console.log(`[${OPERATION}] extractSuggestedContent: empty response`);
      return null;
    }

    // 1. PRIMARY: Extract content from <style-guide> XML tags
    // This is the most reliable method and should be used by the AI
    const xmlMatch = aiResponse.match(/<style-guide>([\s\S]*?)<\/style-guide>/i);
    if (xmlMatch && xmlMatch[1] && xmlMatch[1].trim().length > 50) {
      console.log(`[${OPERATION}] extractSuggestedContent: found content via XML tags`);
      return xmlMatch[1].trim();
    }

    // 2. FALLBACK: Look for content after specific markers (Portuguese and English)
    // For backwards compatibility with older responses
    const markerPatterns = [
      // Generation markers
      /## (?:Conteudo Gerado|Generated Content|Novo Guia|New Guide|Style Guide Gerado)[\r\n]+([\s\S]+?)(?=\n\n---|\n\n##|$)/i,
      // Update markers
      /## (?:Conteudo Atualizado|Updated Content|Guia Modificado|Modified Guide)[\r\n]+([\s\S]+?)(?=\n\n---|\n\n##|$)/i,
      // Generic content markers
      /### (?:Conteudo|Content|Guia|Guide|Style Guide)[\r\n]+([\s\S]+?)(?=\n\n---|\n\n##|$)/i,
    ];

    for (const pattern of markerPatterns) {
      const match = aiResponse.match(pattern);
      if (match && match[1] && match[1].trim().length > 50) {
        console.log(`[${OPERATION}] extractSuggestedContent: found content via marker pattern`);
        return match[1].trim();
      }
    }

    // 3. FALLBACK: Look for structured guide content (starts with h1 header)
    // This helps when AI generates content without explicit markers
    const structuredContentMatch = aiResponse.match(
      /^(# .+[\r\n]+[\s\S]*?)(?=\n\n---|\n\nObservac|\n\n\*\*Observac|$)/m
    );
    if (structuredContentMatch && structuredContentMatch[1] && structuredContentMatch[1].trim().length > 100) {
      console.log(`[${OPERATION}] extractSuggestedContent: found content via structured pattern`);
      return structuredContentMatch[1].trim();
    }

    // 4. FALLBACK: If response is mostly markdown content (starts with # and is substantial)
    // This catches cases where AI returns the guide directly without wrapping
    if (aiResponse.trim().startsWith('#') && aiResponse.trim().length > 200) {
      // Check if it looks like a style guide (has multiple headers)
      const headerCount = (aiResponse.match(/^#{1,3}\s+.+$/gm) || []).length;
      if (headerCount >= 2) {
        console.log(`[${OPERATION}] extractSuggestedContent: using full response as structured content`);
        return aiResponse.trim();
      }
    }

    console.log(`[${OPERATION}] extractSuggestedContent: no content found in response of length ${aiResponse.length}`);
    return null;
  }

  /**
   * Extracts the suggested name from the generated content or AI response.
   * Looks for the first H1 header in the content, or explicit name markers.
   *
   * @param suggestedContent - The extracted style guide content
   * @param aiResponse - The full AI response text
   * @returns Extracted name or null if not found
   */
  extractSuggestedName(suggestedContent: string | null, aiResponse: string): string | null {
    // 1. Try to extract from explicit name markers in AI response (Portuguese and English)
    const namePatterns = [
      /\*\*Nome:\*\*\s*(.+?)(?:\n|$)/i,
      /\*\*Name:\*\*\s*(.+?)(?:\n|$)/i,
      /Nome do Guia:\s*(.+?)(?:\n|$)/i,
      /Guide Name:\s*(.+?)(?:\n|$)/i,
      /Titulo:\s*(.+?)(?:\n|$)/i,
      /Title:\s*(.+?)(?:\n|$)/i,
    ];

    for (const pattern of namePatterns) {
      const match = aiResponse.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim().replace(/[*`]/g, '');
        if (name.length > 0 && name.length <= 255) {
          console.log(`[${OPERATION}] extractSuggestedName: found via explicit marker: "${name}"`);
          return name;
        }
      }
    }

    // 2. Try to extract the first H1 header from the content
    if (suggestedContent) {
      const h1Match = suggestedContent.match(/^#\s+(.+?)(?:\n|$)/m);
      if (h1Match && h1Match[1]) {
        const name = h1Match[1].trim().replace(/[*`]/g, '');
        if (name.length > 0 && name.length <= 255) {
          console.log(`[${OPERATION}] extractSuggestedName: found via H1 header: "${name}"`);
          return name;
        }
      }
    }

    console.log(`[${OPERATION}] extractSuggestedName: no name found`);
    return null;
  }

  /**
   * Extracts the suggested category from the AI response.
   * Looks for explicit category markers in Portuguese and English.
   *
   * @param aiResponse - The AI response text
   * @returns Extracted category or null if not found
   */
  extractSuggestedCategory(aiResponse: string): string | null {
    // Valid categories
    const validCategories = [
      'typescript', 'javascript', 'react', 'python', 'sql', 'css',
      'go', 'java', 'kotlin', 'swift', 'rust', 'html', 'testing', 'devops', 'general'
    ];

    // Try to extract from explicit category markers
    const categoryPatterns = [
      /\*\*Categoria:\*\*\s*(.+?)(?:\n|$)/i,
      /\*\*Category:\*\*\s*(.+?)(?:\n|$)/i,
      /Categoria do Guia:\s*(.+?)(?:\n|$)/i,
      /Guide Category:\s*(.+?)(?:\n|$)/i,
    ];

    for (const pattern of categoryPatterns) {
      const match = aiResponse.match(pattern);
      if (match && match[1]) {
        const category = match[1].trim().toLowerCase().replace(/[*`]/g, '');
        if (validCategories.includes(category)) {
          console.log(`[${OPERATION}] extractSuggestedCategory: found via explicit marker: "${category}"`);
          return category;
        }
      }
    }

    // Try to infer category from content keywords
    const lowerResponse = aiResponse.toLowerCase();
    for (const category of validCategories) {
      // Skip 'general' as it's the default
      if (category === 'general') continue;

      // Look for strong indicators of the category
      const indicators = [
        `guia de ${category}`,
        `${category} style guide`,
        `${category} guide`,
        `padroes de ${category}`,
        `${category} patterns`,
        `${category} standards`,
      ];

      if (indicators.some(indicator => lowerResponse.includes(indicator))) {
        console.log(`[${OPERATION}] extractSuggestedCategory: inferred from content: "${category}"`);
        return category;
      }
    }

    console.log(`[${OPERATION}] extractSuggestedCategory: no category found, will use default`);
    return null;
  }

  /**
   * Extracts mentioned guide IDs from the response.
   *
   * @param aiResponse - The AI response text
   * @param availableGuides - List of available guide summaries
   * @returns Array of guide IDs mentioned in the response
   */
  extractSourcesUsed(aiResponse: string, availableGuides: StyleGuideSummary[]): string[] {
    const sourcesUsed: string[] = [];

    for (const guide of availableGuides) {
      // Check if guide name or ID is mentioned in the response
      if (
        aiResponse.toLowerCase().includes(guide.name.toLowerCase()) ||
        aiResponse.includes(guide.id)
      ) {
        sourcesUsed.push(guide.id);
      }
    }

    return [...new Set(sourcesUsed)]; // Remove duplicates
  }

  // =============================================================================
  // TWO-PHASE GENERATION METHODS
  // =============================================================================

  /**
   * Determines the effective generation phase for the request.
   * When action is 'generate' and no phase is specified, defaults to 'proposal'.
   *
   * @param action - The requested action type
   * @param explicitPhase - The explicitly provided generation_phase (if any)
   * @returns The effective generation phase, or null if not applicable
   */
  resolveGenerationPhase(
    action: ChatAction,
    explicitPhase?: GenerationPhase
  ): GenerationPhase | null {
    // Only applicable for generate action
    if (action !== 'generate') {
      return null;
    }

    // If explicitly provided, use it
    if (explicitPhase) {
      return explicitPhase;
    }

    // No explicit phase provided — let the frontend control the flow
    return null;
  }

  /**
   * Determines what action is required based on the AI response, request action,
   * and generation phase.
   *
   * @param action - The requested action type
   * @param aiResponse - The AI response text
   * @param generationPhase - The generation phase (if applicable)
   * @returns The action required from the user
   */
  determineActionWithPhase(
    action: ChatAction,
    aiResponse: string,
    generationPhase: GenerationPhase | null
  ): ActionRequired {
    // For proposal phase, the action is to review the outline
    if (action === 'generate' && generationPhase === 'proposal') {
      // Check if the response contains an outline
      if (this.hasProposedOutline(aiResponse)) {
        return 'review_outline';
      }
      // If no outline found, fall through to standard determination
    }

    // For final phase, use standard generate logic
    return this.determineAction(action, aiResponse);
  }

  /**
   * Extracts a proposed outline from the AI response.
   * Looks for JSON content wrapped in <outline>...</outline> XML tags.
   * Falls back to parsing markdown headers if the AI doesn't follow the format.
   *
   * @param aiResponse - The AI response text
   * @returns Parsed ProposedOutline or null if extraction failed
   */
  extractProposedOutline(aiResponse: string): ProposedOutline | null {
    if (!aiResponse || aiResponse.trim().length === 0) {
      console.log(`[${OPERATION}] extractProposedOutline: empty response`);
      return null;
    }

    // 1. PRIMARY: Extract JSON from <outline> XML tags
    const outlineMatch = aiResponse.match(/<outline>([\s\S]*?)<\/outline>/i);
    if (outlineMatch && outlineMatch[1]) {
      try {
        const jsonStr = outlineMatch[1].trim();
        const parsed = JSON.parse(jsonStr);

        // Validate the parsed structure
        const outline = this.validateAndNormalizeOutline(parsed);
        if (outline) {
          console.log(`[${OPERATION}] extractProposedOutline: found via XML tags (${outline.sections.length} sections)`);
          return outline;
        }
      } catch (parseError) {
        console.error(`[${OPERATION}] extractProposedOutline: JSON parse error from XML tags:`, parseError);
      }
    }

    // 2. FALLBACK: Try to find JSON block in the response (sometimes AI wraps in code fences)
    const jsonBlockMatch = aiResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1].trim());
        const outline = this.validateAndNormalizeOutline(parsed);
        if (outline) {
          console.log(`[${OPERATION}] extractProposedOutline: found via code block (${outline.sections.length} sections)`);
          return outline;
        }
      } catch {
        // Not valid JSON in code block, continue to fallback
      }
    }

    // 3. FALLBACK: Parse markdown headers to build a rough outline
    const markdownOutline = this.parseOutlineFromMarkdown(aiResponse);
    if (markdownOutline) {
      console.log(`[${OPERATION}] extractProposedOutline: built from markdown headers (${markdownOutline.sections.length} sections)`);
      return markdownOutline;
    }

    console.log(`[${OPERATION}] extractProposedOutline: no outline found in response of length ${aiResponse.length}`);
    return null;
  }

  /**
   * Builds the system prompt addendum for the proposal phase.
   * Returns the instructions that guide the AI to generate a structured outline.
   *
   * @param guideLanguage - The configured output language
   * @returns Proposal phase instructions string with language reinforcement
   */
  buildProposalInstructions(guideLanguage?: GuideLanguage): string {
    const lang = guideLanguage ?? DEFAULT_GUIDE_LANGUAGE;
    const langInstruction = LANGUAGE_INSTRUCTIONS[lang];
    return PROPOSAL_PHASE_INSTRUCTIONS + `\nLANGUAGE ENFORCEMENT: ${langInstruction} This applies to the outline title, section titles, section descriptions, subsection titles, and subsection descriptions.`;
  }

  /**
   * Builds the system prompt addendum for the final generation phase.
   * Constructs detailed instructions based on the confirmed outline,
   * listing each confirmed section with its subsections and user notes.
   *
   * @param outline - The confirmed outline with user's selections applied
   * @param guideLanguage - The configured output language
   * @returns Final generation instructions string
   */
  buildFinalGenerationPrompt(outline: ProposedOutline, guideLanguage?: GuideLanguage): string {
    // Filter to only included sections
    const includedSections = outline.sections.filter((s) => s.included !== false);

    // Build section-specific instructions
    let sectionInstructions = `\nCONFIRMED OUTLINE - Generate content for these ${includedSections.length} sections:\n\n`;
    sectionInstructions += `**Document Title:** ${outline.title}\n`;
    sectionInstructions += `**Category:** ${outline.category}\n\n`;

    for (let i = 0; i < includedSections.length; i++) {
      const section = includedSections[i];
      sectionInstructions += `### Section ${i + 1}: ${section.title}\n`;
      sectionInstructions += `Description: ${section.description}\n`;

      if (section.subsections && section.subsections.length > 0) {
        sectionInstructions += `Subsections to cover:\n`;
        for (const sub of section.subsections) {
          sectionInstructions += `  - ${sub.title}: ${sub.description}\n`;
        }
      }

      if (section.notes) {
        sectionInstructions += `User Notes/Preferences: ${section.notes}\n`;
      }

      sectionInstructions += '\n';
    }

    const lang = guideLanguage ?? DEFAULT_GUIDE_LANGUAGE;
    const langInstruction = LANGUAGE_INSTRUCTIONS[lang];
    return FINAL_PHASE_INSTRUCTIONS + '\n' + sectionInstructions + `\nLANGUAGE ENFORCEMENT: ${langInstruction} All prose content (section titles, introductions, rationale, explanations) must follow this language. Code examples remain in English.`;
  }

  /**
   * Checks if the AI response contains a proposed outline.
   *
   * @param aiResponse - The AI response text
   * @returns True if the response appears to contain an outline
   */
  private hasProposedOutline(aiResponse: string): boolean {
    if (!aiResponse || aiResponse.trim().length < 50) {
      return false;
    }

    // Check for <outline> XML tags
    if (/<outline>[\s\S]{20,}<\/outline>/i.test(aiResponse)) {
      return true;
    }

    // Check for JSON with sections array in code block
    if (/```(?:json)?\s*\n?\s*\{[\s\S]*"sections"\s*:\s*\[[\s\S]*\]\s*[\s\S]*\}\s*\n?```/.test(aiResponse)) {
      return true;
    }

    return false;
  }

  /**
   * Validates and normalizes a parsed JSON object into a ProposedOutline.
   * Ensures all required fields exist and have correct types.
   *
   * @param parsed - The parsed JSON object
   * @returns Valid ProposedOutline or null if the structure is invalid
   */
  private validateAndNormalizeOutline(parsed: Record<string, unknown>): ProposedOutline | null {
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const category = typeof parsed.category === 'string' ? parsed.category.trim().toLowerCase() : 'general';
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];

    if (!title || sections.length === 0) {
      return null;
    }

    const normalizedSections: ProposedSection[] = [];

    for (const raw of sections) {
      if (!raw || typeof raw !== 'object') continue;

      const section = raw as Record<string, unknown>;
      const sectionId = typeof section.id === 'string' ? section.id : this.generateSectionId(section.title as string);
      const sectionTitle = typeof section.title === 'string' ? section.title : '';
      const sectionDesc = typeof section.description === 'string' ? section.description : '';

      if (!sectionTitle) continue;

      const subsections: ProposedSubsection[] = [];
      if (Array.isArray(section.subsections)) {
        for (const rawSub of section.subsections) {
          if (!rawSub || typeof rawSub !== 'object') continue;
          const sub = rawSub as Record<string, unknown>;
          const subId = typeof sub.id === 'string' ? sub.id : this.generateSectionId(sub.title as string);
          const subTitle = typeof sub.title === 'string' ? sub.title : '';
          const subDesc = typeof sub.description === 'string' ? sub.description : '';

          if (subTitle) {
            subsections.push({ id: subId, title: subTitle, description: subDesc });
          }
        }
      }

      normalizedSections.push({
        id: sectionId,
        title: sectionTitle,
        description: sectionDesc,
        subsections,
        included: section.included !== false, // Default to true
        notes: typeof section.notes === 'string' ? section.notes : undefined,
      });
    }

    if (normalizedSections.length === 0) {
      return null;
    }

    return { title, category, sections: normalizedSections };
  }

  /**
   * Parses markdown headers from the AI response to build a rough outline.
   * Used as a fallback when the AI doesn't output in the expected JSON format.
   *
   * @param aiResponse - The AI response text
   * @returns ProposedOutline built from headers, or null if not enough structure found
   */
  private parseOutlineFromMarkdown(aiResponse: string): ProposedOutline | null {
    const lines = aiResponse.split('\n');
    const sections: ProposedSection[] = [];
    let title = '';
    let currentSection: ProposedSection | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // H1 = document title
      const h1Match = trimmed.match(/^#\s+(.+)$/);
      if (h1Match && !title) {
        title = h1Match[1].replace(/[*`]/g, '').trim();
        continue;
      }

      // H2 = section
      const h2Match = trimmed.match(/^##\s+(.+)$/);
      if (h2Match) {
        if (currentSection) {
          sections.push(currentSection);
        }
        const sectionTitle = h2Match[1].replace(/[*`]/g, '').trim();
        currentSection = {
          id: this.generateSectionId(sectionTitle),
          title: sectionTitle,
          description: '',
          subsections: [],
          included: true,
        };
        continue;
      }

      // H3 = subsection
      const h3Match = trimmed.match(/^###\s+(.+)$/);
      if (h3Match && currentSection) {
        const subTitle = h3Match[1].replace(/[*`]/g, '').trim();
        currentSection.subsections.push({
          id: this.generateSectionId(subTitle),
          title: subTitle,
          description: '',
        });
        continue;
      }

      // Non-header line after a section header = description
      if (currentSection && trimmed.length > 0 && !currentSection.description) {
        currentSection.description = trimmed.substring(0, 200);
      }
    }

    // Push last section
    if (currentSection) {
      sections.push(currentSection);
    }

    // Need at least 3 sections to consider it a valid outline
    if (sections.length < 3 || !title) {
      return null;
    }

    return {
      title,
      category: 'general',
      sections,
    };
  }

  /**
   * Generates a kebab-case section ID from a title string.
   *
   * @param title - The section title
   * @returns Kebab-case ID
   */
  private generateSectionId(title: string): string {
    if (!title) return `section-${Date.now()}`;
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
      .replace(/^-|-$/g, '');
  }

  // =============================================================================
  // STANDARD METHODS
  // =============================================================================

  /**
   * Checks if the AI response contains generated content that could be saved.
   * Primarily checks for <style-guide> XML tags, with fallbacks for compatibility.
   *
   * @param aiResponse - The AI response text
   * @returns True if content appears to be generated guide content
   */
  private hasGeneratedContent(aiResponse: string): boolean {
    if (!aiResponse || aiResponse.trim().length < 50) {
      return false;
    }

    // PRIMARY: Check for <style-guide> XML tags
    if (/<style-guide>[\s\S]{50,}<\/style-guide>/i.test(aiResponse)) {
      return true;
    }

    // FALLBACK: Check for specific markers indicating generated content (case insensitive)
    const markers = [
      'conteudo gerado',
      'generated content',
      'novo guia',
      'new guide',
      'conteudo atualizado',
      'updated content',
      'guia modificado',
      'modified guide',
      'style guide gerado',
    ];

    const lowerResponse = aiResponse.toLowerCase();
    if (markers.some((marker) => lowerResponse.includes(marker))) {
      return true;
    }

    // FALLBACK: Check for structured guide content (starts with a h1 header and is substantial)
    // This helps detect when AI generates content without explicit markers
    if (/^# .+[\r\n]+[\s\S]{100,}/m.test(aiResponse)) {
      return true;
    }

    // FALLBACK: Check if response has multiple headers (likely a style guide structure)
    const headerCount = (aiResponse.match(/^#{1,3}\s+.+$/gm) || []).length;
    if (headerCount >= 3 && aiResponse.length > 300) {
      return true;
    }

    return false;
  }

  /**
   * Truncates content to a maximum length, preserving word boundaries.
   *
   * @param content - Content to truncate
   * @param maxLength - Maximum character length
   * @returns Truncated content with ellipsis if truncated
   */
  private truncateContent(content: string, maxLength: number): string {
    if (!content || content.length <= maxLength) {
      return content;
    }

    // Find the last space before maxLength to avoid cutting words
    const truncated = content.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Default action instructions (hardcoded fallbacks)
   * Used when no custom instructions are configured in the database
   */
  private static readonly DEFAULT_ACTION_INSTRUCTIONS: Record<ChatAction, string> = {
    query: 'Answer the question based on the available style guides. Provide specific references to relevant sections and rules. If the question spans multiple guides, synthesize the information coherently.',
    suggest: 'Suggest improvements for the existing style guides. List each suggestion with: (1) the current gap or issue, (2) the proposed improvement with rationale, (3) a concrete example of the improved rule or pattern. Prioritize suggestions by impact.',
    generate: 'Generate new style guide content using the two-phase workflow. In the PROPOSAL phase, generate a comprehensive structured outline with 8-15 sections for the user to review. In the FINAL phase, generate exhaustive, production-quality content for each confirmed section. REQUIRED: In proposal phase, wrap the outline in <outline>...</outline> XML tags. In final phase, wrap the generated content in <style-guide>...</style-guide> XML tags. DO NOT use markdown code blocks to wrap the guide. Every rule must include rationale, correct/incorrect code examples, edge cases, and cross-references.',
    modify: 'Modify the style guide as requested while maintaining consistency with existing conventions and depth standards. When modifying, preserve the existing structure and enhance the changed sections to match the quality level of the rest of the guide. REQUIRED: Wrap the modified content with XML tags <style-guide>...</style-guide>. DO NOT use markdown code blocks to wrap the guide.',
  };

  /**
   * Builds the action-specific instructions to append to the user message.
   * Supports custom instructions from configuration when available.
   *
   * @param action - The requested action type
   * @param targetGuideId - Optional target guide ID for modify action
   * @param actionQueries - Optional custom action instructions from configuration
   * @returns Action-specific instructions string
   */
  buildActionInstructions(
    action: ChatAction,
    targetGuideId?: string,
    actionQueries?: Partial<Record<ChatAction, ActionQueryConfig>>
  ): string {
    // Check if custom instructions are available and enabled for this action
    const customConfig = actionQueries?.[action];
    let instructions: string;

    if (customConfig && customConfig.enabled && customConfig.instructions.trim().length > 0) {
      // Use custom instructions from configuration
      instructions = customConfig.instructions;
      console.log(`[${OPERATION}] Using custom instructions for action: ${action}`);
    } else {
      // Fall back to default hardcoded instructions
      instructions = StyleGuideChatService.DEFAULT_ACTION_INSTRUCTIONS[action];
      console.log(`[${OPERATION}] Using default instructions for action: ${action}`);
    }

    // Build the action tag with instructions
    const actionTag = action.toUpperCase();
    const targetInfo = action === 'modify' && targetGuideId ? ` - Target Guide ID: ${targetGuideId}` : '';

    return `\n\n[ACTION: ${actionTag}${targetInfo}] - ${instructions}`;
  }
}
