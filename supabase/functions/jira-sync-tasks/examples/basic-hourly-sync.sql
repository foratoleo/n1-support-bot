-- ==============================================================================
-- Basic Hourly JIRA Sync Setup
-- ==============================================================================
--
-- This script sets up a simple hourly bidirectional sync for a single project.
-- Perfect for small to medium projects with moderate activity.
--
-- ==============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create simple sync function
CREATE OR REPLACE FUNCTION sync_jira_hourly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/jira-sync-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'operation', 'scheduled-sync',
      'projectId', 'YOUR_PROJECT_ID',
      'direction', 'bidirectional',
      'conflictResolution', 'last-write-wins',
      'createIfNotExists', true,
      'progressTracking', false,
      'batchConfig', jsonb_build_object(
        'batchSize', 10,
        'maxConcurrency', 3,
        'continueOnError', true
      )
    )
  );
END;
$$;

-- Schedule to run every hour
SELECT cron.schedule(
  'jira-hourly-sync',
  '0 * * * *',
  $$SELECT sync_jira_hourly()$$
);

-- Verify job was created
SELECT * FROM cron.job WHERE jobname = 'jira-hourly-sync';
