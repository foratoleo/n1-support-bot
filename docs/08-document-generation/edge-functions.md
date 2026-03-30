---
name: document-generation-edge-functions
description: Document generation v2.0 - Edge Functions, OpenAI integration, document types
area: 08
maintained_by: docgen-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Document Generation - Edge Functions (v2.0)

## Overview

The document generation system has been fully migrated from a frontend-centric v1.0 architecture to a server-side v2.0 architecture powered by Supabase Edge Functions. All AI-powered document creation now runs in Deno-based Edge Functions, keeping the OpenAI API key server-side, enabling automatic token usage tracking, and providing centralized error handling.

This section documents the complete Edge Function layer, including the shared infrastructure that all document generators use, the individual function implementations, the frontend service that invokes them, and the type definitions that ensure type safety across the stack.

## Architecture

### System Overview

```
+------------------------+      +----------------------------------+
|      Frontend React    |      |    Supabase Edge Functions       |
|                        |      |        (Deno Runtime)            |
|  generateDocumentAPI() |      |                                  |
|  generateUnitTests()   |      |  create-prd/                    |
|  generateBacklogItem() |---->|  create-user-story/              |
|  generateTasksAPI()     |      |  create-meeting-notes/          |
|  analyzeSprintAPI()    |      |  create-technical-specs/       |
+------------------------+      |  create-test-cases/             |
                               |  create-unit-tests/              |
                               |  create-backlog-items/           |
                               |  suggest-backlog-item/           |
                               |  analyze-transcript/             |
                               |  analyze-sprint/                 |
                               |                                  |
                               |  _shared/document-generation/     |
                               |    openai-service.ts              |
                               |    ai-interaction-service.ts      |
                               |    generated-document-service.ts  |
                               |    prompt-builder.ts              |
                               |    response-builder.ts            |
                               |    validation.ts                  |
                               |    types.ts                       |
                               +----------------------------------+
                                          |
                                          v
                               +-----------------------+
                               |    OpenAI API         |
                               |  (Responses API)      |
                               +-----------------------+
                                          |
                                          v
                               +-----------------------+
                               |    Supabase DB        |
                               |  ai_interactions      |
                               |  generated_documents  |
                               +-----------------------+
```

### Request/Response Flow

```
Frontend Request
      |
      |  supabase.functions.invoke('create-prd', { body: EdgeFunctionRequest })
      v
Edge Function Handler (serve())
      |
      |  1. validateMethod()      - Check HTTP method
      |  2. validateRequestBody()- Validate required fields
      |  3. loadConfiguration()  - Merge DB config, request overrides, defaults
      |  4. buildPrompts()       - Assemble system and user prompts
      v
AIInteractionService.createInteraction()
      |  Insert pending record to ai_interactions table
      v
AIInteractionService.updateInteractionInProgress()
      |  Set status = 'in_progress', started_at = now
      v
OpenAIService.generateDocument()
      |  POST to OpenAI Responses API with model, max_output_tokens, temperature
      v
extractOutputText()
      |  Parse response.output_text, clean code fences
      v
AIInteractionService.completeInteraction()
      |  Record token_usage, duration_ms, response_metadata
      v
GeneratedDocumentService.storeDocument()
      |  Calculate word_count, section_count, reading time
      |  Insert to generated_documents table
      v
Response to Frontend (EdgeFunctionResponse)
```

### Shared Infrastructure (`_shared/document-generation/`)

The `_shared/document-generation/` directory contains all common code reused by every document generation function. This ensures consistent behavior across all document types and eliminates duplication.

| File | Responsibility |
|------|---------------|
| `openai-service.ts` | Wraps OpenAI Responses API calls with retry logic and error mapping |
| `ai-interaction-service.ts` | Manages lifecycle of records in `ai_interactions` table |
| `generated-document-service.ts` | Stores generated content to `generated_documents`, calculates metadata |
| `prompt-builder.ts` | Assembles system and user prompts with placeholder injection |
| `response-builder.ts` | Constructs HTTP responses with CORS headers and status codes |
| `openai-helper.ts` | Extracts text from OpenAI response objects, builds input message arrays |
| `validation.ts` | Validates HTTP method and request body structure |
| `token-extractor.ts` | Extracts token usage statistics from OpenAI response metadata |
| `types.ts` | Shared TypeScript interfaces: `RequestBody`, `ResponseData`, `OpenAIConfig`, `DocumentTypeKey` |

## Migration: v1.0 to v2.0

### What Changed

The v1.0 architecture called OpenAI directly from the React frontend. The `generateDocumentsWithOpenAI()` function in `src/lib/openai.ts` accepted an API key (either from the environment or user settings) and made requests directly from the browser. Token usage had to be tracked manually in the frontend after the response arrived.

