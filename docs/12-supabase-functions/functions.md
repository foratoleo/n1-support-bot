---
name: supabase-functions
description: Deno Edge Functions, shared utilities, error handling, deployment
area: 12
maintained_by: functions-documenter
created: 2026-03-30
updated: 2026-03-30
---

# Supabase Edge Functions Infrastructure

Supabase Edge Functions provide a serverless runtime for executing TypeScript code in a Deno environment. This document covers the architecture, shared utilities, error handling patterns, and deployment procedures for all document generation functions in this project.

## Runtime Environment

### Deno-Based Serverless

All Edge Functions run on Deno, a modern JavaScript/TypeScript runtime built with Rust. The functions use Deno standard library imports and are deployed to Supabase's Edge Functions infrastructure.

**Key Runtime Characteristics:**

- Runtime: Deno 1.x
- Import format: URL-based imports (ESM modules via `https://deno.land/`, `https://esm.sh/`)
- Execution: Isolated serverless environment per request
- Timeout: Configurable per function (default varies by function type)
- Memory: Shared quota across function invocations

**Sample imports from a document generation function:**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { OpenAI } from 'npm:openai';
```

### Function Entry Pattern

All document generation functions follow a consistent entry pattern:

```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    // Validate request method
    const methodValidation = validateMethod(req.method);
    if (!methodValidation.valid) {
      const errorData = formatErrorResponse(methodValidation.error!);
      const statusCode = getErrorStatusCode(methodValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Parse and validate request body
    const body: RequestBody = await req.json();
    const bodyValidation = validateRequestBody(body);
    if (!bodyValidation.valid) {
      const errorData = formatErrorResponse(bodyValidation.error!);
      const statusCode = getErrorStatusCode(bodyValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Process document generation
    // ...

    const successData = formatSuccessResponse(document, responseId, storedDocument?.id);
    return createResponse(successData, 200);
  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);
    const errorData = formatErrorResponse(error);
    const statusCode = getErrorStatusCode(error);
    return createResponse(errorData, statusCode);
  }
});
```

## Shared Utilities: `_shared/document-generation/`

The `_shared/document-generation/` directory contains centralized utilities used by all document generation functions. This shared approach reduces code duplication and ensures consistent behavior across functions.

### Directory Structure

```
supabase/functions/_shared/document-generation/
  types.ts               -- Type definitions (RequestBody, ResponseData, OpenAIConfig)
  validation.ts          -- Request validation functions
  response-builder.ts    -- HTTP response formatting with CORS
  openai-service.ts      -- OpenAI API client wrapper
  openai-helper.ts       -- Response parsing and message building
  token-extractor.ts     -- Token usage and metadata extraction
  ai-interaction-service.ts  -- AI interaction lifecycle management
  generated-document-service.ts -- Document storage with metadata
  prompt-builder.ts      -- Prompt assembly with placeholder replacement
```

### Types (`types.ts`)

Core type definitions for all document generation functions.

**RequestBody:**

```typescript
interface RequestBody {
  content: string;              // Input content for generation
  project_id: string;           // Project context identifier
  user_id?: string;             // Optional user identifier
  system_prompt?: string;       // Optional custom system prompt override
  user_prompt?: string;         // Optional custom user prompt override
  previous_response_id?: string; // For conversation continuity
  model?: string;               // Optional model override
  temperature?: number;          // Optional temperature override
  token_limit?: number;         // Optional token limit override
  meeting_transcript_id?: string; // Optional transcript reference
}
```

**ResponseData:**

```typescript
interface ResponseData {
  success: boolean;
  document?: string;            // Generated document content (Markdown)
  response_id?: string;         // OpenAI response ID for tracking
  document_id?: string;         // Stored document ID
  document_name?: string;       // Stored document name
  ai_interaction_id?: string;   // Interaction tracking ID
  error?: string;               // Error message if failed
}
```

**OpenAIConfig:**

```typescript
interface OpenAIConfig {
  model: string;                // e.g., 'gpt-4o', 'gpt-4o-mini'
  max_output_tokens: number;    // Maximum response length (100-20000)
  temperature: number;          // Randomness level (0.0-2.0)
  store: boolean;                // Whether to store conversation
  system_prompt?: string;        // AI role definition
  prompt?: string;              // User-facing template with {{content}} placeholder
  token_limit?: number;         // Internal field mapped to max_output_tokens
}
```

**DocumentTypeKey:** A union type covering all 51 supported document types across four categories: Generated Documents (10 types: tasks, features, prd, test-cases, user-story, meeting-notes, unit-tests, specs, accessibility-test-result, performance-test-result), Planning Documents (24 types), Development Documents (6 types), and Governance Documents (11 types).

### Validation (`validation.ts`)

Request validation with structured error messages.

```typescript
export function validateRequestBody(body: RequestBody): ValidationResult {
  if (!body.content?.trim()) {
    return { valid: false, error: 'Content is required' };
  }

  if (!body.project_id?.trim()) {
    return { valid: false, error: 'Project ID is required' };
  }

  return { valid: true };
}

