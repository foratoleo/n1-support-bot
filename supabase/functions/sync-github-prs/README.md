# sync-github-prs Edge Function

Supabase Edge Function for synchronizing GitHub Pull Requests, Reviews, Comments, and Commits with the DR_AI Workforce database.

---

## Purpose

This Edge Function provides a robust, production-ready service for syncing GitHub repository activity into the application database. It supports both incremental and full synchronization modes with built-in rate limiting, retry logic, and comprehensive error handling.

**Key Features:**
- Single repository or batch synchronization
- Incremental sync using cursor-based pagination
- Automatic rate limit detection and backoff
- Parallel data fetching for performance
- Comprehensive error tracking and logging
- Idempotent operations (safe to re-run)

---

## Request/Response Format

### Request

**Endpoint:**
```
POST https://[project-ref].supabase.co/functions/v1/sync-github-prs
```

**Headers:**
```
Authorization: Bearer <supabase-jwt-token>
Content-Type: application/json
```

**Body:**
```typescript
{
  repository_id?: string;      // Optional: Repository ID to sync
  force_full_sync?: boolean;   // Optional: Ignore cursor, sync all (default: false)
  max_prs?: number;            // Optional: Limit PRs to sync (default: 50)
  max_pages?: number;          // Optional: Max pages per entity (default: 5)
}
```

**Examples:**

*Sync Single Repository (Incremental):*
```json
{
  "repository_id": "123"
}
```

*Sync Single Repository (Full Sync):*
```json
{
  "repository_id": "123",
  "force_full_sync": true,
  "max_prs": 100
}
```

*Sync All Due Repositories:*
```json
{}
```

### Response

**Success Response:**
```typescript
{
  success: boolean;
  summary: {
    repositories_synced: number;
    pull_requests_synced: number;
    reviews_synced: number;
    comments_synced: number;
    commits_synced: number;
    errors: Array<{
      repository_id?: string;
      pr_number?: number;
      message: string;
      type: 'authentication' | 'rate_limit' | 'not_found' |
            'validation' | 'network' | 'database' | 'unknown';
      timestamp: string;
    }>;
    started_at: string;       // ISO 8601 timestamp
    completed_at: string;     // ISO 8601 timestamp
    duration_ms: number;
  };
  error?: string;             // Present if success=false
}
```

**Example Success:**
```json
{
  "success": true,
  "summary": {
    "repositories_synced": 1,
    "pull_requests_synced": 15,
    "reviews_synced": 42,
    "comments_synced": 78,
    "commits_synced": 156,
    "errors": [],
    "started_at": "2025-12-08T10:00:00Z",
    "completed_at": "2025-12-08T10:02:15Z",
    "duration_ms": 135000
  }
}
```

**Example Error:**
```json
{
  "success": false,
  "summary": {
    "repositories_synced": 0,
    "pull_requests_synced": 0,
    "reviews_synced": 0,
    "comments_synced": 0,
    "commits_synced": 0,
    "errors": [
      {
        "message": "Sync configuration not found for repository: 999",
        "type": "validation",
        "timestamp": "2025-12-08T10:00:05Z"
      }
    ],
    "started_at": "2025-12-08T10:00:00Z",
    "completed_at": "2025-12-08T10:00:05Z",
    "duration_ms": 5000
  },
  "error": "Sync configuration not found for repository: 999"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success (check `success` field for partial failures) |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (missing/invalid token) |
| 405 | Method Not Allowed (only POST supported) |
| 500 | Internal Server Error |

---

## Configuration Requirements

### Environment Variables

The following Supabase secrets must be configured before deployment:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL (auto-injected) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for RLS bypass (auto-injected) |

**Note:** GitHub tokens are stored per-repository in the `github_sync_config` table, not as environment variables.

### Database Setup

Ensure the following tables exist (created by migration):
- `github_sync_config`
- `github_pull_requests`
- `github_pr_reviews`
- `github_pr_comments`
- `github_pr_commits`
- `github_sync_log`

**Migration File:**
`/supabase/migrations/20251208_create_github_pr_tables.sql`

### GitHub Configuration

Each repository requires configuration in `github_sync_config`:

```sql
INSERT INTO public.github_sync_config (
  repository_id,
  github_token_encrypted,
  sync_enabled,
  sync_frequency
) VALUES (
  123,                          -- Repository ID from project_git_repositories
  'ghp_xxxxxxxxxxxxx',          -- GitHub Personal Access Token
  true,                         -- Enable sync
  'manual'                      -- Sync frequency: manual, hourly, daily, realtime
);
```

**GitHub Token Requirements:**
- Personal Access Token or GitHub App token
- Required scopes:
  - `repo` (full repository access)
  - `read:org` (if syncing organization repositories)
- Fine-grained tokens:
  - Pull requests: Read-only
  - Contents: Read-only
  - Metadata: Read-only

---

## Manual Trigger Examples

### Using curl

**Sync Single Repository:**
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/sync-github-prs \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": "123",
    "force_full_sync": false
  }'
```

