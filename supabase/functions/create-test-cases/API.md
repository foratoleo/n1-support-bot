# Create Test Cases API Documentation

## Endpoint

```
POST /create-test-cases
```

Generate comprehensive manual test cases using OpenAI's GPT-4o model with conversation context support.

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
  content: string;              // Required - Source content for test cases generation
  project_id: string;           // Required - Project identifier for metadata tracking
  system_prompt?: string;       // Optional - Custom system instructions (defaults to built-in test cases template)
  user_prompt?: string;         // Optional - Custom user prompt (defaults to standard prompt)
  previous_response_id?: string; // Optional - OpenAI Response ID for conversation continuity
  model?: string;               // Optional - OpenAI model to use (defaults to gpt-4o)
  temperature?: number;         // Optional - Temperature setting (defaults to 0.5)
  token_limit?: number;         // Optional - Max output tokens (defaults to 8000)
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Input content describing features/functionality to test. Must not be empty. |
| `project_id` | string | Yes | Project identifier for tracking and metadata. Must not be empty. |
| `system_prompt` | string | No | Override default test cases generation instructions. Uses predefined template if omitted. |
| `user_prompt` | string | No | Override default user prompt. Uses standard prompt if omitted. |
| `previous_response_id` | string | No | OpenAI Response ID to maintain conversation context across multiple test case generations. |
| `model` | string | No | OpenAI model name (e.g., "gpt-4o", "gpt-4o-mini"). Defaults to "gpt-4o". |
| `temperature` | number | No | Creativity/randomness setting (0.0-2.0). Defaults to 0.5 for consistency. |
| `token_limit` | number | No | Maximum output tokens. Defaults to 8000. |

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "document": "# Test Cases\n\n## TC-001: Valid Login\n### Test Scenario\nVerify user can login with valid credentials...",
  "response_id": "resp_abc123xyz"
}
```

**Fields:**
- `success`: Always `true` for successful requests
- `document`: Generated test cases content in Markdown format
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

## Default Test Case Structure

When using the default `system_prompt`, generated test cases follow this structure:

For each test case:
1. **Test Case ID**: Unique identifier (e.g., TC-001)
2. **Test Scenario**: Brief description of what is being tested
3. **Priority**: Critical/High/Medium/Low
4. **Pre-conditions**: Required state before test execution
5. **Test Data**: Specific data needed for the test
6. **Test Steps**: Clear, numbered steps to execute
7. **Expected Results**: What should happen at each step
8. **Post-conditions**: Expected state after test execution
9. **Notes**: Any additional considerations or dependencies

**Organization:**
- Test cases grouped by feature or functionality
- Tables used for better readability
- Summary section with test case count by priority
- Traceability references to requirements when applicable

Output is always in **Brazilian Portuguese** unless explicitly specified otherwise in custom prompts.

## OpenAI Configuration

- **Model**: `gpt-4o`
- **Max Output Tokens**: 8000
- **Temperature**: 0.5 (lower for consistency in test cases)
- **Store**: `false`

## CORS Support

The endpoint supports CORS preflight requests:

```
OPTIONS /create-test-cases
```

Returns 200 with appropriate CORS headers.

## Usage Examples

### Basic Test Cases Generation

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-test-cases \
  -H "Content-Type: application/json" \
  -d '{
    "content": "User login feature with email and password authentication, including forgot password flow",
    "project_id": "proj_123"
  }'
```

### Test Cases Generation with Custom Focus

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-test-cases \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Shopping cart checkout process with payment integration",
    "project_id": "proj_456",
    "system_prompt": "Generate security-focused test cases with emphasis on payment security",
    "user_prompt": "Create comprehensive security test cases for:\n{{content}}",
    "temperature": 0.3
  }'
```

### Continuing Previous Test Case Session

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-test-cases \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Add test cases for mobile responsive behavior and accessibility",
    "project_id": "proj_456",
    "previous_response_id": "resp_abc123xyz"
  }'
```

### Using Different Model for Cost Optimization

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-test-cases \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Simple contact form validation",
    "project_id": "proj_789",
    "model": "gpt-4o-mini",
    "temperature": 0.4
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
- Metadata includes `project_id` and `operation: 'create-test-cases'` for tracking
- All responses include CORS headers for web client compatibility
- Built on Deno runtime with TypeScript
- Lower temperature (0.5) used for consistent, reliable test case generation
- Supports both positive and negative test scenarios
- Includes edge cases and boundary conditions automatically

## Best Practices

1. **Content Quality**: Provide clear, detailed descriptions of features and expected behavior
2. **Conversation Context**: Use `previous_response_id` to build upon previous test cases
3. **Temperature Setting**: Keep temperature low (0.3-0.5) for consistent test case structure
4. **Model Selection**: Use `gpt-4o` for complex features, `gpt-4o-mini` for simple ones
5. **Custom Prompts**: Add specific focus areas (security, performance, accessibility) in custom prompts
6. **Iteration**: Generate initial test cases, then refine with follow-up requests

## Test Case Coverage Areas

The default configuration generates test cases covering:

- **Positive Scenarios**: Happy path with valid inputs
- **Negative Scenarios**: Invalid inputs and error handling
- **Edge Cases**: Boundary values and limits
- **Security**: Authentication, authorization, data validation
- **Usability**: User experience and accessibility
- **Performance**: Load handling and response times (when applicable)
- **Integration**: Third-party services and APIs
- **Data**: Data integrity and validation
