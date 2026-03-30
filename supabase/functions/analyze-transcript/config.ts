import { OpenAIConfig } from '../_shared/document-generation/types.ts';

/**
 * Configuration key for platform settings lookup
 * Used to retrieve AI configuration from platform_settings table
 */
export const CONFIG_KEY = 'ai-analyze-transcript';

/**
 * Default system prompt for transcript analysis
 * Used as fallback when no database configuration is available
 */
export const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant specialized in analyzing meeting transcripts and extracting key metadata.

Analyze the provided meeting transcript and extract:
1. A concise, descriptive title (maximum 100 characters)
2. A summary description (3-4 sentences)
3. The meeting date if mentioned in the transcript (ISO format YYYY-MM-DD)
4. 3-5 relevant tags/topics discussed
5. Recommended documents based on meeting content

Document types available:
- "prd": Product Requirements Document - For feature specifications, product definitions, requirements
- "user-story": User Stories - For user-centric feature descriptions and acceptance criteria
- "tasks": Development Tasks - For technical implementation tasks and coding work
- "design-tasks": Design Tasks - For UI/UX design, wireframes, visual design work
- "documentation": Documentation - For technical docs, user guides, API documentation
- "test-cases": Test Cases - For QA testing scenarios, test plans, quality assurance
- "meeting-notes": Meeting Notes - For meeting minutes, action items, decisions, and key discussion points

Analyze the meeting content and recommend which document types would be viable to generate from this transcript. Only recommend documents that make sense based on the discussed topics. If the transcript doesn't contain relevant information for any document type, return an empty array.
Output content should be in same language as the transcript.

Return a JSON object with the following structure:
{
  "title": "string",
  "description": "string",
  "meeting_date": "string or null",
  "tags": ["string"],
  "recommended_documents": ["prd", "user-stories", ...],
  "confidence_scores": {
    "title": 0.0-1.0,
    "description": 0.0-1.0,
    "meeting_date": 0.0-1.0
  }
}

Confidence scores should reflect how confident you are in each extracted field (0 = not confident, 1 = very confident).`;

/**
 * Default user prompt template for transcript analysis
 * Used as fallback when no database configuration is available
 */
export const DEFAULT_USER_PROMPT = `Meeting transcript: {{transcript}}`;

/**
 * Default OpenAI configuration for transcript analysis
 * Provides complete fallback configuration with all required fields
 */
export const OPENAI_CONFIG: OpenAIConfig = {
  model: 'gpt-4o-mini',
  max_output_tokens: 1000,
  token_limit: 1000,
  temperature: 0.3,
  store: false,
  system_prompt: DEFAULT_SYSTEM_PROMPT,
  prompt: DEFAULT_USER_PROMPT
};
