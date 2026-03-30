# JIRA → DR-AI Scheduled Sync Guide

Complete guide for setting up automated synchronization from JIRA to DR_AI using Supabase's native pg_cron extension.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Setup Instructions](#setup-instructions)
6. [Configuration Options](#configuration-options)
7. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
8. [Best Practices](#best-practices)
9. [Security Considerations](#security-considerations)

## Overview

The `sync-jira-to-drai` Edge Function enables automated synchronization **from JIRA to DR_AI**, discovering new JIRA issues and updating existing linked tasks.

### Key Features

- ✅ **JIRA Issue Discovery**: Automatically finds and imports new JIRA issues as DR-AI tasks
- ✅ **Multi-Project Support**: Sync all active projects when `projectId` is omitted
- ✅ **Temporal Filtering**: Use `updatedSince` to sync only recent changes
- ✅ **Status Exclusion**: Skip issues with specific statuses (e.g., Done, Closed)
- ✅ **Batch Processing**: Efficient parallel processing with configurable batch sizes
- ✅ **Continue-on-Error**: Individual failures don't stop the sync

### What It Does

1. **Fetches JIRA issues** using JQL queries (all issues in project or filtered by criteria)
2. **For each JIRA issue**:
   - If DR-AI task exists with this `jira_issue_key` → **Update** task fields
   - If no DR-AI task exists → **Create** new task from JIRA data
3. **Field Mapping**: Converts JIRA fields (summary, description, status, priority, etc.) to DR-AI schema
4. **ADF Conversion**: Converts Atlassian Document Format (rich text) to plain text

## Prerequisites

1. **Supabase Project**: With Edge Functions enabled
2. **pg_cron Extension**: Enabled in your Supabase database
3. **JIRA Configuration**: Active configuration in `jira_sync_config` table with:
   - JIRA URL (e.g., `https://yourcompany.atlassian.net`)
   - JIRA Project Key (e.g., `PROJ`)
   - JIRA Email
   - API Token (encrypted)
4. **Proper Permissions**: Service role key or appropriate RLS policies

## Quick Start

### 1. Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2. Create Cron Job (Hourly Incremental Sync)

```sql
-- Sync JIRA issues updated in last 2 hours, every hour at :05
SELECT cron.schedule(
  'jira-hourly-from-jira',
  '5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-jira-to-drai',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'filters', jsonb_build_object(
          'updatedSince', (NOW() - INTERVAL '2 hours')::TEXT,
          'excludeStatuses', jsonb_build_array('Done', 'Closed')
        )
      )
    )
  $$
);
```

### 3. Verify Cron Job

```sql
-- List all scheduled jobs
SELECT * FROM cron.job WHERE jobname LIKE 'jira%';

-- View job execution history
SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'jira%')
ORDER BY start_time DESC LIMIT 10;
```

## API Reference

### Endpoint

```
POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-jira-to-drai
```

### Request Format

```typescript
{
  "operation": "scheduled-sync",
  "projectId": "uuid",                    // Optional: If omitted, syncs ALL active projects
  "filters": {                            // Optional: Task/Issue filtering
    "updatedSince": "2025-12-11T12:00:00Z",  // ISO 8601 timestamp
    "excludeStatuses": ["Done", "Closed"],    // JIRA status names to skip
    "status": ["To Do", "In Progress"]        // Only these JIRA statuses
  },
  "batchConfig": {                        // Optional: Performance tuning
    "batchSize": 15,
    "maxConcurrency": 4,
    "continueOnError": true
  }
}
```

### Single Project Response

```typescript
{
  "success": true,
  "data": {
    "direction": "from-jira",
    "fromJiraResults": {
      "totalTasks": 42,
      "successful": 40,
      "failed": 2,
      "results": [...],
      "errors": [...]
    },
    "summary": {
      "totalTasksProcessed": 42,
      "successfulSyncs": 40,
      "failedSyncs": 2,
      "skippedTasks": 0,
      "newTasksCreated": 5,        // New DR-AI tasks created from JIRA
      "existingTasksUpdated": 35   // Existing DR-AI tasks updated
    }
  },
  "metadata": {
    "processingTime": 8250,
    "requestId": "uuid"
  }
}
```

### Multi-Project Response

```typescript
{
  "success": true,
  "data": {
    "totalProjects": 3,
    "successfulProjects": 2,
    "failedProjects": 1,
    "results": [
      {
        "projectId": "uuid-1",
        "projectName": "Project A",
        "status": "success",
        "tasksSynced": 15,
        "newTasksCreated": 3,
        "existingTasksUpdated": 12,
        "processingTime": 2500
      },
      {
        "projectId": "uuid-2",
        "projectName": "Project B",
        "status": "error",
        "error": "Failed to search JIRA issues (HTTP 401 | JIRA: Unauthorized)",
        "processingTime": 680
      }
    ],
    "totalProcessingTime": 3180
  }
}
```

## Setup Instructions

### Option 1: Hourly Incremental Sync (Recommended)

Syncs only JIRA issues updated in the last 2 hours:

```sql
SELECT cron.schedule(
  'jira-hourly-incremental',
  '5 * * * *',  -- Every hour at :05
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-jira-to-drai',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'filters', jsonb_build_object(
          'updatedSince', (NOW() - INTERVAL '2 hours')::TEXT,
          'excludeStatuses', jsonb_build_array('Done', 'Closed', 'Cancelled')
        ),
        'batchConfig', jsonb_build_object(
          'batchSize', 15,
          'maxConcurrency', 4,
          'continueOnError', true
        )
      )
    )
  $$
);
```

### Option 2: Daily Full Sync

Syncs all JIRA issues (integrity check):

```sql
SELECT cron.schedule(
  'jira-daily-full-sync',
  '0 2 * * *',  -- Daily at 2 AM UTC
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-jira-to-drai',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'batchConfig', jsonb_build_object(
          'batchSize', 10,
          'maxConcurrency', 3,
          'continueOnError', true
        )
      )
    )
  $$
);
```

### Option 3: Single Project Sync

```sql
SELECT cron.schedule(
  'jira-project-specific',
  '0 */6 * * *',  -- Every 6 hours
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/sync-jira-to-drai',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'projectId', 'YOUR_PROJECT_UUID'
      )
    )
  $$
);
```

## Configuration Options

### Temporal Filtering

Use `updatedSince` to sync only recent changes:

```typescript
{
  "filters": {
    "updatedSince": "2025-12-11T12:00:00Z"  // ISO 8601 format
  }
}
```

**When to use**:
- **Hourly sync**: Last 2 hours (`NOW() - INTERVAL '2 hours'`)
- **Daily sync**: Last 24 hours
- **Weekly sync**: Omit filter (full sync)

### Status Exclusion

Skip JIRA issues with specific statuses:

```typescript
{
  "filters": {
    "excludeStatuses": ["Done", "Closed", "Cancelled", "Resolved"]
  }
}
```

**Use cases**:
- Avoid syncing completed work
- Focus on active issues only
- Reduce API usage

### Status Filtering

Sync only specific JIRA statuses:

```typescript
{
  "filters": {
    "status": ["To Do", "In Progress", "In Review"]
  }
}
```

### Batch Configuration

```typescript
{
  "batchConfig": {
    "batchSize": 15,          // Issues per batch
    "maxConcurrency": 4,      // Parallel batches
    "continueOnError": true   // Don't stop on failures
  }
}
```

**Performance Guidelines**:
- Small projects (<50 issues): `batchSize: 20, maxConcurrency: 5`
- Medium projects (50-200): `batchSize: 15, maxConcurrency: 4`
- Large projects (>200): `batchSize: 10, maxConcurrency: 3`

## JIRA API Integration

### Migration to New API

As of December 2024, JIRA deprecated the `/rest/api/3/search` endpoint (HTTP 410). This function uses:

```
POST /rest/api/3/search/jql
```

**Key Changes**:
- ✅ Uses `nextPageToken` for pagination (not `startAt`)
- ✅ Handles large result sets efficiently
- ✅ Compliant with Atlassian's migration guidelines

**Reference**: [JIRA API CHANGE-2046](https://developer.atlassian.com/changelog/#CHANGE-2046)

### JQL Queries Generated

The function builds JQL queries automatically:

```sql
-- Base query
project = DRS

-- With status filter
project = DRS AND status IN ("To Do", "In Progress")

-- With exclusion
project = DRS AND status NOT IN ("Done", "Closed")

-- With temporal filter
project = DRS AND updated >= "2025/12/11 12:00"
```

## Monitoring and Troubleshooting

### Check Cron Job Status

```sql
-- View all JIRA cron jobs
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'jira%'
ORDER BY jobname;

-- View recent executions
SELECT
  j.jobname,
  jr.start_time,
  jr.end_time,
  jr.status,
  jr.return_message
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE j.jobname LIKE 'jira%'
  AND jr.start_time > NOW() - INTERVAL '24 hours'
ORDER BY jr.start_time DESC;

-- View failures
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
  AND jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE 'jira%')
ORDER BY start_time DESC
LIMIT 10;
```

### Check Sync Logs

```sql
-- Recent sync operations
SELECT
  id,
  project_id,
  operation,
  direction,
  status,
  error_message,
  created_at
FROM jira_sync_log
WHERE direction = 'jira_to_dr'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- Sync statistics
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_syncs,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as failed
FROM jira_sync_log
WHERE direction = 'jira_to_dr'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

### Edge Function Logs

```bash
# Using Supabase CLI
supabase functions logs sync-jira-to-drai --tail

# Filter for errors
supabase functions logs sync-jira-to-drai | grep "ERROR"

# Filter for specific project
supabase functions logs sync-jira-to-drai | grep "project-uuid"
```

### Common Issues

#### Issue: HTTP 401 Unauthorized

**Symptoms**: All syncs failing with 401 error

**Solutions**:
1. Verify JIRA API token is valid and not expired
2. Check JIRA email matches the token owner
3. Verify token has necessary permissions in JIRA

```sql
-- Check JIRA configuration
SELECT
  jira_url,
  jira_project_key,
  jira_email,
  CASE WHEN api_token_encrypted IS NOT NULL THEN 'Configured' ELSE 'Missing' END as token_status
FROM jira_sync_config
WHERE is_active = true;
```

#### Issue: No issues synced

**Symptoms**: Sync completes but 0 tasks created/updated

**Solutions**:
1. Check if JIRA project has issues
2. Verify `jira_project_key` matches actual JIRA project
3. Check if filters are too restrictive

```bash
# Test with no filters
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-jira-to-drai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"operation": "scheduled-sync", "projectId": "YOUR_UUID"}'
```

#### Issue: Timeout for large projects

**Symptoms**: `FUNCTION_TIMEOUT` errors

**Solutions**:
1. Use temporal filtering: `"updatedSince": (NOW() - INTERVAL '6 hours')`
2. Reduce batch size: `"batchSize": 5`
3. Sync more frequently with smaller windows

## Best Practices

### 1. Use Incremental Sync

**Recommended approach**:
- **Hourly**: Sync last 2 hours of changes
- **Daily**: Full sync for integrity check
- **Weekly**: Deep sync with all statuses

```sql
-- Hourly incremental (at :05)
SELECT cron.schedule('jira-hourly', '5 * * * *', $$...updatedSince: NOW() - INTERVAL '2 hours'...$$);

-- Daily full sync (at 2 AM)
SELECT cron.schedule('jira-daily', '0 2 * * *', $$...no filters...$$);
```

### 2. Exclude Completed Work

Save API calls by skipping done issues:

```typescript
{
  "filters": {
    "excludeStatuses": ["Done", "Closed", "Resolved", "Cancelled"]
  }
}
```

### 3. Monitor Sync Health

Create alert for high failure rate:

```sql
CREATE OR REPLACE FUNCTION check_jira_sync_health()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  failure_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO failure_count
  FROM jira_sync_log
  WHERE status = 'error'
    AND direction = 'jira_to_dr'
    AND created_at > NOW() - INTERVAL '1 hour';

  IF failure_count > 5 THEN
    RAISE WARNING 'High JIRA sync failure rate: % failures in last hour', failure_count;
  END IF;
END;
$$;

-- Run health check every 30 minutes
SELECT cron.schedule('jira-health-check', '*/30 * * * *', $$SELECT check_jira_sync_health()$$);
```

### 4. Stagger Multi-Project Syncs

If syncing multiple projects, stagger schedules:

```sql
-- Project A: :05 past each hour
SELECT cron.schedule('jira-project-a', '5 * * * *', ...);

-- Project B: :20 past each hour
SELECT cron.schedule('jira-project-b', '20 * * * *', ...);

-- Project C: :35 past each hour
SELECT cron.schedule('jira-project-c', '35 * * * *', ...);
```

## Security Considerations

### 1. Protect Service Role Key

**Never expose** the service role key in client-side code or public repositories.

Store in Supabase database settings:

```sql
-- Set in migration or SQL Editor
ALTER DATABASE postgres
SET app.service_role_key = 'your-service-role-key';

-- Reference in cron jobs
current_setting('app.service_role_key')
```

### 2. Encrypt API Tokens

Ensure JIRA API tokens are encrypted:

```sql
-- Check encryption status
SELECT
  jira_email,
  CASE
    WHEN api_token_encrypted ~ '^[A-Za-z0-9+/=]+$' THEN 'Encrypted'
    ELSE 'Plain Text (INSECURE!)'
  END as encryption_status
FROM jira_sync_config;
```

### 3. Use SECURITY DEFINER Functions

```sql
CREATE OR REPLACE FUNCTION sync_jira_safe()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's permissions
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(...);
END;
$$;

GRANT EXECUTE ON FUNCTION sync_jira_safe TO authenticated;
```

## Manual Testing

### Test Script

```bash
#!/bin/bash
# test-sync-from-jira.sh

TIMESTAMP=$(date "+%Y-%m-%d-%H-%M")
OUTPUT_FILE="sync-jira-to-drai_${TIMESTAMP}.txt"

echo "Testing JIRA → DR-AI sync..."
echo "Results will be saved to: $OUTPUT_FILE"
echo ""

curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-jira-to-drai' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -d '{
    "operation": "scheduled-sync",
    "filters": {
      "updatedSince": "'$(date -u -v-2H "+%Y-%m-%dT%H:%M:%SZ")'",
      "excludeStatuses": ["Done", "Closed"]
    }
  }' | tee "$OUTPUT_FILE"

echo ""
echo "✅ Results saved to: $OUTPUT_FILE"
```

### Expected Results

**Successful sync**:
```json
{
  "success": true,
  "data": {
    "totalProjects": 1,
    "successfulProjects": 1,
    "results": [{
      "projectId": "uuid",
      "projectName": "My Project",
      "status": "success",
      "tasksSynced": 12,
      "newTasksCreated": 2,
      "existingTasksUpdated": 10
    }]
  }
}
```

## Support and Resources

- **JIRA REST API v3**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **JIRA API Migration Guide**: https://developer.atlassian.com/changelog/#CHANGE-2046
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **pg_cron Documentation**: https://github.com/citusdata/pg_cron

## Changelog

### Version 2.0.0 (December 2024)
- ✅ Migrated to JIRA API v3 `/rest/api/3/search/jql`
- ✅ Implemented `nextPageToken` pagination
- ✅ Split from monolithic `jira-sync-tasks` into directional functions
- ✅ Removed `direction` parameter (function is always JIRA → DR-AI)
- ✅ Added JIRA issue discovery and automatic task creation
- ✅ Added multi-project sync support
- ✅ Enhanced error reporting with HTTP status and JIRA error details
- ✅ Added JQL filtering with status exclusion

### Version 1.0.0 (Initial Release)
- Basic JIRA → DR-AI synchronization
- Task update functionality
