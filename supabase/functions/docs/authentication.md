# Authentication

Authentication requirements for API endpoints.

## Headers

All requests require the following headers:

```
Authorization: Bearer <token>
Content-Type: application/json
```

## Token Types

### Supabase Anon Key

Public key for client-side requests with Row Level Security (RLS):

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "list", "project_id": "uuid"}'
```

### Supabase Service Role Key

Full access key for server-side/admin operations (bypasses RLS):

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/api-tasks' \
  -H 'Authorization: Bearer <service-role-key>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "create", "project_id": "uuid", "title": "Task"}'
```

## Authentication Modes

### No Authentication Required

Some endpoints are designed for external integrations and do not require authentication:

- `api-tasks`
- `api-backlog-items`
- `api-features`

These endpoints should have rate limiting configured at the infrastructure level.

### Supabase Auth Required

Document generation endpoints require valid Supabase authentication:

- `create-prd`
- `create-user-story`
- `create-meeting-notes`
- `create-technical-specs`
- `create-test-cases`

## CORS

All endpoints support CORS for browser requests:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Allow-Methods: POST, OPTIONS`

OPTIONS requests return 200 with CORS headers for preflight.

## Error Responses

### Missing Authorization

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization header",
    "retryable": false
  }
}
```

### Invalid Token

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Invalid or expired token",
    "retryable": false
  }
}
```

## Security Notes

- Never expose service role keys in client-side code
- Use anon key for frontend applications
- Implement rate limiting for public endpoints
- All sensitive data transmitted over HTTPS only