v2.0 removes all frontend OpenAI calls. The Edge Functions act as a secure proxy. The API key is stored as a Supabase secret (`OPENAI_API_KEY`) and is never exposed to the client. Every generation creates an `ai_interactions` record automatically, and the generated document is stored in `generated_documents` with computed metadata.

### v1.0 (Deprecated)

```typescript
// DEPRECATED - Frontend OpenAI calls
import { generateDocumentsWithOpenAI } from '@/lib/openai';

const documents = await generateDocumentsWithOpenAI(
  transcript,
  prompt,
  documentTypes,
  project
);

// Manual token tracking required
const { data: aiInteraction } = await supabase
  .from('ai_interactions')
  .insert({ ... });
```

### v2.0 (Current)

```typescript
// CURRENT - All document generation through Edge Functions
import { generateDocumentAPI } from '@/lib/services/document-generation-service';

const result = await generateDocumentAPI(
  'user-story',
  transcriptContent,
  projectId,
  meetingTranscriptId,
  userId
);

if (result.success) {
  // Document already saved to generated_documents
  // Token usage already tracked in ai_interactions
  console.log(result.document);
}
```

### What Remains in src/lib/openai.ts

The file `src/lib/openai.ts` still exists and the `generateDocumentsWithOpenAI` function is still imported in a few places. According to the codebase comments, this function is reserved for **task creation workflows only** and should not be used for new document generation code. The frontend service layer (`document-generation-service.ts`) has taken over all document generation responsibilities.

## Edge Functions Reference

### create-prd

Generates a Product Requirements Document from meeting transcript content.

**Endpoint:** `/supabase/functions/create-prd`

**Operation constant:** `create-prd`

**Document type stored:** `prd`

**Request body fields used:**

| Field | Required | Description |
|-------|----------|-------------|
| `content` | Yes | Meeting transcript or description text |
| `project_id` | Yes | Project identifier for isolation |
| `meeting_transcript_id` | No | Link to source transcript |
| `user_id` | No | User performing the action |
| `system_prompt` | No | Override system prompt |
| `user_prompt` | No | Override user prompt template |
| `previous_response_id` | No | For multi-turn conversation continuity |
| `model` | No | Override OpenAI model |
| `temperature` | No | Override randomness (0.0-2.0) |
| `token_limit` | No | Override max output tokens |

### create-user-story

Generates user stories from meeting transcript content.

**Endpoint:** `/supabase/functions/create-user-story`

**Operation constant:** `create-user-story`

**Document type stored:** `user-story`

### create-meeting-notes

Generates structured meeting notes with action items and summaries.

**Endpoint:** `/supabase/functions/create-meeting-notes`

**Operation constant:** `create-meeting-notes`

**Document type stored:** `meeting-notes`

### create-technical-specs

Generates technical specification documents from meeting content.

**Endpoint:** `/supabase/functions/create-technical-specs`

**Operation constant:** `create-technical-specs`

**Document type stored:** `technical-specs`

### create-test-cases

Generates test case documents from requirements or feature descriptions.

**Endpoint:** `/supabase/functions/create-test-cases`

**Operation constant:** `create-test-cases`

**Document type stored:** `test-cases`

### create-unit-tests

Generates unit test code from function code and test scenarios. Accepts structured form data in the `content` field as a JSON string.

**Endpoint:** `/supabase/functions/create-unit-tests`

**Operation constant:** `create-unit-tests`

**Document type stored:** `unit-tests`

**Special request handling:** The `content` field contains a JSON-stringified `UnitTestFormData` object with `language`, `framework`, `functionName`, `functionCode`, `testScenarios`, and `additionalContext`.

**Supported languages:** JavaScript, TypeScript, Python, Java

**Supported frameworks per language:**

| Language | Frameworks |
|----------|------------|
| JavaScript | Jest, Mocha, Jasmine, AVA |
| TypeScript | Jest, Vitest, Mocha, Jasmine |
| Python | pytest, unittest, nose2, doctest |
| Java | JUnit, TestNG, Mockito, Spock |

## Request and Response Formats

### Request Body

All document generation Edge Functions accept the same base request format defined by `RequestBody` in `_shared/document-generation/types.ts`:

```typescript
interface RequestBody {
  content: string;                  // Transcript or input content
  project_id: string;              // Project identifier
  user_id?: string;                // Optional user tracking
  system_prompt?: string;          // Optional custom system prompt override
  user_prompt?: string;            // Optional custom user prompt override
  previous_response_id?: string;   // OpenAI conversation continuity
  model?: string;                  // Optional model override
  temperature?: number;            // Optional temperature override (0.0-2.0)
  token_limit?: number;            // Optional max output tokens override
  meeting_transcript_id?: string;  // Optional transcript reference
}
```

