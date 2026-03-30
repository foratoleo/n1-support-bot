# Create Test Cases Edge Function

This Supabase Edge Function generates comprehensive manual test cases using OpenAI's API with intelligent configuration management through the platform_settings system.

## Table of Contents

- [Overview](#overview)
- [Environment Variables](#environment-variables)
- [Platform Settings Integration](#platform-settings-integration)
- [API Usage](#api-usage)
- [Troubleshooting](#troubleshooting)
- [Development](#development)

## Overview

The `create-test-cases` function:
- Generates detailed manual test cases from user-provided content using OpenAI
- Loads AI configurations from the `platform_settings` database table
- Supports configuration overrides via request body
- Maintains conversation context with OpenAI Responses API
- Handles prompt template placeholders automatically
- Outputs test cases in Brazilian Portuguese by default

## Environment Variables

### Required Variables

These environment variables must be configured in your Supabase project:

#### `OPENAI_API_KEY` (Required)
- **Purpose**: Authentication for OpenAI API requests
- **How to obtain**:
  1. Visit https://platform.openai.com/api-keys
  2. Create a new secret key
  3. Copy the key (it won't be shown again)
- **Security**: Never commit this to version control or expose in client-side code

#### `SUPABASE_URL` (Required)
- **Purpose**: Your Supabase project's base URL
- **How to obtain**:
  1. Go to Supabase Dashboard
  2. Navigate to Project Settings > API
  3. Copy the "Project URL" value
- **Example**: `https://abcdefghijklmnop.supabase.co`

#### `SUPABASE_SERVICE_ROLE_KEY` (Required)
- **Purpose**: Server-side authentication with elevated privileges to access platform_settings
- **How to obtain**:
  1. Go to Supabase Dashboard
  2. Navigate to Project Settings > API
  3. Copy the "service_role" key (under "Project API keys")
- **Security**:
  - This key bypasses Row Level Security (RLS) policies
  - Never expose in client-side code
  - Only use in secure server environments

### Setting Environment Variables

**Via Supabase Dashboard:**
1. Go to Project Settings > Edge Functions
2. Add each variable in the "Environment Variables" section
3. Click "Save"

**Via Supabase CLI:**
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-your-key-here
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**For Local Development:**
Create a `.env` file in the `supabase/functions/` directory:
```bash
cp supabase/functions/.env.example supabase/functions/.env
# Edit .env with your actual values
```

## Platform Settings Integration

### Configuration Precedence

The function uses a three-tier configuration system with the following precedence (highest to lowest):

1. **Request Body Parameters** - Explicit values in the API request
2. **Database Configuration** - Settings stored in `platform_settings` table
3. **Default Values** - Hardcoded fallback values in `config.ts`

### Database Configuration

AI configurations are stored in the `platform_settings` table with the key `ai-create-test-cases`.

**Configuration Structure:**
```json
{
  "model": "gpt-4o",
  "temperature": 0.5,
  "token_limit": 8000,
  "system_prompt": "You are a specialized Test Case generator...",
  "user_prompt": "Generate detailed manual test cases based on:\n{{content}}"
}
```

**Key Fields:**
- `model`: OpenAI model to use (e.g., "gpt-4o", "gpt-4o-mini")
- `temperature`: Randomness/creativity (0.0 to 2.0) - lower for test cases (0.5 recommended)
- `token_limit`: Maximum response length
- `system_prompt`: Instructions for the AI's role and behavior
- `user_prompt`: Template for the user's request (use `{{content}}` placeholder)

### Prompt Template Placeholders

The `user_prompt` supports the `{{content}}` placeholder, which is automatically replaced with the actual user content from the request body.

**Example:**
```json
{
  "user_prompt": "Generate comprehensive test cases for:\n\n{{content}}\n\nInclude positive, negative, and edge cases."
}
```

When a request comes in with `content: "User login feature with email and password"`, the system generates:
```
Generate comprehensive test cases for:

User login feature with email and password

Include positive, negative, and edge cases.
```

## API Usage

### Basic Request (Uses Database Configuration)

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-test-cases' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "User login feature with email and password authentication",
    "project_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

**Behavior:**
- Loads AI configuration from database (key: `ai-create-test-cases`)
- Uses database prompts with `{{content}}` replaced
- Falls back to defaults if database config not found

### Request with Configuration Override

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-test-cases' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "User login feature with email and password",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "system_prompt": "You are a QA specialist focused on security testing.",
    "user_prompt": "Create detailed security test cases for:\n{{content}}"
  }'
```

**Behavior:**
- Request body parameters override database configuration
- Useful for testing different configurations
- Allows per-request customization

### Request with Conversation Continuation

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/create-test-cases' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Add test cases for password reset functionality",
    "project_id": "123e4567-e89b-12d3-a456-426614174000",
    "previous_response_id": "resp_abc123xyz"
  }'
```

**Behavior:**
- Continues conversation from previous response
- Maintains context across multiple requests
- Enables iterative refinement

### Response Format

**Success Response (200 OK):**
```json
{
  "success": true,
  "document": "# Test Cases\n\n## TC-001: Valid Login\n...",
  "response_id": "resp_abc123xyz"
}
```

**Error Response (4xx/5xx):**
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error context"
}
```

## Troubleshooting

### Common Issues

#### 1. Missing OPENAI_API_KEY Error

**Error:**
```
OPENAI_API_KEY environment variable is required
```

**Solution:**
1. Verify the environment variable is set in Supabase Dashboard
2. Check for typos in the variable name
3. Ensure the value starts with `sk-`
4. Redeploy the function after setting the variable

**Verification:**
```bash
supabase secrets list
```

#### 2. Missing SUPABASE_SERVICE_ROLE_KEY Error

**Error:**
```
SUPABASE_SERVICE_ROLE_KEY environment variable is required
```

**Solution:**
1. Add the service role key to your Supabase project secrets
2. Ensure you're using the "service_role" key, not the "anon" key
3. Verify the key has access to the platform_settings table

**Get the key:**
- Dashboard: Project Settings > API > service_role (under "Project API keys")

#### 3. platform_settings Access Denied

**Error:**
```
Could not access platform_settings table
```

**Possible Causes & Solutions:**

**a) RLS Policies Blocking Access**
- The service role key should bypass RLS, but verify your policies
- Check if there are restrictive policies on `platform_settings` table
- Ensure the function is using `createSupabaseClient()` which creates a client with service role credentials

**b) Table Doesn't Exist**
```sql
-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON platform_settings(key);
```

**c) Missing Configuration**
```sql
-- Insert default configuration for create-test-cases
INSERT INTO platform_settings (key, value, description)
VALUES (
  'ai-create-test-cases',
  '{
    "model": "gpt-4o",
    "temperature": 0.5,
    "token_limit": 8000,
    "system_prompt": "You are a specialized Test Case generator for software quality assurance.",
    "user_prompt": "Generate detailed manual test cases based on the following content:\n\n{{content}}"
  }'::jsonb,
  'AI configuration for test cases generation'
)
ON CONFLICT (key) DO NOTHING;
```

#### 4. Database Configuration Not Loading

**Symptoms:**
- Function always uses default prompts
- Database settings seem to be ignored

**Debug Steps:**

1. **Verify configuration exists:**
```sql
SELECT * FROM platform_settings WHERE key = 'ai-create-test-cases';
```

2. **Check function logs:**
```bash
supabase functions logs create-test-cases
```
Look for log messages like:
- `[create-test-cases] Loaded configuration from database: ai-create-test-cases`
- `[create-test-cases] Using database prompts for key: ai-create-test-cases`

3. **Test with override:**
Send a request with explicit prompts to confirm the function works:
```json
{
  "content": "test",
  "project_id": "test-id",
  "system_prompt": "Test system prompt",
  "user_prompt": "Test user prompt: {{content}}"
}
```

#### 5. OpenAI API Errors

**Error:**
```
OpenAI API error: Incorrect API key provided
```

**Solution:**
1. Verify your OpenAI API key is valid
2. Check your OpenAI account has available credits
3. Ensure the key hasn't been revoked

**Error:**
```
OpenAI API error: Rate limit exceeded
```

**Solution:**
1. Check your OpenAI usage limits
2. Implement request throttling
3. Consider upgrading your OpenAI plan

#### 6. Invalid Model Name

**Error:**
```
OpenAI API error: The model 'xyz' does not exist
```

**Solution:**
1. Use valid OpenAI model names: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`
2. Update database configuration:
```sql
UPDATE platform_settings
SET value = jsonb_set(value, '{model}', '"gpt-4o"')
WHERE key = 'ai-create-test-cases';
```

## Development

### Local Testing

1. **Install Supabase CLI:**
```bash
npm install -g supabase
```

2. **Start local Supabase:**
```bash
supabase start
```

3. **Set up environment:**
```bash
cd supabase/functions
cp .env.example .env
# Edit .env with your keys
```

4. **Serve function locally:**
```bash
supabase functions serve create-test-cases --env-file .env
```

5. **Test the function:**
```bash
curl -X POST 'http://localhost:54321/functions/v1/create-test-cases' \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Test login functionality",
    "project_id": "test-id"
  }'
```

### Deployment

```bash
# Deploy function
supabase functions deploy create-test-cases

# Set environment variables (if not already set)
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Monitoring

**View logs:**
```bash
# Real-time logs
supabase functions logs create-test-cases --follow

# Recent logs
supabase functions logs create-test-cases
```

**Check function status:**
```bash
supabase functions list
```

## Related Documentation

- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Platform Settings Schema](../../../docs/schema.md)
- [Create PRD Function](../create-prd/README.md)
- [Create User Story Function](../create-user-story/README.md)

## Support

For issues or questions:
1. Check this troubleshooting guide
2. Review function logs: `supabase functions logs create-test-cases`
3. Verify environment variables are set correctly
4. Test with configuration overrides to isolate issues
