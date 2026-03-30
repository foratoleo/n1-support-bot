/**
 * Valid document type keys from the centralized type system
 * This is a type-only representation for Edge Functions (Deno runtime)
 *
 * Note: Since Edge Functions run in Deno, we cannot import from the frontend type system.
 * This type should match DocumentTypeKey from @/types/centralized-document-types.ts
 * If new document types are added, update this type accordingly.
 */
export type DocumentTypeKey =
  // Generated Documents (10 types)
  | 'tasks'
  | 'features'
  | 'prd'
  | 'test-cases'
  | 'user-story'
  | 'meeting-notes'
  | 'unit-tests'
  | 'specs'
  | 'accessibility-test-result'
  | 'performance-test-result'
  // Planning Documents (24 types)
  | 'requirements'
  | 'user-guides'
  | 'change-requirements'
  | 'functional-summary'
  | 'roadmap'
  | 'business-context'
  | 'company-goals'
  | 'retrospective'
  | 'okrs'
  | 'executive-business-review'
  | 'project-plan'
  | 'status-report'
  | '4ls-retrospective'
  | '5-whys-analysis'
  | '90-day-plan'
  | 'brainstorming'
  | 'competitive-analysis'
  | 'customer-journey-mapping'
  | 'design-systems'
  | 'marketing-plan'
  | 'persona'
  | 'project-charter'
  | 'project-kickoff'
  | 'risk-assessment-matrix'
  | 'statement-of-work'
  // Development Documents (6 types)
  | 'architecture'
  | 'technical-specs'
  | 'task-notes'
  | 'code-style-guide'
  | 'technical-summary'
  | 'integration-architecture'
  // Governance Documents (11 types)
  | 'compliance'
  | 'processes-workflows'
  | 'resources-tools'
  | 'compliance-legal'
  | 'team-organization'
  | 'technical-standards'
  | 'standard-operating-procedure'
  | 'strategic-plan';

export interface RequestBody {
  content: string;
  project_id: string;
  user_id?: string;
  system_prompt?: string;
  user_prompt?: string;
  previous_response_id?: string;
  model?: string;
  temperature?: number;
  token_limit?: number;
  meeting_transcript_id?: string;
}

/**
 * Supported programming languages for unit test generation
 */
export const SUPPORTED_LANGUAGES = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript',
  PYTHON: 'python',
  JAVA: 'java',
} as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[keyof typeof SUPPORTED_LANGUAGES];

/**
 * Framework options mapped by language
 */
export const FRAMEWORK_OPTIONS = {
  [SUPPORTED_LANGUAGES.JAVASCRIPT]: ['Jest', 'Mocha', 'Jasmine', 'AVA'] as const,
  [SUPPORTED_LANGUAGES.TYPESCRIPT]: ['Jest', 'Vitest', 'Mocha', 'Jasmine'] as const,
  [SUPPORTED_LANGUAGES.PYTHON]: ['pytest', 'unittest', 'nose2', 'doctest'] as const,
  [SUPPORTED_LANGUAGES.JAVA]: ['JUnit', 'TestNG', 'Mockito', 'Spock'] as const,
} as const;

export type FrameworkOption<T extends SupportedLanguage> =
  typeof FRAMEWORK_OPTIONS[T][number];

/**
 * Test scenario for unit test generation
 */
export interface TestScenario {
  description: string;
  input?: string;
  expectedOutput?: string;
  shouldThrow?: boolean;
  errorMessage?: string;
}

/**
 * Unit test generation request data
 */
export interface UnitTestFormData {
  language: SupportedLanguage;
  framework: string;
  functionName: string;
  functionCode?: string;
  testScenarios: TestScenario[];
  additionalContext?: string;
}

/**
 * Extended request body for unit test generation
 * Uses centralized DocumentTypeKey for type safety
 */
export interface UnitTestRequestBody extends RequestBody {
  // Content field contains JSON-stringified UnitTestFormData
  content: string;
  document_type?: Extract<DocumentTypeKey, 'unit-tests'>;
  meeting_transcript_id?: string;
}