The `content` field carries the input that the AI analyzes to generate the document. For most document types, this is raw text from a meeting transcript. For `create-unit-tests`, it is a JSON string containing the test generation form data.

### Response Body

All document generation Edge Functions return the same base response format defined by `ResponseData` in `_shared/document-generation/types.ts`:

```typescript
interface ResponseData {
  success: boolean;               // Operation status
  document?: string;            // Generated document (Markdown or JSON)
  response_id?: string;         // OpenAI response ID for tracking
  document_id?: string;         // Database ID of stored document
  document_name?: string;       // Generated or extracted document name
  ai_interaction_id?: string;   // AI interaction tracking ID
  error?: string;               // Error message if success is false
}
```

### Frontend Service Request/Response

The frontend `generateDocumentAPI()` in `document-generation-service.ts` wraps the Edge Function call with additional type normalization and error handling:

```typescript
// Request (frontend service)
interface EdgeFunctionRequest {
  content: string;
  project_id: string;
  meeting_transcript_id?: string;
  user_id?: string;
  system_prompt?: string;
  user_prompt?: string;
  previous_response_id?: string;
  model?: string;
  temperature?: number;
  token_limit?: number;
}

// Response (frontend service)
interface EdgeFunctionResponse {
  success: boolean;
  document?: string;
  response_id?: string;
  document_id?: string;
  error?: string;
}
```

## Configuration and Defaults

### OpenAI Configuration Precedence

Each Edge Function uses `loadConfiguration()` from `_shared/platform-settings/config-loader.ts` to merge configuration from three sources with the following precedence:

1. **Request overrides** - Parameters sent in the request body (`model`, `temperature`, `token_limit`)
2. **Database config** - Settings stored in the `platform_settings` table, keyed by document type
3. **Default config** - Hardcoded defaults in each function's `config.ts`

The merged result is an `OpenAIConfig` object:

```typescript
interface OpenAIConfig {
  model: string;                  // OpenAI model identifier (e.g., 'gpt-4o')
  max_output_tokens: number;       // Maximum response length (100-20000)
  temperature: number;            // Randomness level (0.0-2.0)
  store: boolean;                 // Store conversation for continuity
  system_prompt?: string;         // AI role definition
  prompt?: string;               // User-facing template with {{content}} placeholder
  token_limit?: number;           // Alias mapped to max_output_tokens
}
```

The `mergeConfigurations()` function in `types.ts` applies precedence and maps `token_limit` to `max_output_tokens` for API compatibility.

### Prompt Template Processing

The `buildPrompts()` function in `prompt-builder.ts` resolves the system and user prompts through a three-step process:

1. Apply request overrides if provided
2. Fall back to database-stored prompts
3. Fall back to the function's default prompts

The user prompt template supports two placeholder syntaxes that are replaced with the actual content before being sent to the model:

- `{{content}}` - Replaced with the transcript/input content
- `{{transcript}}` - Alias for `{{content}}`

## Shared Types

All shared types are defined in `/supabase/functions/_shared/document-generation/types.ts`. The key types are:

### DocumentTypeKey

A union type of all valid document type identifiers used throughout the system. Covers three document areas:

**Generated Documents (10 types):** `tasks`, `features`, `prd`, `test-cases`, `user-story`, `meeting-notes`, `unit-tests`, `specs`, `accessibility-test-result`, `performance-test-result`

**Planning Documents (24 types):** `requirements`, `user-guides`, `change-requirements`, `functional-summary`, `roadmap`, `business-context`, `company-goals`, `retrospective`, `okrs`, `executive-business-review`, `project-plan`, `status-report`, `4ls-retrospective`, `5-whys-analysis`, `90-day-plan`, `brainstorming`, `competitive-analysis`, `customer-journey-mapping`, `design-systems`, `marketing-plan`, `persona`, `project-charter`, `project-kickoff`, `risk-assessment-matrix`, `statement-of-work`

**Development Documents (6 types):** `architecture`, `technical-specs`, `task-notes`, `code-style-guide`, `technical-summary`, `integration-architecture`

**Governance Documents (11 types):** `compliance`, `processes-workflows`, `resources-tools`, `compliance-legal`, `team-organization`, `technical-standards`, `standard-operating-procedure`, `strategic-plan`

### AIInteractionParams

Parameters for creating an AI interaction record:

```typescript
interface AIInteractionParams {
  project_id: string;
  request_prompt: string;
  request_model: string;
  request_parameters: any;
  previous_interaction_id?: string;
  meeting_transcript_id?: string;
}
```

### TokenUsage

Token usage data extracted from OpenAI responses:

```typescript
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
```

### InteractionMetadata

Metadata extracted from OpenAI response headers:

```typescript
interface InteractionMetadata {
  conversation_id: string | null;
  model: string | null;
  created: number | null;
  object: string | null;
}
```

