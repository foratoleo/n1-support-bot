# Create PRD API Documentation

## Endpoint

```
POST /create-backlog-items
```

Generate Product Requirements Documents (PRDs) using OpenAI's GPT-4o model with conversation context support.

## Authentication

**Required**: `OPENAI_API_KEY` environment variable must be configured on the Supabase Edge Function.

## Request

### Headers

```
Content-Type: application/json
```

### Request Body Schema

```typescript
{
  content: string;              // Required - Source content for DOCUMENT generation
  project_id: string;           // Required - Project identifier for metadata tracking
  system_prompt?: string;       // Optional - Custom system instructions (defaults to built-in DOCUMENT template)
  user_prompt?: string;         // Optional - Custom user prompt (defaults to standard prompt)
  previous_response_id?: string; // Optional - OpenAI Response ID for conversation continuity
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Input content to transform into DOCUMENT. Must not be empty. |
| `project_id` | string | Yes | Project identifier for tracking and metadata. Must not be empty. |
| `system_prompt` | string | No | Override default DOCUMENT generation instructions. Uses predefined template if omitted. |
| `user_prompt` | string | No | Override default user prompt. Uses standard prompt if omitted. |
| `previous_response_id` | string | No | OpenAI Response ID to maintain conversation context across multiple DOCUMENT generations. |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "# Product Requirements Document\n\n## Overview and Objectives\n...",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: Generated DOCUMENT content in Markdown format
- `response_id`: OpenAI Response ID for conversation continuity

### Error Responses

#### 400 Bad Request - Missing Required Fields

```json
{
  "success": false,
  "error": "Content is required"
}
```

```json
{
  "success": false,
  "error": "Project ID is required"
}
```

#### 405 Method Not Allowed

```json
{
  "success": false,
  "error": "Method not allowed"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to generate document"
}
```

**Note**: OpenAI API errors preserve their original status codes when available.

## Default PRD Structure

When using the default `system_prompt`, generated PRDs follow this structure:

1. Overview and Objectives
2. User Personas and Use Cases
3. Functional Requirements
4. Non-Functional Requirements
5. Technical Specifications
6. Success Metrics
7. Timeline and Milestones
8. Dependencies and Risks

Output is always in **Brazilian Portuguese** unless explicitly specified otherwise in custom prompts.

## OpenAI Configuration

- **Model**: `gpt-4o`
- **Max Output Tokens**: 8000
- **Temperature**: 0.6
- **Store**: `false`

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-backlog-items
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Basic DOCUMENT Generation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-backlog-items \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Build a task management system with kanban boards",
    "project_id": "proj_123"
  }'
```

### DOCUMENT Generation with Custom Prompts

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-backlog-items \
  -H "Content-Type: application/json" \
  -d '{
    "content": "E-commerce checkout flow improvements",
    "project_id": "proj_456",
    "system_prompt": "Generate a technical DOCUMENT focusing on security and scalability",
    "user_prompt": "Create detailed requirements for:"
  }'
```

### Continuing Previous Conversation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-backlog-items \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Add payment gateway integration details",
    "project_id": "proj_456",
    "previous_response_id": "resp_abc123xyz"
  }'
```

## Error Handling

The function implements comprehensive error handling:

1. **Method Validation**: Only POST requests accepted
2. **Body Validation**: Required fields checked before processing
3. **OpenAI Error Propagation**: Original error status codes preserved
4. **Structured Error Responses**: Consistent JSON error format

## Implementation Notes

- Uses OpenAI Responses API for conversation continuity
- Supports multi-document generation sessions via `previous_response_id`
- Metadata includes `project_id` and `operation: 'create-backlog-items'` for tracking
- All responses include CORS headers for web client compatibility
- Built on Deno runtime with TypeScript