**Full Sync with Higher Limits:**
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/sync-github-prs \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repository_id": "123",
    "force_full_sync": true,
    "max_prs": 100,
    "max_pages": 10
  }'
```

**Sync All Due Repositories:**
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/sync-github-prs \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using Supabase Client (JavaScript)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Sync single repository
const { data, error } = await supabase.functions.invoke('sync-github-prs', {
  body: {
    repository_id: '123',
    force_full_sync: false
  }
});

if (error) {
  console.error('Sync failed:', error);
} else {
  console.log('Sync summary:', data.summary);
}
```

### Using Supabase Client (TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

interface SyncRequest {
  repository_id?: string;
  force_full_sync?: boolean;
  max_prs?: number;
  max_pages?: number;
}

interface SyncResponse {
  success: boolean;
  summary: {
    repositories_synced: number;
    pull_requests_synced: number;
    reviews_synced: number;
    comments_synced: number;
    commits_synced: number;
    errors: any[];
    started_at: string;
    completed_at: string;
    duration_ms: number;
  };
  error?: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const syncRepository = async (repositoryId: string): Promise<SyncResponse> => {
  const { data, error } = await supabase.functions.invoke<SyncResponse>(
    'sync-github-prs',
    {
      body: {
        repository_id: repositoryId,
      } as SyncRequest,
    }
  );

  if (error) throw error;
  return data as SyncResponse;
};

// Usage
try {
  const result = await syncRepository('123');
  console.log(`Synced ${result.summary.pull_requests_synced} PRs`);
} catch (error) {
  console.error('Sync failed:', error);
}
```

---

## Deployment

### Prerequisites

1. **Supabase CLI Installed:**
   ```bash
   npm install -g supabase
   ```

2. **Authenticated with Supabase:**
   ```bash
   supabase login
   ```

3. **Project Linked:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

### Deploy Command

**Deploy to Production:**
```bash
supabase functions deploy sync-github-prs
```

**Deploy to Specific Project:**
```bash
supabase functions deploy sync-github-prs --project-ref your-project-ref
```

**Verify Deployment:**
```bash
supabase functions list
```

Expected output:
```
┌──────────────────┬─────────────┬────────────────────────┐
│ Name             │ Status      │ Updated                │
├──────────────────┼─────────────┼────────────────────────┤
│ sync-github-prs  │ deployed    │ 2025-12-08 10:00:00    │
└──────────────────┴─────────────┴────────────────────────┘
```

### View Logs

**Real-time Logs:**
```bash
supabase functions logs sync-github-prs --tail
```

**Historical Logs:**
```bash
supabase functions logs sync-github-prs --limit 100
```

**Filter by Time:**
```bash
supabase functions logs sync-github-prs --since 1h
```

---

## Testing

### Local Testing

1. **Start Supabase Locally:**
   ```bash
   supabase start
   ```

2. **Serve Function Locally:**
   ```bash
   supabase functions serve sync-github-prs
   ```

3. **Test with curl:**
   ```bash
   curl -X POST http://localhost:54321/functions/v1/sync-github-prs \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"repository_id": "123"}'
   ```

### Integration Testing

Create a test script:

```typescript
// test-sync.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function testSync() {
  console.log('Testing GitHub PR sync...');