### StoreDocumentParams

Parameters for storing a generated document:

```typescript
interface StoreDocumentParams {
  content: string;
  document_type: DocumentTypeKey;
  document_name?: string;
  project_id: string;
  user_id?: string;
  ai_interaction_id: string;
  meeting_transcript_id?: string;
  sprint_id?: string;
}
```

### DocumentMetadata

Metadata calculated from document content:

```typescript
interface DocumentMetadata {
  word_count: number;
  section_count: number;
  estimated_reading_time: number;
}
```

## Error Handling

### Error Mapping

Edge Functions use `getErrorStatusCode()` in `response-builder.ts` to determine HTTP status codes:

| Condition | Status Code |
|-----------|-------------|
| `Method not allowed` in message | 405 |
| `required` in message | 400 |
| Error has numeric `status` property | Uses that value |
| All other errors | 500 |

### Frontend Error Transformation

The `generateDocumentAPI()` and specialized functions in `document-generation-service.ts` transform raw Edge Function errors into user-friendly messages before displaying them to users. The transformer functions check for common error patterns:

| Error Pattern | User-Friendly Message |
|--------------|----------------------|
| API key or authentication error | "API key not configured. Please configure your OpenAI API key in settings." |
| Rate limit or quota exceeded | "Rate limit exceeded. Please try again later." |
| Validation or invalid request | "Invalid request. Please check your input and try again." |
| Content too long | "Document content is too large. Please use a smaller document or split it into parts." |
| Project not found | "Project not found. Please ensure the project exists." |
| Timeout | "Request timed out. Please try again with a smaller document." |
| Network or connection error | "Network error. Please check your connection and try again." |
| OpenAI server error | "AI service error. Please try again later." |
| Internal server error (500) | "Temporary service error. Please try again in a few moments." |
| Unrecognized error | Returns the original error message |

### Interaction Lifecycle Errors

`ai-interaction-service.ts` handles failures at the tracking layer. When `generateDocument()` throws, `failInteraction()` records the error details including `error.name`, `error.message`, `error.stack`, and timestamp in the `ai_interactions` table. This ensures every failed request has a traceable record even if the Edge Function crashes.

## Usage Patterns

### Basic Document Generation

```typescript
import { generateDocumentAPI } from '@/lib/services/document-generation-service';

const result = await generateDocumentAPI(
  'prd',
  meetingTranscriptText,
  selectedProjectId,
  transcriptId,
  currentUserId
);

if (result.success) {
  console.log('Document:', result.document);
  console.log('Stored ID:', result.document_id);
}
```

### Unit Test Generation

```typescript
import { generateUnitTests } from '@/lib/services/document-generation-service';

const formData = {
  language: 'typescript',
  framework: 'Jest',
  functionName: 'calculateTotal',
  functionCode: 'export function calculateTotal(items: number[]): number { return items.reduce((a, b) => a + b, 0); }',
  testScenarios: [
    { description: 'Should return sum of positive numbers', input: '[1, 2, 3]', expectedOutput: '6' },
    { description: 'Should return 0 for empty array', input: '[]', expectedOutput: '0' }
  ]
};

const result = await generateUnitTests(formData, projectId, userId);
```

### Backlog Item Generation

```typescript
import { generateBacklogItem } from '@/lib/services/document-generation-service';

const result = await generateBacklogItem(
  'Add dark mode support',
  projectId,
  userId
);

if (result.success && result.backlog_items) {
  const item = result.backlog_items[0];
  console.log(item.title, item.priority, item.story_points);
}
```

### Task Generation from Content

```typescript
import { generateTasksAPI } from '@/lib/services/document-generation-service';

const result = await generateTasksAPI(
  prdContent,
  projectId,
  sourceDocumentId,  // Tracks document relationship
  userId
);
```

## Deployment

Deploy individual Edge Functions:

```bash
supabase functions deploy create-prd
supabase functions deploy create-user-story
supabase functions deploy create-meeting-notes
supabase functions deploy create-technical-specs
supabase functions deploy create-test-cases
supabase functions deploy create-unit-tests
supabase functions deploy analyze-transcript
supabase functions deploy suggest-backlog-item
supabase functions deploy create-backlog-items
supabase functions deploy analyze-sprint
```

Secrets must be configured in the Supabase dashboard or via CLI before deployment:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

## Related Documentation

- [Prompt Templates](../09-prompt-templates/templates.md) - Document templates and prompt engineering
- [AI Interaction Tracking](../10-ai-tracking/tracking.md) - Token usage and interaction audit trail
- [Generated Documents](../24-generated-documents/gen-docs.md) - Document storage and retrieval
- [Frontend Document Generation Service](../../ragworkforce/docs/08-document-generation/document-generation-service.md) - Client-side API layer
