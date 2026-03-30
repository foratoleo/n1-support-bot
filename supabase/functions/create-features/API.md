# Create Features API Documentation

## Endpoint

```
POST /create-features
```

Generate Features from Epics (backlog items) using OpenAI's GPT-4o model. Features represent the intermediate layer between Epics and Tasks in the product hierarchy.

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
  content: string;              // Required - Epic or backlog item content for feature generation
  project_id: string;           // Required - Project identifier for metadata tracking
  user_id?: string;             // Optional - User identifier for tracking
  system_prompt?: string;       // Optional - Custom system instructions (defaults to built-in feature generation template)
  user_prompt?: string;         // Optional - Custom user prompt (defaults to standard prompt)
  previous_response_id?: string; // Optional - OpenAI Response ID for conversation continuity
  model?: string;               // Optional - Override model (default: gpt-4o)
  temperature?: number;         // Optional - Override temperature (default: 0.7)
  token_limit?: number;         // Optional - Override max tokens (default: 8000)
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Epic or backlog item content to break down into Features. |
| `project_id` | string | Yes | Project identifier for tracking and metadata. |
| `user_id` | string | No | User identifier for tracking AI interactions. |
| `system_prompt` | string | No | Override default Feature generation instructions. |
| `user_prompt` | string | No | Override default user prompt. |
| `previous_response_id` | string | No | OpenAI Response ID to maintain conversation context. |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "{\"features\": [...], \"summary\": \"...\"}",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: JSON string containing generated features (see Output Format below)
- `response_id`: OpenAI Response ID for conversation continuity

### Output Format

The `document` field contains a JSON string with the following structure:

```json
{
  "features": [
    {
      "title": "string - Feature title in Brazilian Portuguese",
      "description": "string - Detailed description",
      "status": "draft",
      "priority": "critical|high|medium|low",
      "delivered_value": "string - User/business value statement",
      "ready_criteria": [
        {
          "id": "string - Unique ID (e.g., 'rc-1')",
          "description": "string - Testable criterion",
          "completed": false
        }
      ],
      "dependencies": [
        {
          "feature_id": "string - Reference to another feature",
          "dependency_type": "blocks|depends_on|related_to"
        }
      ],
      "notes": "string - Additional context or risks",
      "story_points": "number | null",
      "estimated_hours": "number | null",
      "tags": ["array of tags"]
    }
  ],
  "summary": "string - Markdown formatted summary"
}
```

### Feature Properties

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Clear, user-focused feature title (Brazilian Portuguese) |
| `description` | string | Detailed description with functionality scope |
| `status` | string | Always "draft" for newly generated features |
| `priority` | string | One of: critical, high, medium, low |
| `delivered_value` | string | Clear statement of user/business value |
| `ready_criteria` | array | List of testable criteria for feature readiness |
| `dependencies` | array | List of feature dependencies |
| `notes` | string | Additional context, technical considerations, or risks |
| `story_points` | number | Fibonacci estimate (1, 2, 3, 5, 8, 13, 21) |
| `estimated_hours` | number | Optional hour estimate |
| `tags` | array | Categorization tags |

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

## OpenAI Configuration

- **Model**: `gpt-4o`
- **Max Output Tokens**: 8000
- **Temperature**: 0.7 (slightly higher for creative feature breakdown)
- **Store**: `false`

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-features
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Basic Feature Generation from Epic

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-features \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Epic: Sistema de Autenticação\n\nComo usuário, quero poder acessar a plataforma de forma segura usando login social (Google, Microsoft) e email/senha tradicional, com suporte a recuperação de senha e autenticação em dois fatores.",
    "project_id": "proj_123",
    "user_id": "user_456"
  }'
```

### Feature Generation with Custom Prompts

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-features \
  -H "Content-Type: application/json" \
  -d '{
    "content": "PRD: E-commerce checkout flow improvements...",
    "project_id": "proj_456",
    "system_prompt": "Focus on mobile-first features with accessibility considerations",
    "user_prompt": "Break down into user-visible features:"
  }'
```

### Continuing Previous Conversation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-features \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Add payment gateway integration details",
    "project_id": "proj_456",
    "previous_response_id": "resp_abc123xyz"
  }'
```

## Feature Hierarchy Context

This endpoint generates **Features**, which sit in the middle of a three-level hierarchy:

```
Epic (Backlog Item)
  └── Feature (this endpoint output)
        └── Task (created via create-tasks)
```

**Epic**: High-level business objective or initiative
**Feature**: Mid-level deliverable providing tangible user value
**Task**: Granular development work items

Features should be:
- **User-Visible**: Represents functionality users can see or interact with
- **Valuable**: Delivers clear benefit to users or business
- **Demonstrable**: Can be shown in a demo or review session
- **Estimable**: Scope is clear enough to estimate effort
- **Testable**: Has clear criteria to verify completion

## Error Handling

The function implements comprehensive error handling:

1. **Method Validation**: Only POST requests accepted
2. **Body Validation**: Required fields checked before processing
3. **OpenAI Error Propagation**: Original error status codes preserved
4. **AI Interaction Tracking**: All requests tracked in `ai_interactions` table
5. **Document Storage**: Generated features stored in `generated_documents` table

## Data Tracking

The endpoint automatically:

1. Creates an `ai_interactions` record with request details
2. Updates interaction status to "in_progress" during generation
3. Records token usage and response metadata on completion
4. Stores generated content in `generated_documents` table with type "features"
5. Marks interaction as failed if generation fails

## Implementation Notes

- Uses OpenAI Responses API for conversation continuity
- Output is always in **Brazilian Portuguese** unless explicitly specified
- Ready criteria should be specific and testable
- Dependencies use temporary IDs (feat-1, feat-2) for internal references
- Built on Deno runtime with TypeScript
- Configuration can be overridden via `platform_settings` table (key: `ai-create-features`)
