# MS Token Refresh Edge Function

Proactively refreshes Microsoft OAuth tokens before they expire, maintaining the rolling 90-day refresh token window.

## Overview

Microsoft refresh tokens have a 90-day rolling expiration. This function runs periodically (recommended: weekly) to refresh tokens before they expire, preventing users from having to re-authenticate.

### Token Lifecycle

```
Day 0:  User connects calendar → Refresh token issued (90-day expiry)
Day 7:  CRON runs → Token refreshed → NEW 90-day window starts
Day 14: CRON runs → Token refreshed → NEW 90-day window starts
...     (continues indefinitely as long as cron runs)
```

**Without proactive refresh**: Tokens expire after 90 days of inactivity, requiring re-authentication.

**With proactive refresh**: Tokens never expire as long as the cron job runs at least once every 90 days (recommended: weekly).

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (auto-set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-set) |
| `MS_OAUTH_CLIENT_ID` | Microsoft App Client ID |
| `MS_OAUTH_CLIENT_SECRET` | Microsoft App Client Secret |
| `ENCRYPTION_KEY` | 256-bit AES key for token encryption |

### Supabase Dashboard CRON Setup

1. Go to **Supabase Dashboard** → **Database** → **Extensions**
2. Enable `pg_cron` and `pg_net` extensions
3. Go to **SQL Editor** and run:

```sql
-- Configure environment (run once)
ALTER DATABASE postgres SET "app.supabase_url" = 'https://your-project.supabase.co';
ALTER DATABASE postgres SET "app.service_role_key" = 'your-service-role-key';

-- Create wrapper function
CREATE OR REPLACE FUNCTION refresh_ms_tokens_periodic()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
BEGIN
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key := current_setting('app.service_role_key', true);

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/ms-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('days_threshold', 14)
  );
END;
$$;

-- Schedule weekly execution (every Monday at 3 AM UTC)
SELECT cron.schedule(
  'ms-token-refresh-weekly',
  '0 3 * * 1',
  'SELECT refresh_ms_tokens_periodic()'
);
```

### Recommended CRON Schedules

| Frequency | CRON Expression | Risk Level | Description |
|-----------|-----------------|------------|-------------|
| Weekly | `0 3 * * 1` | Very Low | Every Monday at 3 AM (recommended) |
| Bi-weekly | `0 3 1,15 * *` | Low | 1st and 15th of each month |
| Monthly | `0 3 1 * *` | Medium | First day of each month |

## API Reference

### Request

```http
POST /functions/v1/ms-token-refresh
Authorization: Bearer <service_role_key>
Content-Type: application/json

{
  "days_threshold": 14,      // Refresh tokens expiring within N days
  "dry_run": false,          // If true, only report (no actual refresh)
  "connection_id": "uuid"    // Optional: refresh specific connection
}
```

### Response

```json
{
  "success": true,
  "dry_run": false,
  "days_threshold": 14,
  "total_connections": 25,
  "refreshed": 23,
  "revoked": 1,
  "errors": 1,
  "skipped": 0,
  "results": [
    {
      "connection_id": "uuid",
      "user_id": "uuid",
      "email": "user@example.com",
      "status": "refreshed",
      "old_expires_at": "2025-01-15T10:00:00Z",
      "new_expires_at": "2025-01-02T10:00:00Z"
    }
  ],
  "execution_time_ms": 3420
}
```

### Result Status Values

| Status | Description |
|--------|-------------|
| `refreshed` | Token successfully refreshed, new 90-day window |
| `revoked` | User revoked access, needs re-authentication |
| `error` | Refresh failed (network, API, encryption) |
| `skipped` | Dry run mode, no action taken |

## Monitoring

### Health Check View

```sql
SELECT * FROM view_token_refresh_health;
```

Returns metrics for the last 7 days:
- Total refresh attempts
- Success/failure counts
- Success rate percentage
- Last refresh timestamp

### Revoked Connections

```sql
SELECT * FROM view_revoked_calendar_connections;
```

Lists users who need to reconnect their calendar due to token revocation.

### Execution History

```sql
SELECT * FROM calendar_token_refresh_log
ORDER BY created_at DESC
LIMIT 100;
```

## Manual Execution

### Via curl (for testing)

```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/ms-token-refresh' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"days_threshold": 14, "dry_run": true}'
```

### Via Supabase CLI

```bash
supabase functions invoke ms-token-refresh \
  --body '{"days_threshold": 14, "dry_run": true}'
```

## Troubleshooting

### Common Issues

1. **All tokens showing as "revoked"**
   - User may have revoked app permissions in Microsoft account
   - App registration may have expired
   - Check Microsoft Entra admin portal

2. **Network errors**
   - Verify `MS_OAUTH_CLIENT_ID` and `MS_OAUTH_CLIENT_SECRET` are set
   - Check Supabase Edge Function logs

3. **Encryption errors**
   - Verify `ENCRYPTION_KEY` matches across all functions
   - Key must be 256-bit (64 hex characters)

### Log Cleanup

Remove old log entries (keeps last 90 days):

```sql
SELECT cleanup_token_refresh_logs(90);
```

## Security Considerations

- Function uses `SUPABASE_SERVICE_ROLE_KEY` - never expose to client
- Tokens are encrypted with AES-256-GCM before storage
- Refresh tokens are rotated on each refresh (old token invalidated)
- Failed attempts are logged for audit trail
