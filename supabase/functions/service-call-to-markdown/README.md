# Service Call to Markdown Edge Function

Converts external service call results from the `external_service_calls` table to formatted Markdown documents.

## Overview

This Edge Function retrieves service call data by ID and converts the response body JSON to human-readable Markdown format. It supports multiple service types through a formatter factory pattern, making it easily extensible for future service integrations.

## Features

- **Type-Safe**: Full TypeScript implementation with comprehensive type definitions
- **Extensible**: Formatter factory pattern allows easy addition of new service formatters
- **Secure**: RLS-compliant database queries with proper authentication
- **Error Handling**: Comprehensive error handling with detailed error responses
- **Performance**: Timeout protection and optimized database queries
- **CORS Support**: Proper CORS headers for cross-origin requests

## Supported Services

Currently supported services:

- **Quality/Accessibility**: `pagespeed` - PageSpeed Insights accessibility tests
  - Generates comprehensive accessibility reports with WCAG compliance levels
  - Categorizes issues by severity (critical, warnings, passed)
  - Provides detailed audit results grouped by category
  - Includes recommendations and resources

### Future Services (Extensible)

The architecture supports adding formatters for:
- Performance tests (Lighthouse, WebPageTest)
- SEO audits (PageSpeed SEO, SEMrush)
- Security scans (OWASP, SSL Labs)
- Load tests (JMeter, k6)

## API Specification

### Endpoint

```
POST /service-call-to-markdown
```

### Request Headers

```
Authorization: Bearer <supabase-jwt-token>
Content-Type: application/json
```

### Request Body

```typescript
{
  id: string;              // Required: UUID of the service call record
  serviceName?: string;    // Optional: Filter by service name (e.g., 'pagespeed')
  serviceCategory?: string; // Optional: Filter by category (e.g., 'quality')
}
```

### Success Response (200 OK)

```typescript
{
  success: true,
  markdown: string,        // Generated Markdown document
  metadata: {
    id: string,           // Service call ID
    serviceName: string,  // Service name
    serviceCategory: string, // Service category
    generatedAt: string,  // ISO timestamp
    requestUrl?: string,  // Original request URL
    timestamp?: string    // Original test timestamp
  },
  executionTime: number   // Execution time in milliseconds
}
```

### Error Responses

#### 400 Bad Request - Validation Error

```json
{
  "success": false,
  "error": "id must be a valid UUID",
  "code": "ValidationError",
  "details": {
    "field": "id"
  }
}
```

#### 400 Bad Request - Unsupported Service

```json
{
  "success": false,
  "error": "No formatter available for service: seo/semrush",
  "code": "UnsupportedServiceError",
  "details": {
    "serviceName": "semrush",
    "serviceCategory": "seo"
  }
}
```

#### 404 Not Found

```json
{
  "success": false,
  "error": "Service call with ID abc123 not found",
  "code": "NotFoundError"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Failed to query service call: <details>",
  "code": "DatabaseError",
  "details": {
    "operation": "select"
  }
}
```

## Usage Examples

### JavaScript/TypeScript (Frontend)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function convertToMarkdown(serviceCallId: string) {
  const { data, error } = await supabase.functions.invoke(
    'service-call-to-markdown',
    {
      body: {
        id: serviceCallId,
        serviceName: 'pagespeed',      // Optional filter
        serviceCategory: 'quality'      // Optional filter
      }
    }
  );

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Markdown:', data.markdown);
  console.log('Metadata:', data.metadata);

  // Use the markdown (e.g., display in UI, save to file, etc.)
  return data.markdown;
}
```

### cURL

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/service-call-to-markdown' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "serviceName": "pagespeed",
    "serviceCategory": "quality"
  }'
```

### React Component Example

```tsx
import { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

function AccessibilityReportViewer({ serviceCallId }: { serviceCallId: string }) {
  const supabase = useSupabaseClient();
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'service-call-to-markdown',
        {
          body: {
            id: serviceCallId,
            serviceCategory: 'quality'
          }
        }
      );

      if (invokeError) throw invokeError;

      setMarkdown(data.markdown);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={loadReport} disabled={loading}>
        {loading ? 'Loading...' : 'Load Report'}
      </button>

      {error && <div className="error">{error}</div>}

      {markdown && (
        <ReactMarkdown>{markdown}</ReactMarkdown>
      )}
    </div>
  );
}
```

## Database Schema

The function queries the `external_service_calls` table:

```sql
CREATE TABLE external_service_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  service_name TEXT NOT NULL,
  service_category TEXT NOT NULL,
  endpoint_path TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  request_method TEXT NOT NULL,
  request_url TEXT NOT NULL,
  request_headers JSONB,
  request_parameters JSONB,
  response_body JSONB,
  response_status INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## Markdown Output Format

### Accessibility Test Report

```markdown
# Accessibility Test Report

