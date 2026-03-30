# Deployment Guide - Service Call to Markdown

## Pre-Deployment Checklist

### 1. Environment Setup

Ensure you have the following installed:
- [x] Supabase CLI (`npm install -g supabase`)
- [x] Deno runtime (for local testing)
- [x] Valid Supabase project

### 2. Required Environment Variables

No additional environment variables are required. The function uses:
- `SUPABASE_URL` (automatically provided by Supabase)
- `SUPABASE_ANON_KEY` (automatically provided by Supabase)

### 3. Database Prerequisites

Ensure the `external_service_calls` table exists:

```sql
-- Verify table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'external_service_calls'
);

-- Check RLS policies
SELECT * FROM pg_policies
WHERE tablename = 'external_service_calls';
```

Expected columns:
- `id` (UUID, Primary Key)
- `project_id` (UUID, Foreign Key)
- `service_name` (TEXT)
- `service_category` (TEXT)
- `response_body` (JSONB)
- `response_status` (INTEGER)
- Additional metadata columns

## Local Testing

### Step 1: Start Supabase Locally

```bash
cd /path/to/dr-ai-workforce
supabase start
```

### Step 2: Serve the Function Locally

```bash
supabase functions serve service-call-to-markdown --env-file .env.local
```

The function will be available at: `http://localhost:54321/functions/v1/service-call-to-markdown`

### Step 3: Test with Sample Data

First, insert a test record into `external_service_calls`:

```sql
-- Insert test accessibility result
INSERT INTO external_service_calls (
  id,
  project_id,
  service_name,
  service_category,
  endpoint_path,
  operation_type,
  request_method,
  request_url,
  response_body,
  response_status,
  execution_time_ms
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'YOUR_PROJECT_ID',
  'pagespeed',
  'quality',
  '/run_pagespeed',
  'test',
  'GET',
  'https://pagespeed-api.example.com',
  '{
    "score": 92,
    "audits": { ... },
    "finalUrl": "https://example.com",
    "timestamp": "2025-11-09T22:59:25.427Z"
  }'::jsonb,
  200,
  5000
);
```

Then test the function:

```bash
# Test valid request
curl -X POST http://localhost:54321/functions/v1/service-call-to-markdown \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "serviceName": "pagespeed",
    "serviceCategory": "quality"
  }'

# Test with invalid UUID
curl -X POST http://localhost:54321/functions/v1/service-call-to-markdown \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "invalid-uuid"
  }'

# Test with non-existent ID
curl -X POST http://localhost:54321/functions/v1/service-call-to-markdown \
  -H 'Authorization: Bearer YOUR_LOCAL_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "00000000-0000-0000-0000-000000000000"
  }'
```

### Step 4: Verify Output

Expected successful response:

```json
{
  "success": true,
  "markdown": "# Accessibility Test Report\n\n...",
  "metadata": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "serviceName": "pagespeed",
    "serviceCategory": "quality",
    "generatedAt": "2025-11-09T23:00:00.000Z"
  },
  "executionTime": 245
}
```

## Production Deployment

### Step 1: Link to Supabase Project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 2: Deploy the Function

```bash
supabase functions deploy service-call-to-markdown
```

### Step 3: Verify Deployment

```bash
# Check function status
supabase functions list

# Check function logs
supabase functions logs service-call-to-markdown
```

### Step 4: Test Production Endpoint

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/service-call-to-markdown \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "REAL_SERVICE_CALL_ID"
  }'
```

## Testing Scenarios

### 1. Happy Path - Accessibility Test

```bash
# Request
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "serviceName": "pagespeed",
  "serviceCategory": "quality"
}

# Expected: 200 OK with markdown report
```

### 2. Validation Errors

#### Invalid UUID Format
```bash
# Request
{"id": "not-a-uuid"}

# Expected: 400 Bad Request
{
  "success": false,
  "error": "id must be a valid UUID",
  "code": "ValidationError",
  "details": {"field": "id"}
}
```

#### Missing Required Field
```bash
# Request
{"serviceName": "pagespeed"}

# Expected: 400 Bad Request
{
  "success": false,
  "error": "id is required and must be a string",
  "code": "ValidationError"
}
```

#### Service Name Mismatch
```bash
# Request
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "serviceName": "lighthouse"
}

# Expected: 400 Bad Request (if actual service is 'pagespeed')
{
  "success": false,
  "error": "Service name mismatch...",
  "code": "ValidationError"
}
```

### 3. Not Found Errors

```bash
# Request
{"id": "00000000-0000-0000-0000-000000000000"}

# Expected: 404 Not Found
{
  "success": false,
  "error": "Service call with ID 00000000-0000-0000-0000-000000000000 not found",
  "code": "NotFoundError"
}
```

### 4. Unsupported Service

```bash
# Request with service that has no formatter
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
# Where the record has service_category='seo', service_name='semrush'

# Expected: 400 Bad Request
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