export function validateMethod(method: string): ValidationResult {
  if (method !== 'POST') {
    return { valid: false, error: 'Method not allowed' };
  }

  return { valid: true };
}
```

### Response Builder (`response-builder.ts`)

Standardized HTTP responses with CORS headers and error mapping.

**Success Response:**

```typescript
export function formatSuccessResponse(
  document: string,
  responseId: string,
  documentId?: string,
  documentName?: string,
  aiInteractionId?: string
): ResponseData {
  return {
    success: true,
    document,
    response_id: responseId,
    document_id: documentId,
    document_name: documentName,
    ai_interaction_id: aiInteractionId
  };
}
```

**Error Response:**

```typescript
export function formatErrorResponse(error: Error | string): ResponseData {
  return {
    success: false,
    error: error instanceof Error ? error.message : error
  };
}
```

**CORS Headers:**

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

### OpenAI Service (`openai-service.ts`)

Wrapper around the OpenAI Responses API with automatic metadata injection.

```typescript
export class OpenAIService {
  private client: OpenAI;
  private operation: string;

  async generateDocument(
    input: InputMsg[],
    projectId: string,
    previousResponseId?: string,
    config?: Partial<OpenAIConfig>
  ): Promise<any> {
    const requestPayload = {
      model: config.model!,
      input,
      previous_response_id: previousResponseId || undefined,
      max_output_tokens: config.max_output_tokens!,
      temperature: config.temperature!,
      store: config.store!,
      metadata: {
        project_id: projectId,
        operation: this.operation
      }
    };

    const response = await this.client.responses.create(requestPayload);
    return response;
  }
}
```

### OpenAI Helper (`openai-helper.ts`)

Response parsing utilities for extracting content and building input messages.

**Code Fence Cleaning:**

```typescript
export function cleanCodeFences(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove leading code fences (```markdown, ```json at start)
  cleaned = cleaned.replace(/^```(?:markdown|json)?\n?/, '');

  // Remove trailing code fences (``` at end)
  cleaned = cleaned.replace(/\n?```\s*$/, '');

  return cleaned.trim();
}
```

**Output Extraction:**

```typescript
export function extractOutputText(resp: any): string {
  const rawText = extractRawOutputText(resp);
  return cleanCodeFences(rawText);
}

export function extractRawOutputText(resp: any): string {
  let text = '';

  if (resp?.output_text) {
    text = String(resp.output_text);
  } else {
    const texts: string[] = [];
    const items = resp?.output ?? resp?.content ?? [];

    for (const item of items) {
      if (Array.isArray(item?.content)) {
        for (const contentItem of item.content) {
          if (typeof contentItem?.text === 'string') {
            texts.push(contentItem.text);
          }
        }
      } else if (typeof item?.text === 'string') {
        texts.push(item.text);
      }
    }

    text = texts.join('\n').trim();
  }

  return text;
}
```

**Input Message Building:**

```typescript
export function buildInputMessages(
  systemPrompt: string,
  userPrompt: string,
  content: string
): InputMsg[] {
  return [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    { role: 'user', content: [{ type: 'input_text', text: `${userPrompt}\n\n${content}` }] }
  ];
}
```

### Prompt Builder (`prompt-builder.ts`)

Prompt assembly with configuration precedence: `request > database > default`.

```typescript
export function buildPrompts(
  content: string,
  defaultSystemPrompt: string,
  defaultUserPrompt: string,
  dbConfig: { system_prompt?: string; prompt?: string },
  requestOverrides: { system_prompt?: string; user_prompt?: string },
  logPrefix = ''
): PromptResult {
  const finalSystemPrompt =
    requestOverrides.system_prompt || dbConfig.system_prompt || defaultSystemPrompt;
  const finalUserPrompt =
    requestOverrides.user_prompt || dbConfig.prompt || defaultUserPrompt;

  const processedUserPrompt = replacePromptPlaceholders(finalUserPrompt, content);

  return {
    systemPrompt: finalSystemPrompt,
    userPrompt: processedUserPrompt,
    source: {
      system_prompt: requestOverrides.system_prompt ? 'request' :
                     (dbConfig.system_prompt ? 'database' : 'default'),
      user_prompt: requestOverrides.user_prompt ? 'request' :
                    (dbConfig.prompt ? 'database' : 'default'),
    }
  };
}
```

### AI Interaction Service (`ai-interaction-service.ts`)

Manages the complete lifecycle of AI interaction records in the `ai_interactions` table: `pending -> in_progress -> completed/failed`.

**Lifecycle Methods:**

```typescript
// 1. Create pending record
async createInteraction(params: AIInteractionParams): Promise<string>

// 2. Mark as in-progress
async updateInteractionInProgress(interactionId: string): Promise<void>

// 3. Complete with response data and token usage
async completeInteraction(
  interactionId: string,
  response: any,
  document: string,
  startTime: number
): Promise<void>

// 4. Mark as failed with error details
async failInteraction(
  interactionId: string,
  error: Error,
  startTime: number
): Promise<void>
```

### Generated Document Service (`generated-document-service.ts`)

Stores documents with automatic metadata calculation.

**Stored Metadata:**

- `word_count`: Extracted by removing markdown syntax and splitting on whitespace
- `section_count`: Count of markdown headers (lines matching `/^#{1,6}\s+.+$/gm`)
- `estimated_reading_time`: Calculated at 200 words per minute
- `content_format`: Detected as `json` or `markdown` based on content structure

**Document Name Resolution Priority:**

1. Explicitly provided in params
2. Extracted from first H1 heading (`# Title`) in markdown content
3. Generated as `{DocumentType} - {YYYY-MM-DD}` format

## Error Handling and i18n Mapping

### Error Code Mapping

The `getErrorStatusCode` function maps error messages to appropriate HTTP status codes.

| Error Pattern | HTTP Status | Condition |
|---------------|-------------|-----------|
| `Method not allowed` | 405 | Non-POST methods |
| `required` in message | 400 | Missing required fields (content, project_id) |
| `status` property in error object | Use error.status | OpenAI API errors with status codes |
| Default | 500 | All other errors |

```typescript
export function getErrorStatusCode(error: Error | string): number {
  const errorMessage = error instanceof Error ? error.message : error;

  if (errorMessage.includes('Method not allowed')) {
    return 405;
  }

  if (errorMessage.includes('required')) {
    return 400;
  }

  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return 500;
}
```

### i18n Error Categories

Error messages are grouped into the following categories for frontend mapping:

| Category | Cause | Frontend Translation Key Pattern |
|----------|-------|----------------------------------|
| Authentication | `OPENAI_API_KEY` not configured | `error.auth.configuration` |
| Rate Limiting | OpenAI API throttling | `error.api.rate_limit` |
| Validation | Missing or invalid request fields | `error.validation.{field}` |
| Generation | Document generation failure | `error.generation.failed` |
| Storage | Database insert failure | `error.storage.failed` |

**Error Response Structure:**

```typescript
{
  success: false,
  error: "API key not configured"  // Raw error for debugging
}
```

The frontend maps these error strings to localized messages using the `useI18n` hook with keys from `src/locales/pt-br.ts` and `src/locales/en-us.ts`.

### Graceful Degradation

The `PlatformSettingsService` implements graceful degradation for configuration retrieval:

- Database errors: Logged and return `null` (fallback to defaults)
- Not found: Return `null` without logging (expected case)
- Invalid structure: Logged and return `null`
- Validation failure: Logged and return `null`

```typescript
async getAIConfiguration(key: AIConfigurationKey): Promise<AIConfiguration | null> {
  try {
    const { data, error } = await this.supabase
      .from('platform_settings')
      .select('*')
      .eq('section', 'ai')
      .eq('key', key)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found - expected case
      }
      console.error('[PlatformSettingsService] Database query error:', error);
      return null; // Database error - graceful degradation
    }

    if (!validateAIConfiguration(jsonValue)) {
      return null; // Invalid structure - graceful degradation
    }

    return jsonValue;
  } catch (error) {
    return null; // Unexpected error - graceful degradation
  }
}
```

## Retry Logic with Exponential Backoff

The current implementation relies on Supabase's built-in retry mechanism for transient failures. Document generation functions do not implement custom retry logic at the application level, relying instead on:

1. **Supabase Platform Retries:** Automatic retry for network-level transient failures
2. **OpenAI Responses API Retries:** The SDK handles rate limit responses with backoff
3. **Frontend Retry UI:** Users can re-attempt failed requests through the client interface

For future implementation, a pattern for exponential backoff would be:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) break;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

## OpenAI API Key Management

### Environment Variable Configuration

API keys are stored as Supabase secrets and injected as environment variables at runtime.

**Required Environment Variable:**

```typescript
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
```

**Secrets Configuration (Supabase Dashboard):**

1. Navigate to Project > Edge Functions > Secrets
2. Add `OPENAI_API_KEY` with the value `sk-...`
3. Secrets are encrypted at rest and injected into the runtime environment

### Supabase Client Authentication

The shared Supabase client uses the service role key for full database access, bypassing Row Level Security (RLS) policies.

```typescript
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
```

**Singleton Pattern:** The client uses a singleton to avoid repeated initialization overhead across function invocations.

## Configuration Management

### Configuration Precedence

AI configuration is resolved with the following precedence order:

1. **Request Override** -- Values provided in the API request body
2. **Database Configuration** -- Values stored in `platform_settings` table (section = 'ai')
3. **Default Configuration** -- Hardcoded defaults in each function's `config.ts`

### Configuration Keys

The following configuration keys are defined in `_shared/platform-settings/types.ts`:

| Key | Purpose |
|-----|---------|
| `ai-create-prd` | Product Requirements Document generation |
| `ai-create-user-story` | User story generation |
| `ai-create-meeting-notes` | Meeting notes generation |
| `ai-create-technical-specs` | Technical specification generation |
| `ai-create-test-cases` | Test case generation |
| `ai-chat-style-guide` | Style guide chat processing |
| `ai-improve-writing` | Writing improvement |
| `ai-correct-spelling-grammar` | Spelling and grammar correction |
| `ai-format-organize` | Text formatting and organization |

### Per-Function Defaults

Each document generation function has a `config.ts` file defining its default configuration:

```typescript
// Example: create-prd/config.ts
export const CONFIG_KEY = 'ai-create-prd';

export const OPENAI_CONFIG: OpenAIConfig = {
  model: 'gpt-4o',
  max_output_tokens: 8000,
  token_limit: 8000,
  temperature: 0.6,
  store: false,
  system_prompt: DEFAULT_SYSTEM_PROMPT,
  prompt: DEFAULT_USER_PROMPT
};
```

## Deployment

### Deployment Commands

Deploy individual functions:

```bash
supabase functions deploy create-prd
supabase functions deploy create-user-story
supabase functions deploy create-meeting-notes
supabase functions deploy create-technical-specs
supabase functions deploy create-test-cases
supabase functions deploy create-unit-tests
supabase functions deploy analyze-transcript
```

Deploy all functions in a project:

```bash
supabase functions deploy --all
```

Deploy with secrets:

```bash
# Deploy and set secrets in one command
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase functions deploy create-prd
```

### Function URLs

After deployment, functions are accessible at:

```
https://{project-ref}.supabase.co/functions/v1/{function-name}
```

For example:
```
https://xyzabc.supabase.co/functions/v1/create-prd
```

### Secrets Deployment

Ensure secrets are set before deployment:

```bash
# List current secrets
supabase secrets list

# Set a new secret
supabase secrets set OPENAI_API_KEY=sk-your-key

# Unset a secret
supabase secrets unset OPENAI_API_KEY
```

### Deployment Verification

Verify deployment success by checking function logs:

```bash
supabase functions logs create-prd
```

Or by calling the function endpoint:

```bash
curl -X POST https://{project-ref}.supabase.co/functions/v1/create-prd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {anon-key}" \
  -d '{"content": "test", "project_id": "test-id"}'
```

## Local Development

### Starting the Local Functions Server

Run all Edge Functions locally:

```bash
supabase functions serve
```

Run with specific port:

```bash
supabase functions serve --port 54321
```

### Calling Local Functions

Functions are available at `http://localhost:54321/functions/v1/{function-name}`:

```bash
curl -X POST http://localhost:54321/functions/v1/create-prd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {anon-key}" \
  -d '{"content": "test content", "project_id": "test-project-id"}'
```

### Environment Variables for Local Development

Create a `.env` file or export variables:

```bash
# Required for local development
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export OPENAI_API_KEY=sk-your-openai-key

# Start the server
supabase functions serve
```

### Using the Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to a project
supabase link --project-ref {project-ref}

# Start local development
supabase dev

# Deploy after local testing
supabase functions deploy create-prd
```

### Debug Mode

Enable verbose logging during local development:

```bash
# Enable debug output
export DEBUG=supabase:functions
supabase functions serve
```

### Watching for Changes

During local development, restart the server when function code changes:

```bash
# Kill the existing server
pkill -f "supabase functions serve"

# Restart
supabase functions serve
```

## Document Generation Functions

The following functions use the shared document generation infrastructure:

| Function | Endpoint | Document Type |
|---------|----------|---------------|
| `create-prd` | `/functions/v1/create-prd` | PRD |
| `create-user-story` | `/functions/v1/create-user-story` | User Story |
| `create-meeting-notes` | `/functions/v1/create-meeting-notes` | Meeting Notes |
| `create-technical-specs` | `/functions/v1/create-technical-specs` | Technical Specs |
| `create-test-cases` | `/functions/v1/create-test-cases` | Test Cases |
| `create-unit-tests` | `/functions/v1/create-unit-tests` | Unit Tests |
| `analyze-transcript` | `/functions/v1/analyze-transcript` | Transcript Analysis |

### Common Request Format

All document generation functions accept the same request body structure:

```json
{
  "content": "string (required) - Input content for generation",
  "project_id": "string (required) - Project context identifier",
  "user_id": "string (optional) - User identifier",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt",
  "previous_response_id": "string (optional) - For conversation continuity",
  "model": "string (optional) - Model override (e.g., 'gpt-4o-mini')",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override token limit",
  "meeting_transcript_id": "string (optional) - Transcript reference"
}
```

### Common Response Format

```json
{
  "success": true,
  "document": "string - Generated document (Markdown)",
  "response_id": "string - OpenAI response ID",
  "document_id": "string - Stored document ID",
  "document_name": "string - Document name",
  "ai_interaction_id": "string - AI interaction tracking ID"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "string - Error message"
}
```

## Related Documentation

- [API Documentation](api-documentation.md) -- REST API endpoints and response formats
- [Database Schema](schema.md) -- Table structures for `ai_interactions`, `generated_documents`, `platform_settings`
- [Frontend Integration](../frontend/integration.md) -- Calling Edge Functions from the frontend client
