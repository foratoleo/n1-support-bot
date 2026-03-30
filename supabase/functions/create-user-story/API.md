# Create User Story API Documentation

## Endpoint

```
POST /create-user-story
```

Generate agile User Stories using OpenAI's GPT-4o model with conversation context support.

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
  content: string;              // Required - Source content for user story generation
  project_id: string;           // Required - Project identifier for metadata tracking
  system_prompt?: string;       // Optional - Custom system instructions (defaults to built-in template)
  user_prompt?: string;         // Optional - Custom user prompt (defaults to standard prompt)
  previous_response_id?: string; // Optional - OpenAI Response ID for conversation continuity
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Input content to transform into user stories. Must not be empty. |
| `project_id` | string | Yes | Project identifier for tracking and metadata. Must not be empty. |
| `system_prompt` | string | No | Override default user story generation instructions. Uses predefined agile template if omitted. |
| `user_prompt` | string | No | Override default user prompt. Uses standard prompt if omitted. |
| `previous_response_id` | string | No | OpenAI Response ID to maintain conversation context across multiple story generations. |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "# User Story: Feature Name\n\n## Story\nAs a [user]...",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: Generated user story content in Markdown format
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

## Default User Story Structure

When using the default `system_prompt`, generated user stories follow this agile format:

1. **Story Title** - Concise and descriptive
2. **User Story Statement** - "As a [user], I want to [action], so that [benefit]"
3. **Acceptance Criteria** - Clear, testable conditions
4. **Priority Level** - High/Medium/Low
5. **Estimated Complexity** - Story Points or T-Shirt Size
6. **Dependencies** - Related stories or requirements
7. **Notes and Considerations** - Additional context

Output is always in **Brazilian Portuguese** unless explicitly specified otherwise in custom prompts.

## Agile Best Practices

The function follows these principles:

- User-centric value focus (not technical specifications)
- INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- Clear acceptance criteria for definition of done
- Priority-based ordering for sprint planning
- Complexity estimation for velocity tracking

## OpenAI Configuration

- **Model**: `gpt-4o`
- **Max Output Tokens**: 8000
- **Temperature**: 0.6
- **Store**: `false`

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-user-story
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Basic User Story Generation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-user-story \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Users need to export their data in CSV format",
    "project_id": "proj_123"
  }'
```

### User Story with Custom Prompts

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-user-story \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Admin dashboard analytics features",
    "project_id": "proj_456",
    "system_prompt": "Generate user stories for enterprise admin users with security focus",
    "user_prompt": "Create detailed stories for:"
  }'
```

### Continuing Previous Conversation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-user-story \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Add real-time notifications for dashboard updates",
    "project_id": "proj_456",
    "previous_response_id": "resp_abc123xyz"
  }'
```

### Batch Story Generation from PRD

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-user-story \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Extract user stories from: [PRD content here]",
    "project_id": "proj_789",
    "user_prompt": "Break down the following PRD into individual user stories:"
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
- Supports iterative story refinement via `previous_response_id`
- Metadata includes `project_id` and `operation: 'create-user-story'` for tracking
- All responses include CORS headers for web client compatibility
- Built on Deno runtime with TypeScript
- Focuses on user value and outcomes (not implementation details)

## Comparison with create-prd

| Feature | create-prd | create-user-story |
|---------|------------|-------------------|
| **Output** | Comprehensive PRD document | Agile user stories |
| **Focus** | Technical specifications, requirements | User value, acceptance criteria |
| **Structure** | 8-section PRD format | 7-section story format |
| **Audience** | Product managers, stakeholders | Development teams, sprint planning |
| **Detail Level** | High-level architecture and planning | Actionable, sprint-sized work items |
| **Model** | GPT-4o | GPT-4o |
| **API** | OpenAI Responses API | OpenAI Responses API |

## Integration Workflow

Typical usage pattern:

1. **PRD Generation**: Use `/create-prd` to generate comprehensive requirements
2. **Story Breakdown**: Use `/create-user-story` with PRD content to generate actionable stories
3. **Story Refinement**: Use `previous_response_id` to iterate and refine stories
4. **Sprint Planning**: Use generated stories with priority and complexity estimates