  // Test 1: Sync single repository
  const { data, error } = await supabase.functions.invoke('sync-github-prs', {
    body: {
      repository_id: '123',
      max_prs: 5  // Limit for testing
    }
  });

  if (error) {
    console.error('Test failed:', error);
    return;
  }

  console.log('Test passed!');
  console.log('Summary:', data.summary);

  // Verify PRs in database
  const { data: prs } = await supabase
    .from('github_pull_requests')
    .select('*')
    .eq('repository_id', 123)
    .limit(5);

  console.log(`Found ${prs?.length} PRs in database`);
}

testSync();
```

Run test:
```bash
npx tsx test-sync.ts
```

### Validation Checklist

- [ ] Function deploys without errors
- [ ] Configuration exists in `github_sync_config`
- [ ] GitHub token is valid and has required scopes
- [ ] Repository URL is correct in `project_git_repositories`
- [ ] Sync completes successfully
- [ ] PRs appear in `github_pull_requests` table
- [ ] Reviews appear in `github_pr_reviews` table
- [ ] Comments appear in `github_pr_comments` table
- [ ] Commits appear in `github_pr_commits` table
- [ ] Sync log entry created in `github_sync_log`
- [ ] Cursor updated in `github_sync_config`
- [ ] Incremental sync fetches only new/updated PRs
- [ ] Full sync re-fetches all PRs
- [ ] Rate limiting triggers backoff when needed
- [ ] Errors are logged correctly

---

## Performance Tuning

### Default Configuration

```typescript
// In config.ts
DEFAULT_MAX_PAGES_PER_ENTITY = 5;      // Pages to fetch per entity
DEFAULT_ITEMS_PER_PAGE = 100;          // Items per page (GitHub max)
MAX_PRS_PER_SYNC = 50;                 // Max PRs to process
MAX_CONCURRENT_REQUESTS = 5;            // Parallel requests
BATCH_DELAY_MS = 1000;                 // Delay between batches
```

### Optimization Strategies

**1. Increase Concurrency (Watch Rate Limits):**
```typescript
// Modify in sync-orchestrator.ts
MAX_CONCURRENT_REQUESTS = 10;  // Up from 5
BATCH_DELAY_MS = 500;          // Down from 1000ms
```

**2. Increase Sync Limits:**
```json
{
  "repository_id": "123",
  "max_prs": 100,      // Up from 50
  "max_pages": 10      // Up from 5
}
```

**3. Use Incremental Sync:**
```json
{
  "repository_id": "123",
  "force_full_sync": false  // Only fetch updated PRs
}
```

### Expected Performance

| PRs | Reviews | Comments | Duration |
|-----|---------|----------|----------|
| 10  | ~30     | ~50      | ~30s     |
| 25  | ~75     | ~125     | ~1m 30s  |
| 50  | ~150    | ~250     | ~3m      |
| 100 | ~300    | ~500     | ~6m      |

**Note:** Actual duration depends on:
- Number of reviews/comments per PR
- GitHub API response time
- Network latency
- Rate limit status

---

## Troubleshooting

### Common Issues

**Issue: "Sync configuration not found"**

*Solution:*
```sql
-- Create configuration
INSERT INTO github_sync_config (repository_id, github_token_encrypted, sync_enabled)
VALUES (123, 'ghp_xxxxx', true);
```

**Issue: "Authentication failed" (401)**

*Solution:*
1. Verify GitHub token:
   ```bash
   curl -H "Authorization: Bearer ghp_xxxxx" https://api.github.com/user
   ```
2. Update token in database:
   ```sql
   UPDATE github_sync_config
   SET github_token_encrypted = 'ghp_new_token'
   WHERE repository_id = 123;
   ```

**Issue: "Rate limit exceeded" (403/429)**

*Solution:*
1. Check rate limit status:
   ```bash
   curl -H "Authorization: Bearer ghp_xxxxx" https://api.github.com/rate_limit
   ```
2. Wait for reset or reduce sync scope:
   ```json
   {
     "repository_id": "123",
     "max_prs": 10
   }
   ```

**Issue: No PRs synced but no errors**

*Solution:*
1. Force full sync to reset cursor:
   ```json
   {
     "repository_id": "123",
     "force_full_sync": true
   }
   ```
2. Verify PRs exist on GitHub:
   ```bash
   curl -H "Authorization: Bearer ghp_xxxxx" \
     https://api.github.com/repos/OWNER/REPO/pulls?state=all
   ```

### Debug Mode

Enable detailed logging by checking Edge Function logs:

```bash
# Real-time logs
supabase functions logs sync-github-prs --tail

