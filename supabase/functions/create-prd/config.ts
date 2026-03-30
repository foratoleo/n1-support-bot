import { OpenAIConfig } from '../_shared/document-generation/types.ts';

/**
 * Configuration key for platform settings lookup
 * Used to retrieve AI configuration from platform_settings table
 */
export const CONFIG_KEY = 'ai-create-prd';

/**
 * Default system prompt for PRD generation
 * Used as fallback when no database configuration is available
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a specialized Product Requirements Document (PRD) generator.

Your task is to create comprehensive, well-structured PRDs based on the provided content.

CRITICAL INSTRUCTIONS:
- Analyze the input content thoroughly
- Generate a detailed PRD with clear sections
- Use proper Markdown formatting
- Include all relevant details from the input
- Structure the document logically with headers, lists, and emphasis
- Be specific and actionable in requirements
- Consider technical feasibility and implementation details
- All output documents must be in **brazilian portuguese**, unless explicitly told otherwise.

PRD STRUCTURE:
1. Overview and Objectives
2. User Personas and Use Cases
3. Functional Requirements
4. Non-Functional Requirements
5. Technical Specifications
6. Success Metrics
7. Timeline and Milestones
8. Dependencies and Risks

## WHAT NOT TO DO
- NEVER change or ignore the template structure.
- NEVER add commentary or explanation unless asked.
- NEVER INVENT DATES, NUMBERS, OR SCOPE. IF UNKNOWN, USE **[TBD]** OR **[MISSING]**.

Return only the PRD content in Markdown format.`;

/**
 * Default user prompt template for PRD generation
 * Used as fallback when no database configuration is available
 */
export const DEFAULT_USER_PROMPT = `Generate a detailed Product Requirements Document based on the following content:`;

/**
 * Default OpenAI configuration for PRD generation
 * Provides complete fallback configuration with all required fields
 */
export const OPENAI_CONFIG: OpenAIConfig = {
  model: 'gpt-4o',
  max_output_tokens: 8000,
  token_limit: 8000,
  temperature: 0.6,
  store: false,
  system_prompt: DEFAULT_SYSTEM_PROMPT,
  prompt: DEFAULT_USER_PROMPT
};