export interface ResponseData {
  success: boolean;
  document?: string;
  response_id?: string;
  document_id?: string;
  document_name?: string;
  ai_interaction_id?: string;
  error?: string;
}

/**
 * OpenAI configuration interface for document generation
 *
 * @property model - OpenAI model identifier (e.g., 'gpt-4o', 'gpt-4o-mini')
 * @property max_output_tokens - Maximum response length in tokens (range: 100-20000)
 * @property temperature - Randomness/creativity level (range: 0.0-2.0, lower = more deterministic)
 * @property store - Whether to store the conversation for continuity
 * @property system_prompt - Optional AI role definition and behavior instructions
 * @property prompt - Optional user-facing template with {{content}} placeholder for dynamic content injection
 * @property token_limit - Internal field mapped to max_output_tokens (for database compatibility)
 */
export interface OpenAIConfig {
  model: string;
  max_output_tokens: number;
  temperature: number;
  store: boolean;
  system_prompt?: string;
  prompt?: string;
  token_limit?: number;
}

/**
 * Type alias for cross-compatibility with AI configuration naming conventions
 */
export type AIConfiguration = OpenAIConfig;

/**
 * Defines the source of configuration values for precedence resolution
 */
export type ConfigurationSource = 'database' | 'request' | 'default';

/**
 * Merges multiple configuration sources following precedence rules:
 * request > database > default
 *
 * @param dbConfig - Configuration from database (partial)
 * @param requestConfig - Configuration from API request (partial)
 * @param defaultConfig - Default fallback configuration (complete)
 * @returns Merged configuration with proper precedence applied
 */
export function mergeConfigurations(
  dbConfig: Partial<AIConfiguration>,
  requestConfig: Partial<AIConfiguration>,
  defaultConfig: AIConfiguration
): AIConfiguration {
  // Apply precedence: request > database > default
  const merged = {
    ...defaultConfig,
    ...dbConfig,
    ...requestConfig,
  };

  // Map token_limit to max_output_tokens for OpenAI API
  if (merged.token_limit !== undefined) {
    merged.max_output_tokens = merged.token_limit;
  }

  return merged;
}

/**
 * Replaces placeholders in prompt templates with actual content
 * Supports {{content}} and {{transcript}} placeholders
 *
 * @param prompt - Prompt template containing placeholders
 * @param content - User content to inject into the template
 * @returns Processed prompt with placeholders replaced
 */
export function replacePromptPlaceholders(prompt: string, content: string): string {
  return prompt
    .replace(/\{\{content\}\}/g, content)
    .replace(/\{\{transcript\}\}/g, content);
}

export type InputMsg = {
  role: 'system' | 'user';
  content: { type: 'input_text'; text: string }[];
};

/**
 * Parameters for creating an AI interaction record
 */
export interface AIInteractionParams {
  project_id: string;
  request_prompt: string;
  request_model: string;
  request_parameters: any;
  previous_interaction_id?: string;
  meeting_transcript_id?: string;
}

/**
 * Token usage data from OpenAI response
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Metadata extracted from OpenAI response
 */
export interface InteractionMetadata {
  conversation_id: string | null;
  model: string | null;
  created: number | null;
  object: string | null;
}

/**
 * Parameters for storing a generated document
 * Uses centralized DocumentTypeKey for type safety
 *
 * @remarks
 * The document_type field now uses DocumentTypeKey for compile-time type checking.
 * This ensures only valid document types from the centralized system can be stored.
 */
export interface StoreDocumentParams {
  content: string;
  document_type: DocumentTypeKey;
  document_name?: string;
  project_id: string;
  user_id?: string;
  ai_interaction_id: string;
  meeting_transcript_id?: string;
  sprint_id?: string;
}

/**
 * Document metadata calculated from content
 */
export interface DocumentMetadata {
  word_count: number;
  section_count: number;
  estimated_reading_time: number;
}
