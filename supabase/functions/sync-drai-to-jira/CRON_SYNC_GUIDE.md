# DR-AI → JIRA Scheduled Sync Guide

Complete guide for setting up automated synchronization from DR_AI to JIRA using Supabase's native pg_cron extension.

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

The `sync-drai-to-jira` Edge Function enables automated synchronization **from DR_AI to JIRA**, creating and updating JIRA issues based on DR-AI tasks.

### Key Features

- ✅ **Auto-Create JIRA Issues**: Creates JIRA issues for DR-AI tasks that don't have one
- ✅ **Multi-Project Support**: Sync all active projects when `projectId` is omitted
- ✅ **Temporal Filtering**: Use `updatedSince` to sync only recently modified tasks
- ✅ **Status Exclusion**: Skip tasks with specific statuses (e.g., done, cancelled)
- ✅ **Batch Processing**: Efficient parallel processing with configurable batch sizes
- ✅ **Continue-on-Error**: Individual failures don't stop the sync

### What It Does

1. **Fetches DR-AI tasks** matching filter criteria (status, sync status, temporal filters)
2. **For each DR-AI task**:
   - If task has `jira_issue_key` → **Update** existing JIRA issue
   - If task has no `jira_issue_key` and `createIfNotExists: true` → **Create** new JIRA issue
3. **Field Mapping**: Converts DR-AI fields (title, description, status, priority) to JIRA schema
4. **Links tasks**: Updates `jira_issue_key` in DR-AI when creating new issues

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
-- Sync DR-AI tasks updated in last 2 hours, every hour at :10
SELECT cron.schedule(
  'jira-hourly-to-jira',
  '10 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-drai-to-jira',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'createIfNotExists', true,
        'filters', jsonb_build_object(
          'updatedSince', (NOW() - INTERVAL '2 hours')::TEXT,
          'excludeStatuses', jsonb_build_array('done', 'cancelled')
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
POST https://YOUR_PROJECT.supabase.co/functions/v1/sync-drai-to-jira
```

### Request Format

```typescript
{
  "operation": "scheduled-sync",
  "projectId": "uuid",                    // Optional: If omitted, syncs ALL active projects
  "createIfNotExists": true,              // Optional: Create JIRA issues if not exist (default: true)
  "conflictResolution": "last-write-wins", // Optional: Conflict resolution strategy
  "filters": {                            // Optional: Task filtering
    "updatedSince": "2025-12-11T12:00:00Z",  // ISO 8601 timestamp
    "excludeStatuses": ["done", "cancelled"], // DR-AI status to skip
    "status": ["todo", "in_progress"],        // Only these DR-AI statuses
    "syncStatus": ["pending", "error"]        // Sync status filter
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
    "direction": "to-jira",
    "toJiraResults": {
      "totalTasks": 35,
      "successful": 33,
      "failed": 2,
      "results": [...],
      "errors": [...]
    },
    "summary": {
      "totalTasksProcessed": 35,
      "successfulSyncs": 33,
      "failedSyncs": 2,
      "skippedTasks": 0
    }
  },
  "metadata": {
    "processingTime": 6400,
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
    "successfulProjects": 3,
    "failedProjects": 0,
    "results": [
      {
        "projectId": "uuid-1",
        "projectName": "Project A",
        "status": "success",
        "tasksSynced": 15,
        "processingTime": 2100
      },
      {
        "projectId": "uuid-2",
        "projectName": "Project B",
        "status": "success",
        "tasksSynced": 8,
        "processingTime": 1500
      }
    ],
    "totalProcessingTime": 3600
  }
}
```

## Changelog

### Version 2.0.0 (December 2024)
- ✅ Split from monolithic `jira-sync-tasks` into directional functions
- ✅ Removed `direction` parameter (function is always DR-AI → JIRA)
- ✅ Added multi-project sync support
- ✅ Enhanced error reporting with detailed messages
- ✅ Optimized batch processing

### Version 1.0.0 (Initial Release)
- Basic DR-AI → JIRA synchronization
- JIRA issue creation and updates