**URL**: https://example.com
**Score**: 92/100
**Tested**: November 9, 2025, 10:59:25 PM UTC
**Service**: pagespeed (quality)

**WCAG Conformance Level**: AA (Good)

## Summary

Overall accessibility score: **92%** ✅

- Total audits: **72**
- Passed: **65** ✅
- Failed: **2** ❌
- Warnings: **3** ⚠️
- Not applicable: **2** ⚪

## Critical Issues (2)

### Links without comprehensible names

**Score**: 0/100 ❌
**Impact**: 🟠 Serious

Links must have descriptive text...

**Failing elements** (4):
1. `div.container > div.mt-8 > div.flex > a.text-gray-500`
   ```html
   <a class="text-gray-500 hover:text-brand-orange" href="/">
   ```
   Element is in tab order and does not have accessible text

...

## Warnings (3)

### Color Contrast

...

## Passed Audits (65)

- ✅ ARIA attributes are valid
- ✅ Buttons have accessible names
...

## Detailed Audit Results

### ARIA Attributes
- **ARIA attributes are valid**: 100/100 ✅
- **ARIA roles are valid**: 100/100 ✅
...

### Names and Labels
- **Buttons have accessible names**: 100/100 ✅
- **Links have comprehensible names**: 0/100 ❌
...

## Recommendations

### Priority Actions

1. **Fix Critical Issues First**: Address the 2 critical accessibility issues
2. **Address Warnings**: Resolve the 3 warning-level issues
3. **Test with Assistive Technology**: Verify fixes using screen readers
...

---

**Report generated by**: pagespeed
**Report ID**: 550e8400-e29b-41d4-a716-446655440000
**Generated at**: November 9, 2025, 10:59:25 PM UTC
```

## Development

### Adding a New Formatter

1. Create a new formatter class extending `BaseFormatter`:

```typescript
// formatters/performance-formatter.ts
import { BaseFormatter } from './base.ts';
import { ServiceCallMetadata } from '../types.ts';

export class PerformanceFormatter extends BaseFormatter {
  format(responseBody: any, metadata: ServiceCallMetadata): string {
    // Implement your formatting logic
    return markdown;
  }
}
```

2. Register the formatter in the factory:

```typescript
// formatters/factory.ts
import { PerformanceFormatter } from './performance-formatter.ts';

// In FormatterFactory.formatters Map
['performance:lighthouse', () => new PerformanceFormatter()],
```

3. Add type definitions if needed:

```typescript
// types.ts
export interface PerformanceResult {
  // Your type definitions
}
```

### Testing Locally

```bash
# Start Supabase locally
supabase start

# Serve the function
supabase functions serve service-call-to-markdown --env-file .env.local

# Test with curl
curl -X POST http://localhost:54321/functions/v1/service-call-to-markdown \
  -H 'Authorization: Bearer YOUR_LOCAL_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"id": "YOUR_TEST_ID"}'
```

## Deployment

```bash
# Deploy to Supabase
supabase functions deploy service-call-to-markdown

# Set environment variables (if needed)
supabase secrets set CUSTOM_VAR=value
```

## Performance Considerations

- **Execution Time**: Typically 100-500ms depending on response body size
- **Timeout**: 55 seconds maximum (Supabase limit: 60s)
- **Database**: Single query with RLS policy enforcement
- **Memory**: Efficient markdown generation without large intermediate structures

## Security

- **Authentication**: Requires valid Supabase JWT token
- **RLS Policies**: Respects Row Level Security on `external_service_calls` table
- **Input Validation**: Comprehensive validation of all inputs
- **Error Handling**: No sensitive data leaked in error messages
- **CORS**: Configured for secure cross-origin requests

## Monitoring

The function logs structured data for monitoring:

```json
{
  "timestamp": "2025-11-09T22:59:25.427Z",
  "event": "markdown_generated",
  "serviceCallId": "550e8400-e29b-41d4-a716-446655440000",
  "serviceName": "pagespeed",
  "serviceCategory": "quality",
  "executionTime": 245,
  "markdownLength": 15420
}
```

## Troubleshooting

### "Service call not found" error

- Verify the ID exists in `external_service_calls` table
- Check RLS policies allow the user to access the record
- Ensure the user is authenticated

### "No formatter available" error

- Check if the service/category combination is supported
- See `FormatterFactory.getSupportedServices()` for available formatters
- Consider adding a custom formatter for the service

### Timeout errors

- Check response body size (very large responses may take longer)
- Verify database connection is healthy
- Review function logs for bottlenecks

## License

Part of the dr-ai-workforce project.