# Look for:
# - [sync-github-prs] operation identifier
# - Request URLs and parameters
# - Response status codes
# - Error messages and stack traces
```

### Health Check

Query sync log for recent activity:

```sql
SELECT
  started_at,
  sync_status,
  prs_synced,
  reviews_synced,
  (completed_at - started_at) as duration
FROM github_sync_log
ORDER BY started_at DESC
LIMIT 10;
```

---

## Architecture

### File Structure

```
supabase/functions/sync-github-prs/
├── index.ts                  # Main Edge Function entry point
├── config.ts                 # Configuration constants and types
├── sync-orchestrator.ts      # Sync workflow orchestration
└── README.md                 # This file

supabase/functions/_shared/
├── github/
│   ├── client.ts            # GitHub API client with rate limiting
│   ├── types.ts             # TypeScript interfaces for GitHub API
│   ├── pagination.ts        # Pagination utilities
│   ├── rate-limiter.ts      # Rate limit tracking and backoff
│   ├── retry.ts             # Retry logic with exponential backoff
│   ├── error-handler.ts     # Error handling utilities
│   └── url-parser.ts        # GitHub URL parsing
├── supabase/
│   └── client.ts            # Supabase client factory
└── cors.ts                  # CORS headers for Edge Functions
```

### Component Responsibilities

**index.ts:**
- HTTP request/response handling
- Input validation
- CORS support
- Error response formatting

**sync-orchestrator.ts:**
- Sync workflow coordination
- Repository configuration fetching
- PR data fetching and processing
- Database upserts
- Sync cursor management
- Logging

**GitHubClient (_shared/github/client.ts):**
- GitHub API authentication
- Rate limit detection and backoff
- Retry logic with exponential backoff
- Pagination support
- Request/response handling

---

## Related Documentation

- **Feature Documentation:** `/docs/features/github-pr-sync.md`
- **Database Schema:** `/docs/schema.md`
- **Edge Functions Guide:** `/docs/deployment/edge-functions.md`
- **GitHub API Reference:** https://docs.github.com/en/rest
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions

---

## Support

For issues or questions:
1. Check Edge Function logs: `supabase functions logs sync-github-prs --tail`
2. Review sync log in database: `SELECT * FROM github_sync_log ORDER BY started_at DESC LIMIT 10;`
3. Verify configuration: `SELECT * FROM github_sync_config WHERE repository_id = 123;`
4. Test GitHub token: `curl -H "Authorization: Bearer ghp_xxxxx" https://api.github.com/user`
5. Check rate limits: `curl -H "Authorization: Bearer ghp_xxxxx" https://api.github.com/rate_limit`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-08 | Initial implementation with incremental sync support |
