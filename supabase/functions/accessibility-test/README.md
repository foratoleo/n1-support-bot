# Accessibility Test - Edge Function

Secure Supabase Edge Function that acts as a bridge between the frontend accessibility testing interface and the PageSpeed Insights API via RapidAPI. This function protects API keys from client-side exposure while providing comprehensive accessibility testing and historical tracking.

## Overview

This Edge Function enables project-based accessibility testing by:
- Securely calling PageSpeed Insights API with server-side credentials
- Storing complete test results in the database for historical analysis
- Providing a consistent API interface for the frontend
- Supporting multiple testing strategies (mobile/desktop)
- Enabling future enhancements like scheduled testing and bulk analysis

## Architecture

```
[Frontend] → [Edge Function] → [PageSpeed API] → [Database]
    ↓              ↓                  ↓              ↓
Submit Test   Validate Request   Run Analysis   Store Results
Track Status  Call External API   Return Data    Return Summary
```

### Data Flow

1. **Request Phase**: Frontend submits accessibility test request with project context
2. **Validation Phase**: Edge Function validates request parameters and authentication
3. **AI Interaction Phase**: Creates tracking record in `ai_interactions` table
4. **API Phase**: Calls PageSpeed Insights API via RapidAPI with retry logic
5. **Storage Phase**: Stores complete JSON response in `generated_documents` table
6. **Response Phase**: Returns formatted summary to frontend with document ID

### Security Model

- API keys stored as Supabase secrets (never exposed to frontend)
- Request authentication via Supabase JWT tokens
- Project-based data isolation through RLS policies
- Input validation prevents injection attacks
- Timeout protection prevents resource exhaustion

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- RapidAPI account with PageSpeed Insights API subscription
- Project deployed to Supabase
- Valid Supabase authentication configured

## Environment Setup

### Required Secrets

The function requires the following secret to be configured in Supabase:

```bash
# Set RapidAPI key for PageSpeed Insights API
supabase secrets set RAPIDAPI_KEY=your-rapidapi-key-here
```

### Verify Secrets

```bash
# List all configured secrets
supabase secrets list

# Expected output should include:
# - RAPIDAPI_KEY
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
```

### Get RapidAPI Key

