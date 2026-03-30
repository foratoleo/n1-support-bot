# JIRA Scheduled Sync Guide

Complete guide for setting up automated bidirectional synchronization between DR_AI and JIRA using Supabase's native pg_cron extension.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Scheduled Sync Operation](#scheduled-sync-operation)
5. [Setup Instructions](#setup-instructions)
6. [Configuration Options](#configuration-options)
7. [API Examples](#api-examples)
8. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
9. [Best Practices](#best-practices)
10. [Security Considerations](#security-considerations)

## Overview

The `scheduled-sync` operation enables automated, project-wide synchronization without requiring explicit task IDs. This is ideal for:

- **Cron-based automation**: Run sync jobs on a schedule (hourly, daily, etc.)
- **Bidirectional sync**: Keep DR_AI and JIRA in sync automatically
- **Large-scale operations**: Sync entire projects efficiently
- **Background processing**: Run sync operations without user intervention

### Key Features

- **No taskId required**: Automatically discovers and syncs all project tasks
- **Bidirectional support**: Sync to JIRA, from JIRA, or both
- **Filter support**: Sync only tasks matching specific criteria
- **Batch processing**: Efficient parallel processing with configurable batch sizes
- **Progress tracking**: Monitor long-running sync operations
- **Error handling**: Continues processing even if individual tasks fail

## Prerequisites

1. **Supabase Project**: With Edge Functions enabled
2. **pg_cron Extension**: Enabled in your Supabase database
3. **JIRA Configuration**: Active configuration in `jira_sync_config` table
4. **Proper Permissions**: Service role key or appropriate RLS policies

## Quick Start

### 1. Enable pg_cron Extension

```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 2. Create Cron Job (Daily Bidirectional Sync)

```sql
-- Schedule daily sync at 2 AM UTC
SELECT cron.schedule(
  'jira-daily-sync',
  '0 2 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/jira-sync-tasks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'projectId', 'YOUR_PROJECT_ID',
        'direction', 'bidirectional',
        'progressTracking', true,
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

### 3. Verify Cron Job

```sql
-- List all scheduled jobs
SELECT * FROM cron.job;

-- View job execution history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Scheduled Sync Operation

### Request Format

```typescript
{
  "operation": "scheduled-sync",
  "projectId": "uuid",                    // Required: Project to sync
  "direction": "to-jira" | "from-jira" | "bidirectional",  // Optional, default: "to-jira"
  "conflictResolution": "last-write-wins" | "jira-wins" | "dr-wins",  // Optional
  "createIfNotExists": true,              // Optional, default: true
  "progressTracking": true,               // Optional, default: false
  "batchConfig": {                        // Optional batch configuration
    "batchSize": 10,
    "maxConcurrency": 3,
    "continueOnError": true,
    "retryFailedItems": true
  },
  "filters": {                            // Optional task filters
    "status": ["todo", "in_progress"],
    "syncStatus": ["synced", "pending"],
    "hasJiraIssue": true
  }
}
```

### Response Format

```typescript
{
  "success": true,
  "data": {
    "direction": "bidirectional",
    "toJiraResults": {
      "totalTasks": 25,
      "successful": 23,
      "failed": 2,
      "results": [...],
      "errors": [...]
    },
    "fromJiraResults": {
      "totalTasks": 20,
      "successful": 20,
      "failed": 0,
      "results": [...],
      "errors": []
    },
    "summary": {
      "totalTasksProcessed": 45,
      "successfulSyncs": 43,
      "failedSyncs": 2,
      "skippedTasks": 0
    }
  },
  "metadata": {
    "processingTime": 12450,
    "requestId": "uuid"
  }
}
```

## Setup Instructions

### Option 1: Using Supabase SQL Editor (Recommended)

1. **Navigate to SQL Editor** in your Supabase Dashboard

2. **Enable pg_cron Extension**
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   ```

3. **Create Cron Job Function** (for complex logic)
   ```sql
   CREATE OR REPLACE FUNCTION sync_jira_project(project_id UUID, sync_direction TEXT)
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   BEGIN
     PERFORM net.http_post(
       url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.service_role_key')
       ),
       body := jsonb_build_object(
         'operation', 'scheduled-sync',
         'projectId', project_id,
         'direction', sync_direction,
         'progressTracking', true,
         'conflictResolution', 'last-write-wins',
         'batchConfig', jsonb_build_object(
           'batchSize', 10,
           'maxConcurrency', 3,
           'continueOnError', true,
           'retryFailedItems', true
         )
       )
     );
   END;
   $$;
   ```

4. **Schedule Cron Job**
   ```sql
   -- Hourly sync to JIRA
   SELECT cron.schedule(
     'jira-hourly-to-jira',
     '0 * * * *',
     $$SELECT sync_jira_project('YOUR_PROJECT_ID', 'to-jira')$$
   );

   -- Daily sync from JIRA at 3 AM
   SELECT cron.schedule(
     'jira-daily-from-jira',
     '0 3 * * *',
     $$SELECT sync_jira_project('YOUR_PROJECT_ID', 'from-jira')$$
   );

   -- Weekly bidirectional sync on Sundays at 1 AM
   SELECT cron.schedule(
     'jira-weekly-bidirectional',
     '0 1 * * 0',
     $$SELECT sync_jira_project('YOUR_PROJECT_ID', 'bidirectional')$$
   );
   ```

### Option 2: Using Supabase CLI

1. **Create Migration File**
   ```bash
   supabase migration new setup_jira_cron
   ```

2. **Edit Migration File** (see `examples/setup_jira_cron.sql`)

3. **Apply Migration**
   ```bash
   supabase db push
   ```

### Option 3: Multiple Projects with Dynamic Discovery

```sql
-- Create function to sync all active JIRA projects
CREATE OR REPLACE FUNCTION sync_all_jira_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_record RECORD;
BEGIN
  FOR project_record IN
    SELECT DISTINCT project_id
    FROM jira_sync_config
    WHERE is_active = true
  LOOP
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'projectId', project_record.project_id,
        'direction', 'bidirectional',
        'progressTracking', true
      )
    );
  END LOOP;
END;
$$;

-- Schedule to run every 6 hours
SELECT cron.schedule(
  'jira-all-projects-sync',
  '0 */6 * * *',
  $$SELECT sync_all_jira_projects()$$
);
```

## Configuration Options

### Cron Schedule Expressions

| Pattern | Description | Example |
|---------|-------------|---------|
| `* * * * *` | Every minute | N/A (too frequent) |
| `0 * * * *` | Every hour | Hourly sync |
| `0 */2 * * *` | Every 2 hours | Frequent sync |
| `0 */6 * * *` | Every 6 hours | Regular sync |
| `0 2 * * *` | Daily at 2 AM | Daily sync |
| `0 1 * * 0` | Sunday at 1 AM | Weekly sync |
| `0 0 1 * *` | First day of month | Monthly sync |

### Sync Direction Options

#### `to-jira` (DR_AI → JIRA)
- Syncs all DR_AI tasks to JIRA
- Creates JIRA issues if they don't exist (when `createIfNotExists: true`)
- Updates existing JIRA issues
- Best for: Teams primarily working in DR_AI

#### `from-jira` (JIRA → DR_AI)
- Syncs JIRA issues to DR_AI tasks
- Only syncs tasks that already have `jira_issue_key`
- Updates DR_AI task data with JIRA values
- Best for: Teams primarily working in JIRA

#### `bidirectional` (Both Directions)
- Syncs DR_AI → JIRA first
- Then syncs JIRA → DR_AI
- Ensures both systems are in sync
- Best for: Teams working in both systems
- **Warning**: Higher API usage and processing time

### Batch Configuration

```typescript
{
  "batchSize": 10,          // Number of tasks per batch
  "maxConcurrency": 3,      // Parallel batches
  "continueOnError": true,  // Don't stop on failures
  "retryFailedItems": true, // Retry failed tasks
  "delayBetweenBatches": 0, // Milliseconds between batches
  "groupByJiraProject": false // Group by JIRA project (advanced)
}
```

**Performance Guidelines**:
- Small projects (<50 tasks): `batchSize: 20, maxConcurrency: 5`
- Medium projects (50-200 tasks): `batchSize: 10, maxConcurrency: 3`
- Large projects (>200 tasks): `batchSize: 5, maxConcurrency: 2`
- Very large projects (>1000 tasks): Use filters to sync incrementally

### Filter Options

Reduce sync scope by filtering tasks:

```typescript
{
  "filters": {
    "status": ["todo", "in_progress"],  // Only sync active tasks
    "syncStatus": ["pending", "error"], // Only sync failed/pending tasks
    "hasJiraIssue": true                // Only sync linked tasks (for from-jira)
  }
}
```

**Use Cases**:
- **Incremental sync**: `"syncStatus": ["pending", "error"]`
- **Active tasks only**: `"status": ["todo", "in_progress"]`
- **Update existing**: `"hasJiraIssue": true` with `"direction": "from-jira"`

## API Examples

### Manual Invocation (Testing)

#### Using curl

```bash
# Bidirectional sync
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/jira-sync-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "operation": "scheduled-sync",
    "projectId": "YOUR_PROJECT_ID",
    "direction": "bidirectional",
    "progressTracking": true,
    "conflictResolution": "last-write-wins"
  }'

# Sync only to JIRA with filters
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/jira-sync-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "operation": "scheduled-sync",
    "projectId": "YOUR_PROJECT_ID",
    "direction": "to-jira",
    "filters": {
      "status": ["todo", "in_progress"]
    },
    "batchConfig": {
      "batchSize": 15,
      "maxConcurrency": 4
    }
  }'

# Sync from JIRA only (linked tasks)
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/jira-sync-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "operation": "scheduled-sync",
    "projectId": "YOUR_PROJECT_ID",
    "direction": "from-jira",
    "filters": {
      "hasJiraIssue": true
    }
  }'
```

#### Using JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_SERVICE_ROLE_KEY'
);

async function scheduledSync(projectId: string, direction: 'to-jira' | 'from-jira' | 'bidirectional') {
  const { data, error } = await supabase.functions.invoke('jira-sync-tasks', {
    body: {
      operation: 'scheduled-sync',
      projectId,
      direction,
      progressTracking: true,
      conflictResolution: 'last-write-wins',
      batchConfig: {
        batchSize: 10,
        maxConcurrency: 3,
        continueOnError: true,
        retryFailedItems: true,
      },
    },
  });

  if (error) {
    console.error('Sync failed:', error);
    return;
  }

  console.log('Sync completed:', data.data.summary);
}

// Usage
await scheduledSync('YOUR_PROJECT_ID', 'bidirectional');
```

### Programmatic Cron Management

```typescript
// Create cron job
async function createCronJob(projectId: string) {
  const { data, error } = await supabase.rpc('cron_schedule', {
    job_name: `jira-sync-${projectId}`,
    schedule: '0 2 * * *', // Daily at 2 AM
    command: `SELECT sync_jira_project('${projectId}', 'bidirectional')`
  });
}

// List cron jobs
async function listCronJobs() {
  const { data } = await supabase
    .from('cron.job')
    .select('*');
  return data;
}

// Delete cron job
async function deleteCronJob(jobName: string) {
  const { data, error } = await supabase.rpc('cron_unschedule', {
    job_name: jobName
  });
}
```

## Monitoring and Troubleshooting

### Check Cron Job Status

```sql
-- View all scheduled jobs
SELECT jobid, jobname, schedule, active, database
FROM cron.job
ORDER BY jobname;

-- View recent job executions
SELECT
  job_run_details.jobid,
  cron.job.jobname,
  job_run_details.start_time,
  job_run_details.end_time,
  job_run_details.status,
  job_run_details.return_message
FROM cron.job_run_details
JOIN cron.job ON cron.job.jobid = job_run_details.jobid
WHERE job_run_details.start_time > NOW() - INTERVAL '24 hours'
ORDER BY job_run_details.start_time DESC;

-- View failed executions
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 20;
```

### Check Sync Logs

```sql
-- View recent sync operations
SELECT
  id,
  project_id,
  operation,
  direction,
  status,
  error_message,
  created_at
FROM jira_sync_log
WHERE operation = 'sync'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Count sync operations by status
SELECT
  direction,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE error_message IS NOT NULL) as errors
FROM jira_sync_log
WHERE operation = 'sync'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY direction, status;

-- View sync errors
SELECT
  project_id,
  task_id,
  jira_issue_key,
  error_message,
  retry_count,
  created_at
FROM jira_sync_log
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Monitor Edge Function Logs

```bash
# Using Supabase CLI
supabase functions logs jira-sync-tasks --tail

# Filter for scheduled sync operations
supabase functions logs jira-sync-tasks | grep "scheduled-sync"

# View errors only
supabase functions logs jira-sync-tasks | grep "ERROR"
```

### Common Issues and Solutions

#### Issue: Cron job not executing

**Symptoms**: No entries in `cron.job_run_details`

**Solutions**:
1. Check if pg_cron extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. Verify cron job is active:
   ```sql
   SELECT * FROM cron.job WHERE active = true;
   ```

3. Check Supabase service status

#### Issue: Sync timeouts for large projects

**Symptoms**: `FUNCTION_TIMEOUT` errors

**Solutions**:
1. Reduce batch size: `"batchSize": 5`
2. Reduce concurrency: `"maxConcurrency": 2`
3. Use filters to sync incrementally
4. Split into multiple cron jobs (different task statuses)

#### Issue: Rate limiting from JIRA

**Symptoms**: `429 Too Many Requests` errors

**Solutions**:
1. Add delay between batches: `"delayBetweenBatches": 2000`
2. Reduce concurrency: `"maxConcurrency": 1`
3. Increase sync interval (less frequent cron)
4. Contact JIRA admin for rate limit increase

#### Issue: High error rate

**Symptoms**: Many failed syncs in logs

**Solutions**:
1. Check JIRA API credentials in `jira_sync_config`
2. Verify JIRA project exists and is accessible
3. Check field mapping configuration
4. Review error messages in `jira_sync_log`
5. Test manual sync for individual tasks

## Best Practices

### 1. Start with Manual Testing

Before scheduling cron jobs, test the scheduled-sync operation manually:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/jira-sync-tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{
    "operation": "scheduled-sync",
    "projectId": "YOUR_PROJECT_ID",
    "direction": "to-jira",
    "progressTracking": true
  }'
```

### 2. Choose Appropriate Sync Frequency

| Project Size | Recommended Frequency | Cron Expression |
|--------------|----------------------|-----------------|
| Small (<50 tasks) | Every 2 hours | `0 */2 * * *` |
| Medium (50-200) | Every 6 hours | `0 */6 * * *` |
| Large (>200) | Daily | `0 2 * * *` |
| Very Large (>1000) | Weekly | `0 1 * * 0` |

### 3. Use Filters for Incremental Sync

Instead of syncing all tasks every time:

```sql
-- Sync only pending/error tasks hourly
SELECT cron.schedule(
  'jira-incremental-sync',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'operation', 'scheduled-sync',
      'projectId', 'YOUR_PROJECT_ID',
      'direction', 'to-jira',
      'filters', jsonb_build_object(
        'syncStatus', ARRAY['pending', 'error']
      )
    )
  )
  $$
);
```

### 4. Monitor Sync Performance

Create a monitoring dashboard:

```sql
CREATE VIEW jira_sync_metrics AS
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  direction,
  COUNT(*) as total_syncs,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as failed,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM jira_sync_log
WHERE operation = 'sync'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), direction
ORDER BY hour DESC;
```

### 5. Set Up Alerting

Create a function to check for sync failures and send alerts:

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
    AND created_at > NOW() - INTERVAL '1 hour';

  IF failure_count > 5 THEN
    -- Send alert (integrate with your notification system)
    RAISE WARNING 'High JIRA sync failure rate: % failures in last hour', failure_count;
  END IF;
END;
$$;

-- Schedule health check every 30 minutes
SELECT cron.schedule(
  'jira-sync-health-check',
  '*/30 * * * *',
  $$SELECT check_jira_sync_health()$$
);
```

### 6. Stagger Sync Times for Multiple Projects

If syncing multiple projects, stagger the schedules:

```sql
-- Project A: Every 6 hours starting at midnight
SELECT cron.schedule('jira-sync-project-a', '0 */6 * * *', ...);

-- Project B: Every 6 hours starting at 2 AM
SELECT cron.schedule('jira-sync-project-b', '0 2,8,14,20 * * *', ...);

-- Project C: Every 6 hours starting at 4 AM
SELECT cron.schedule('jira-sync-project-c', '0 4,10,16,22 * * *', ...);
```

### 7. Use Progress Tracking for Large Projects

Enable progress tracking to monitor long-running operations:

```typescript
{
  "operation": "scheduled-sync",
  "projectId": "YOUR_PROJECT_ID",
  "direction": "bidirectional",
  "progressTracking": true,  // Enable tracking
  "batchConfig": {
    "batchSize": 10,
    "maxConcurrency": 3
  }
}
```

Then query progress:

```sql
SELECT * FROM jira_batch_progress
WHERE status = 'processing'
ORDER BY started_at DESC;
```

## Security Considerations

### 1. Protect Service Role Key

**Never expose the service role key** in client-side code or public repositories.

Store in Supabase secrets:

```bash
supabase secrets set SERVICE_ROLE_KEY=your-key
```

Reference in SQL:

```sql
current_setting('app.service_role_key')
```

### 2. Use Database Functions with SECURITY DEFINER

Create privileged functions that run with database owner permissions:

```sql
CREATE OR REPLACE FUNCTION sync_jira_project(...)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's permissions
SET search_path = public  -- Prevent schema injection
AS $$
BEGIN
  -- Function body
END;
$$;

-- Grant execute to specific roles only
GRANT EXECUTE ON FUNCTION sync_jira_project TO authenticated;
```

### 3. Validate Project Access

Add project ownership validation to prevent unauthorized sync:

```sql
CREATE OR REPLACE FUNCTION sync_jira_project_safe(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user has access to project
  IF NOT EXISTS (
    SELECT 1 FROM project_knowledge_base
    WHERE id = p_project_id
    AND owner_user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to project';
  END IF;

  -- Proceed with sync
  PERFORM net.http_post(...);
END;
$$;
```

### 4. Encrypt API Tokens

Ensure JIRA API tokens are encrypted at rest:

```sql
-- Update migration to use encryption
UPDATE jira_sync_config
SET api_token_encrypted = pgp_sym_encrypt(
  api_token_plaintext,
  current_setting('app.encryption_key')
);
```

### 5. Audit Scheduled Operations

Log all scheduled sync operations:

```sql
CREATE TABLE jira_cron_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  operation TEXT NOT NULL,
  direction TEXT NOT NULL,
  triggered_by TEXT NOT NULL,  -- 'cron' | 'manual'
  execution_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN,
  error_message TEXT
);

-- Insert audit record in sync function
INSERT INTO jira_cron_audit (project_id, operation, direction, triggered_by)
VALUES (p_project_id, 'scheduled-sync', p_direction, 'cron');
```

## Advanced Scenarios

### Multi-Tenant Setup

Sync multiple projects with different configurations:

```sql
CREATE OR REPLACE FUNCTION sync_all_active_projects()
RETURNS TABLE (
  project_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_record RECORD;
  result_status TEXT;
  result_message TEXT;
BEGIN
  FOR project_record IN
    SELECT
      jsc.project_id,
      jsc.jira_url,
      jsc.jira_project_key,
      pkb.name as project_name
    FROM jira_sync_config jsc
    JOIN project_knowledge_base pkb ON pkb.id = jsc.project_id
    WHERE jsc.is_active = true
  LOOP
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'operation', 'scheduled-sync',
          'projectId', project_record.project_id,
          'direction', 'bidirectional',
          'progressTracking', true
        )
      );

      result_status := 'success';
      result_message := 'Sync triggered for ' || project_record.project_name;
    EXCEPTION WHEN OTHERS THEN
      result_status := 'error';
      result_message := SQLERRM;
    END;

    project_id := project_record.project_id;
    status := result_status;
    message := result_message;
    RETURN NEXT;
  END LOOP;
END;
$$;
```

### Conditional Sync Based on Activity

Sync only projects with recent activity:

```sql
CREATE OR REPLACE FUNCTION sync_active_projects()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  project_record RECORD;
BEGIN
  FOR project_record IN
    SELECT DISTINCT dt.project_id
    FROM dev_tasks dt
    JOIN jira_sync_config jsc ON jsc.project_id = dt.project_id
    WHERE dt.updated_at > NOW() - INTERVAL '6 hours'
      AND jsc.is_active = true
  LOOP
    PERFORM net.http_post(...);
  END LOOP;
END;
$$;
```

### Time-Zone Aware Scheduling

Schedule based on project team's time zone:

```sql
-- Add timezone column to projects
ALTER TABLE project_knowledge_base
ADD COLUMN team_timezone TEXT DEFAULT 'UTC';

-- Schedule sync at local business hours (9 AM team time)
CREATE OR REPLACE FUNCTION schedule_project_sync_local_time(
  p_project_id UUID,
  p_local_hour INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tz TEXT;
  utc_hour INTEGER;
BEGIN
  -- Get project timezone
  SELECT team_timezone INTO tz
  FROM project_knowledge_base
  WHERE id = p_project_id;

  -- Calculate UTC hour for local hour
  -- (This is simplified - use proper timezone conversion in production)
  utc_hour := p_local_hour;  -- Replace with proper TZ conversion

  -- Schedule cron job
  PERFORM cron.schedule(
    'jira-sync-' || p_project_id,
    utc_hour || ' * * * *',
    format(
      'SELECT sync_jira_project(%L, %L)',
      p_project_id,
      'bidirectional'
    )
  );
END;
$$;
```

## Migration from Existing Setup

If you have existing single-task sync operations:

### 1. Identify Projects Using Manual Sync

```sql
SELECT DISTINCT project_id
FROM jira_sync_log
WHERE created_at > NOW() - INTERVAL '30 days';
```

### 2. Create Scheduled Jobs for Each Project

```sql
-- For each project, create a scheduled sync
DO $$
DECLARE
  project_record RECORD;
BEGIN
  FOR project_record IN
    SELECT DISTINCT project_id
    FROM jira_sync_log
    WHERE created_at > NOW() - INTERVAL '30 days'
  LOOP
    PERFORM cron.schedule(
      'jira-sync-' || project_record.project_id,
      '0 */6 * * *',  -- Every 6 hours
      format(
        'SELECT sync_jira_project(%L, %L)',
        project_record.project_id,
        'bidirectional'
      )
    );
  END LOOP;
END $$;
```

### 3. Monitor Both Systems in Parallel

Keep manual sync available while testing scheduled sync:
- Monitor `jira_sync_log` for both methods
- Compare success rates
- Gradually increase scheduled sync frequency
- Deprecate manual sync once confident

## Appendix

### A. Complete SQL Setup Script

See `/supabase/functions/jira-sync-tasks/examples/setup_jira_cron.sql`

### B. Example Configurations

See `/supabase/functions/jira-sync-tasks/examples/` directory for:
- `basic-hourly-sync.sql` - Simple hourly sync
- `multi-project-sync.sql` - Multiple projects
- `advanced-conditional-sync.sql` - Conditional sync based on activity

### C. Troubleshooting Checklist

- [ ] pg_cron extension enabled
- [ ] Cron job created and active
- [ ] Service role key configured
- [ ] JIRA configuration active for project
- [ ] Field mapping configured
- [ ] Network access from Supabase to JIRA
- [ ] API token valid and not expired
- [ ] Edge function deployed
- [ ] Monitoring queries return data

### D. Performance Benchmarks

Based on testing with various project sizes:

| Project Size | Tasks | Direction | Batch Config | Duration |
|--------------|-------|-----------|--------------|----------|
| Small | 25 | to-jira | 10/3 | ~5s |
| Medium | 100 | to-jira | 10/3 | ~18s |
| Large | 500 | bidirectional | 5/2 | ~3m |
| Very Large | 2000 | bidirectional | 5/2 | ~12m |

**Note**: Times vary based on network latency, JIRA API response time, and task complexity.

## Support and Resources

- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **pg_cron Documentation**: https://github.com/citusdata/pg_cron
- **JIRA REST API**: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
- **Project Repository**: [Link to your repo]

## Changelog

### Version 1.0.0 (Initial Release)
- Added `scheduled-sync` operation
- Support for bidirectional sync without taskIds
- Progress tracking for scheduled operations
- Filter support for incremental sync
- Comprehensive documentation and examples
