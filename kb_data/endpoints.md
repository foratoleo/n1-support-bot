---
name: api-endpoints
description: All Edge Function endpoints with request/response schemas and deployment
area: 11
maintained_by: api-documenter
created: 2026-03-30
updated: 2026-03-30
---

# Edge Function API Endpoints

All document generation endpoints are implemented as Supabase Edge Functions using Deno runtime. They provide server-side OpenAI integration with automatic token tracking, document storage, and conversation continuity via the Responses API.

Base URL: `https://<project-ref>.supabase.co/functions/v1/<endpoint>`

Authentication: Requires `Authorization: Bearer <anon_key>` header.

---

## 1. Create PRD

Generates a Product Requirements Document from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-prd` |
| Method | `POST` |
| Document Type | `prd` |
| Deployment | `supabase functions deploy create-prd` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or raw content to generate PRD from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model (e.g., gpt-4o, gpt-4o-mini)",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated PRD content in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 2. Create User Story

Generates user stories from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-user-story` |
| Method | `POST` |
| Document Type | `user-story` |
| Deployment | `supabase functions deploy create-user-story` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or raw content to generate user stories from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated user stories in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 3. Create Meeting Notes

Generates structured meeting notes from transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-meeting-notes` |
| Method | `POST` |
| Document Type | `meeting-notes` |
| Deployment | `supabase functions deploy create-meeting-notes` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript content to generate notes from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated meeting notes in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 4. Create Technical Specs

Generates technical specification documents from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-technical-specs` |
| Method | `POST` |
| Document Type | `technical-specs` |
| Deployment | `supabase functions deploy create-technical-specs` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or requirements content",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated technical specifications in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 5. Create Test Cases

Generates test scenarios and validation cases from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-test-cases` |
| Method | `POST` |
| Document Type | `test-cases` |
| Deployment | `supabase functions deploy create-test-cases` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or requirements to generate test cases from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated test cases in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 6. Create Unit Tests

Generates production-ready unit tests for code functions. Uses language and framework-specific prompts.

| Property | Value |
|----------|-------|
| URL | `/create-unit-tests` |
| Method | `POST` |
| Document Type | `unit-tests` |
| Deployment | `supabase functions deploy create-unit-tests` |

### Supported Languages and Frameworks

| Language | Supported Frameworks |
|----------|---------------------|
| JavaScript | Jest, Mocha, Jasmine, AVA |
| TypeScript | Jest, Vitest, Mocha, Jasmine |
| Python | pytest, unittest, nose2, doctest |
| Java | JUnit, TestNG, Mockito, Spock |

### Request Schema

```json
{
  "content": "string (required) - JSON stringified UnitTestFormData object",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "document_type": "string (optional) - Must be 'unit-tests' if provided",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

**UnitTestFormData structure (stringified in content):**
```json
{
  "language": "string (required) - javascript | typescript | python | java",
  "framework": "string (required) - Framework from supported list above",
  "functionName": "string (required) - Name of the function to generate tests for",
  "functionCode": "string (optional) - Source code of the function",
  "testScenarios": [
    {
      "description": "string (required) - Test scenario description",
      "input": "string (optional) - Test input value",
      "expectedOutput": "string (optional) - Expected output value",
      "shouldThrow": "boolean (optional) - Whether the test expects an error",
      "errorMessage": "string (optional) - Expected error message"
    }
  ],
  "additionalContext": "string (optional) - Additional context for test generation"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated unit tests in the specified language/framework",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Format: 'Unit Tests - <functionName>'",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content`, `project_id`, or `content` is not valid JSON |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 7. Analyze Transcript

Extracts structured metadata from meeting transcripts including title, description, date, tags, and recommended documents. Does not store generated documents.

| Property | Value |
|----------|-------|
| URL | `/analyze-transcript` |
| Method | `POST` |
| Document Type | N/A (analysis only, no document storage) |
| Deployment | `supabase functions deploy analyze-transcript` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript content to analyze",
  "project_id": "string (optional) - Project identifier (required for AI interaction tracking)",
  "user_id": "string (optional) - User performing the action",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "analysis": {
    "title": "string - Extracted meeting title",
    "description": "string - Brief summary of meeting content",
    "meeting_date": "string | null - Extracted meeting date if identifiable",
    "tags": ["string"] - Array of relevant topic tags",
    "recommended_documents": ["string"] - Array of document types recommended for generation",
    "confidence_scores": {
      "title": "number - Confidence score for title extraction (0-1)",
      "description": "number - Confidence score for description (0-1)",
      "meeting_date": "number - Confidence score for date extraction (0-1)"
    }
  },
  "response_id": "string - OpenAI response ID for tracking"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or transcript exceeds 50,000 characters |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## Common Configuration

### OpenAI Configuration Precedence

Configuration is loaded with the following precedence order:

1. **Request-level overrides** - `model`, `temperature`, `token_limit` passed in request body
2. **Database configuration** - Platform settings from `platform_settings` table
3. **Default configuration** - Built-in defaults per endpoint

### Supported Models

| Model | Use Case |
|-------|----------|
| `gpt-4o` | Complex documents, technical specifications |
| `gpt-4o-mini` | Simple documents, quick generations |
| `gpt-4-turbo` | High-quality complex documents |

### Default OpenAI Parameters

| Parameter | Default Value | Range |
|-----------|--------------|-------|
| `temperature` | 0.7 | 0.0 - 2.0 |
| `max_output_tokens` | 4096 | 100 - 20000 |
| `store` | true | boolean |

---

## CORS Support

All endpoints include CORS preflight handling via `OPTIONS` method. The following headers are included in all responses:

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | `*` (configurable) |
| `Access-Control-Allow-Headers` | `authorization, x-client-info, apikey, content-type` |
| `Access-Control-Allow-Methods` | `POST, OPTIONS` |

---

## Error Handling

All errors follow a consistent format. The `getErrorStatusCode` function maps error messages to appropriate HTTP status codes:

| Status Code | Error Pattern |
|-------------|---------------|
| 400 | Error message contains "required" |
| 405 | Error message contains "Method not allowed" |
| 500 | All other errors (default fallback) |

---

## Deployment Commands

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

Deploy all functions at once:

```bash
supabase functions deploy
```

Set required secrets before deployment:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

---

## Usage Example

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/create-prd' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "We need to build a user authentication system with OAuth support...",
    "project_id": "uuid-project-id",
    "user_id": "uuid-user-id",
    "temperature": 0.7
  }'
```

---

## Related Topics

- [Document Generation](../08-document-generation/edge-functions.md)
- [Supabase Functions](../12-supabase-functions/functions.md)
- [AI Tracking](../10-ai-tracking/tracking.md)