1. Sign up at [RapidAPI](https://rapidapi.com/)
2. Subscribe to [PageSpeed Insights API](https://rapidapi.com/apiflash/api/pagespeed-insights)
3. Copy your API key from the API dashboard
4. Set the secret using the command above

## Deployment

### Development Deployment

```bash
# Start local Supabase development environment
supabase start

# Serve function locally with environment file
supabase functions serve accessibility-test --env-file supabase/.env.local

# Function will be available at:
# http://localhost:54321/functions/v1/accessibility-test
```

### Production Deployment

```bash
# Deploy function to Supabase
supabase functions deploy accessibility-test

# Set production secrets (if not already configured)
supabase secrets set RAPIDAPI_KEY=your-production-key --project-ref your-project-ref

# Verify deployment
curl -X POST https://your-project.supabase.co/functions/v1/accessibility-test \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test","targetUrl":"https://example.com","strategy":"mobile"}'
```

### Deployment Verification

After deployment, verify the function is working:

```bash
# Check function logs
supabase functions logs accessibility-test --tail

# Test with curl
curl -X POST http://localhost:54321/functions/v1/accessibility-test \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "00000000-0000-0000-0000-000000000000",
    "targetUrl": "https://www.google.com",
    "strategy": "mobile"
  }'
```

## Local Development

### Setup

1. Clone the repository and navigate to the project root
2. Install Supabase CLI if not already installed
3. Start local Supabase instance:

```bash
supabase start
```

4. Create local environment file `supabase/.env.local`:

```bash
RAPIDAPI_KEY=your-rapidapi-key
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your-local-anon-key
```

### Running Locally

```bash
# Serve the function
supabase functions serve accessibility-test --env-file supabase/.env.local

# In another terminal, test the function
curl -X POST http://localhost:54321/functions/v1/accessibility-test \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "targetUrl": "https://www.example.com",
    "strategy": "mobile",
    "categories": ["accessibility", "performance"],
    "locale": "en-US"
  }'
```

### Debugging

View function logs in real-time:

```bash
# Local development logs
supabase functions logs accessibility-test --tail

# Production logs
supabase functions logs accessibility-test --project-ref your-project-ref --tail
```

Enable detailed logging by checking console output in the function execution.

## API Contract

### Endpoint

```
POST /functions/v1/accessibility-test
```

### Authentication

Requires valid Supabase JWT token in Authorization header:

```
Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN
```

### Request Body Schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `projectId` | string (UUID) | Yes | - | Project identifier for data isolation |
| `targetUrl` | string (URL) | Yes | - | URL to test (HTTP/HTTPS, no localhost) |
| `strategy` | string | Yes | - | Testing strategy: `mobile` or `desktop` |
| `categories` | string[] | No | `["accessibility"]` | Categories to test: `accessibility`, `performance`, `best-practices`, `seo` |
| `locale` | string | No | `"en-US"` | Test locale in format `xx-XX` (e.g., `pt-BR`) |
| `timeout` | number | No | `30000` | Request timeout in milliseconds (5000-60000) |
| `wcagLevel` | string | No | `"AA"` | WCAG compliance level: `A`, `AA`, or `AAA` |

### Response Schema

#### Success Response (200 OK)

```json
{
  "documentId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "result": {
    "accessibilityScore": 0.95,
    "performanceScore": 0.88,
    "bestPracticesScore": 0.92,
    "seoScore": 0.90,
    "finalUrl": "https://www.example.com/",
    "fetchTime": "2025-01-20T10:30:00.000Z"
  },
  "executionTime": 3245
}
```

#### Error Response (400/403/429/500)

```json
{
  "success": false,
  "error": "Invalid request: targetUrl must be a valid HTTP or HTTPS URL",
  "code": "ValidationError",
  "details": {
    "field": "targetUrl"
  }
}
```

### HTTP Status Codes

| Status | Description | Retryable |
|--------|-------------|-----------|
| 200 | Success - test completed and results stored | - |
| 400 | Bad Request - invalid input parameters | No |
| 401 | Unauthorized - missing or invalid auth token | No |
| 403 | Forbidden - invalid RapidAPI key | No |
| 405 | Method Not Allowed - only POST supported | No |
| 429 | Too Many Requests - rate limit exceeded | Yes |
| 500 | Internal Server Error - unexpected error | Yes |
| 504 | Gateway Timeout - PageSpeed API timeout | Yes |

## Rate Limiting

The function implements automatic retry logic with exponential backoff:

- **Retry Attempts**: 3 attempts total
- **Backoff Delays**: 1s, 2s, 4s
- **Retryable Errors**: Network errors, 5xx responses, 429 rate limits
- **Non-retryable Errors**: 400 validation errors, 403 auth errors

PageSpeed Insights API rate limits (via RapidAPI):
- Free tier: 500 requests/day
- Basic tier: 5,000 requests/month
- Pro tier: 50,000 requests/month

## Examples

### Example 1: Basic Accessibility Test

```typescript
// Frontend code using Supabase client
import { supabase } from '@/lib/supabase';

const response = await supabase.functions.invoke('accessibility-test', {
  body: {
    projectId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    targetUrl: 'https://www.example.com',
    strategy: 'mobile'
  }
});

if (response.error) {
  console.error('Test failed:', response.error);
} else {
  console.log('Document ID:', response.data.documentId);
  console.log('Accessibility Score:', response.data.result.accessibilityScore);
}
```

### Example 2: Comprehensive Test with All Categories

```bash
curl -X POST https://your-project.supabase.co/functions/v1/accessibility-test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "targetUrl": "https://www.mywebsite.com",
    "strategy": "desktop",
    "categories": ["accessibility", "performance", "best-practices", "seo"],
    "locale": "pt-BR",
    "timeout": 45000
  }'
```

### Example 3: Error Handling

```typescript
try {
  const response = await supabase.functions.invoke('accessibility-test', {
    body: {
      projectId: selectedProject.id,
      targetUrl: formData.url,
      strategy: formData.strategy
    }
  });

  if (response.error) {
    // Handle specific error types
    if (response.error.message.includes('rate limit')) {
      toast.error('Rate limit exceeded. Please wait a moment before testing again.');
    } else if (response.error.message.includes('Invalid')) {
      toast.error('Invalid URL format. Please check the URL and try again.');
    } else {
      toast.error('Test failed: ' + response.error.message);
    }
    return;
  }

  // Success
  toast.success('Accessibility test completed successfully!');
  console.log('Results:', response.data.result);

} catch (error) {
  console.error('Unexpected error:', error);
  toast.error('An unexpected error occurred. Please try again.');
}
```

### Example 4: Using with React Hook

```typescript
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useProjectSelection } from '@/contexts/ProjectSelectionContext';

export function useAccessibilityTest() {
  const { selectedProject } = useProjectSelection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async (targetUrl: string, strategy: 'mobile' | 'desktop') => {
    if (!selectedProject) {
      setError('No project selected');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'accessibility-test',
        {
          body: {
            projectId: selectedProject.id,
            targetUrl,
            strategy,
            categories: ['accessibility', 'performance']
          }
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { runTest, loading, error };
}
```

## Troubleshooting

### Common Issues and Solutions

#### Issue: "RAPIDAPI_KEY environment variable is not configured"

**Cause**: RapidAPI key secret not set in Supabase.

**Solution**:
```bash
supabase secrets set RAPIDAPI_KEY=your-key-here
```

Verify with:
```bash
supabase secrets list
```

#### Issue: "Invalid API key or unauthorized access"

**Cause**: RapidAPI key is invalid or subscription expired.

**Solution**:
1. Log in to RapidAPI dashboard
2. Verify PageSpeed Insights API subscription is active
3. Copy the correct API key
4. Update the secret: `supabase secrets set RAPIDAPI_KEY=new-key`

#### Issue: "Rate limit exceeded"

**Cause**: Exceeded RapidAPI rate limits for your subscription tier.

**Solution**:
- Wait for rate limit to reset (typically hourly or daily)
- Upgrade RapidAPI subscription for higher limits
- Implement client-side rate limiting to prevent excessive calls

#### Issue: "projectId must be a valid UUID"

**Cause**: Invalid project ID format in request.

**Solution**:
```typescript
// Ensure projectId is a valid UUID
const { selectedProject } = useProjectSelection();
if (!selectedProject?.id) {
  console.error('No project selected');
  return;
}

// Use selectedProject.id (not selectedProjectId)
const response = await supabase.functions.invoke('accessibility-test', {
  body: {
    projectId: selectedProject.id, // Correct
    // projectId: selectedProjectId, // Wrong - property doesn't exist
    targetUrl: url,
    strategy: 'mobile'
  }
});
```

#### Issue: "targetUrl must be a valid HTTP or HTTPS URL (localhost and private IPs are not allowed)"

**Cause**: Attempting to test localhost or private IP addresses.

**Solution**:
- Use publicly accessible URLs only
- For local development testing, use ngrok or similar tunneling service
- Test against staging/production environments

#### Issue: "Function execution timeout exceeded"

**Cause**: PageSpeed API taking too long to respond (>55 seconds).

**Solution**:
- Reduce timeout parameter in request
- Test simpler pages that load faster
- Check target website performance
- Retry the request

#### Issue: "Database error: Foreign key constraint violation"

**Cause**: Invalid project ID that doesn't exist in database.

**Solution**:
```typescript
// Verify project exists before calling function
const { data: project } = await supabase
  .from('project_knowledge_base')
  .select('id')
  .eq('id', projectId)
  .single();

if (!project) {
  console.error('Project not found');
  return;
}
```

### Debug Mode

Enable detailed logging for troubleshooting:

1. Check function logs:
```bash
supabase functions logs accessibility-test --tail
```

2. Review structured logs for:
   - Request validation errors
   - API call attempts and retries
   - Database operation results
   - Execution time metrics

3. Test with minimal request:
```bash
curl -X POST http://localhost:54321/functions/v1/accessibility-test \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "00000000-0000-0000-0000-000000000000",
    "targetUrl": "https://www.google.com",
    "strategy": "mobile"
  }'
```

### Performance Issues

If experiencing slow response times:

1. **Check PageSpeed API response time**: PageSpeed Insights typically takes 3-10 seconds
2. **Verify network connectivity**: Test from different environments
3. **Review database performance**: Check `generated_documents` table indexes
4. **Monitor function execution**: Use Supabase dashboard metrics
5. **Consider timeout adjustments**: Increase timeout for complex pages

## Performance Metrics

### Expected Response Times

- **URL Validation**: < 10ms
- **Database Interaction Creation**: 50-100ms
- **PageSpeed API Call**: 3,000-10,000ms (depends on target website)
- **Result Storage**: 100-200ms
- **Total Execution**: 3,500-11,000ms typical

### Resource Usage

- **Memory**: ~50MB per execution
- **CPU**: Minimal (I/O bound operation)
- **Database Connections**: 1 connection per request
- **API Calls**: 1 PageSpeed API call per request

### Optimization Tips

1. **Frontend optimization**: Implement client-side caching of recent test results
2. **Batch testing**: Plan bulk tests during off-peak hours
3. **Category selection**: Test only required categories to reduce API response time
4. **Result reuse**: Check for recent test results before running new tests

## Database Schema

The function interacts with two main tables:

### ai_interactions

Tracks each accessibility test execution:

```sql
INSERT INTO ai_interactions (
  project_id,
  operation_type,        -- 'accessibility_test'
  model_used,            -- 'pagespeed-insights-api'
  input_tokens,          -- 0 (external API)
  output_tokens,         -- 0
  total_tokens,          -- 0
  estimated_cost,        -- 0.0
  cost_usd,              -- 0.0
  response_metadata      -- JSONB with test parameters
)
```

### generated_documents

Stores complete test results:

```sql
INSERT INTO generated_documents (
  project_id,
  ai_interaction_id,
  document_type,         -- 'accessibility-test-result'
  document_name,         -- 'Accessibility Test - {url} - {date}'
  version,               -- 1
  is_current_version,    -- false
  content,               -- JSON.stringify(complete PageSpeed result)
  raw_content,           -- JSON.stringify(lighthouseResult)
  content_format,        -- 'json'
  validation_results     -- JSONB with extracted metrics
)
```

## Module Structure

```
supabase/functions/accessibility-test/
├── index.ts                      # Main entry point and request handler
├── types.ts                      # TypeScript interfaces and types
├── config.ts                     # Configuration constants
├── pagespeed-client.ts          # PageSpeed API client service
├── database-service.ts          # Database operations service
├── deno.json                    # Deno configuration
└── utils/
    ├── validation.ts            # Request validation logic
    ├── url-validator.ts         # URL validation utility
    ├── response-formatter.ts    # Response formatting utilities
    └── api-error.ts            # Custom error classes
```

## Security Considerations

1. **API Key Protection**: RapidAPI key never exposed to frontend
2. **Input Validation**: All inputs validated before processing
3. **URL Restrictions**: Localhost and private IPs blocked
4. **Authentication Required**: All requests must include valid JWT
5. **RLS Enforcement**: Database operations respect Row Level Security
6. **Timeout Protection**: 55-second limit prevents resource exhaustion
7. **Error Sanitization**: Error messages don't expose internal details

## Future Enhancements

Planned features for future versions:

- Scheduled automatic testing (daily/weekly)
- Bulk URL testing for entire sitemaps
- Historical trend analysis and reporting
- Email notifications for failing tests
- Custom WCAG rule configuration
- Integration with CI/CD pipelines
- Comparison between test runs
- PDF report generation

## Support and Resources

- **PageSpeed Insights API Docs**: [RapidAPI Documentation](https://rapidapi.com/apiflash/api/pagespeed-insights)
- **Supabase Edge Functions**: [Official Documentation](https://supabase.com/docs/guides/functions)
- **Lighthouse Documentation**: [Google Lighthouse](https://developers.google.com/web/tools/lighthouse)
- **WCAG Guidelines**: [W3C WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)

## Contributing

When contributing to this function:

1. Follow existing code structure and patterns
2. Add comprehensive error handling
3. Update documentation for API changes
4. Add tests for new functionality
5. Maintain TypeScript strict mode compliance
6. Follow the project's code style guide

## License

This Edge Function is part of the DR_AI Workforce project.