## Performance Testing

### Load Test Script

```bash
#!/bin/bash
# load-test.sh

FUNCTION_URL="https://YOUR_PROJECT_REF.supabase.co/functions/v1/service-call-to-markdown"
AUTH_TOKEN="YOUR_JWT_TOKEN"
SERVICE_CALL_ID="550e8400-e29b-41d4-a716-446655440000"

echo "Running load test with 10 concurrent requests..."

for i in {1..10}; do
  (
    response=$(curl -s -w "\nTime: %{time_total}s\n" -X POST "$FUNCTION_URL" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"id\": \"$SERVICE_CALL_ID\"}")
    echo "Request $i: $response"
  ) &
done

wait
echo "Load test completed"
```

Expected performance:
- **Response time**: < 500ms for typical accessibility reports
- **Concurrent requests**: Handles 10+ concurrent requests
- **Memory usage**: < 128MB per invocation

## Monitoring

### Key Metrics to Monitor

1. **Invocation Rate**
   - Monitor function invocation frequency
   - Alert on unusual spikes

2. **Error Rate**
   - Track ValidationError, NotFoundError, DatabaseError rates
   - Alert on error rate > 5%

3. **Execution Time**
   - P50: < 300ms
   - P95: < 800ms
   - P99: < 2000ms

4. **Timeout Rate**
   - Should be < 0.1%
   - Investigate if higher

### Log Analysis

```bash
# View recent logs
supabase functions logs service-call-to-markdown --tail

# Filter for errors
supabase functions logs service-call-to-markdown | grep "error"

# Check specific time range
supabase functions logs service-call-to-markdown --since "2025-11-09 20:00:00"
```

### Common Log Patterns

Success:
```
Service call to markdown request received: {id: "...", serviceName: "pagespeed"}
Fetching service call record... {id: "..."}
Service call found: {id: "...", serviceName: "pagespeed", status: 200}
Formatter selected: {serviceCategory: "quality", serviceName: "pagespeed"}
Generating markdown...
Markdown generated successfully {length: 15420, id: "..."}
Service call to markdown completed successfully {executionTime: 245}
```

Error:
```
Edge function error: {
  error: "Service call with ID ... not found",
  errorType: "NotFoundError",
  executionTime: 45
}
```

## Rollback Procedure

If issues are detected after deployment:

### 1. Quick Rollback (Re-deploy Previous Version)

```bash
# Deploy from previous commit
git checkout HEAD~1 supabase/functions/service-call-to-markdown/
supabase functions deploy service-call-to-markdown
git checkout HEAD supabase/functions/service-call-to-markdown/
```

### 2. Emergency Disable

If the function is causing critical issues:

```bash
# Delete the function (can be re-deployed later)
supabase functions delete service-call-to-markdown

# Re-deploy when fixed
supabase functions deploy service-call-to-markdown
```

## Post-Deployment Verification

### Checklist

- [ ] Function deploys successfully without errors
- [ ] Test endpoint responds to valid requests
- [ ] Error handling works for invalid requests
- [ ] Markdown output is correctly formatted
- [ ] Response times are within acceptable range
- [ ] No errors in function logs
- [ ] RLS policies are enforced correctly
- [ ] CORS headers are present in responses
- [ ] Timeout protection is working

### Integration Tests

Test the function in the context of your application:

```typescript
// Example integration test
describe('Service Call to Markdown Integration', () => {
  it('should convert accessibility test to markdown', async () => {
    // 1. Run accessibility test
    const testResult = await runAccessibilityTest('https://example.com');

    // 2. Convert to markdown
    const { data } = await supabase.functions.invoke(
      'service-call-to-markdown',
      { body: { id: testResult.documentId } }
    );

    // 3. Verify markdown content
    expect(data.success).toBe(true);
    expect(data.markdown).toContain('# Accessibility Test Report');
    expect(data.markdown).toContain('Overall accessibility score');
    expect(data.metadata.id).toBe(testResult.documentId);
  });
});
```

## Troubleshooting

### Issue: Function timeout

**Symptoms**: Requests consistently time out after 55 seconds

**Solutions**:
1. Check database query performance
2. Verify response_body size isn't excessively large
3. Review formatter implementation for performance bottlenecks

### Issue: RLS policy errors

**Symptoms**: "Service call not found" for records that exist

**Solutions**:
1. Verify RLS policies on `external_service_calls` table
2. Check JWT token is valid and contains correct user ID
3. Ensure user has permission to access the project

### Issue: Markdown formatting broken

**Symptoms**: Markdown output is malformed

**Solutions**:
1. Verify response_body JSON structure matches expected format
2. Check formatter implementation for edge cases
3. Test with minimal response body to isolate issue

## Support

For issues or questions:
1. Check function logs: `supabase functions logs service-call-to-markdown`
2. Review [README.md](./README.md) for usage examples
3. Test locally to reproduce issue
4. Check database for data integrity issues
