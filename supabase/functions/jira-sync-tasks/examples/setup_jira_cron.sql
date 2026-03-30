-- ==============================================================================
-- JIRA Scheduled Sync - Complete Setup Script
-- ==============================================================================
--
-- This script sets up automated bidirectional synchronization between
-- DR_AI and JIRA using Supabase's native pg_cron extension.
--
-- Prerequisites:
--   1. Supabase project with Edge Functions enabled
--   2. JIRA configuration active in jira_sync_config table
--   3. Service role key configured
--
-- Usage:
--   1. Replace YOUR_PROJECT_ID with your actual project UUID
--   2. Replace YOUR_PROJECT with your Supabase project reference
--   3. Run this script in Supabase SQL Editor
--
-- ==============================================================================

-- Step 1: Enable pg_cron extension
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';


-- Step 2: Configure Supabase settings
-- ==============================================================================

-- Set Supabase URL (replace with your project URL)
ALTER DATABASE postgres SET app.supabase_url TO 'https://YOUR_PROJECT.supabase.co';

-- Note: Service role key should be stored securely in Supabase secrets
-- Access it using: current_setting('app.service_role_key')


-- Step 3: Create helper function for JIRA sync
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_jira_project(
  p_project_id UUID,
  p_direction TEXT DEFAULT 'bidirectional',
  p_enable_progress_tracking BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_response INTEGER;
BEGIN
  -- Get configuration
  v_supabase_url := current_setting('app.supabase_url');
  v_service_role_key := current_setting('app.service_role_key');

  -- Validate project has active JIRA configuration
  IF NOT EXISTS (
    SELECT 1 FROM jira_sync_config
    WHERE project_id = p_project_id
    AND is_active = true
  ) THEN
    RAISE NOTICE 'Project % does not have active JIRA configuration', p_project_id;
    RETURN;
  END IF;

  -- Log sync start
  RAISE NOTICE 'Starting scheduled JIRA sync for project % (direction: %)', p_project_id, p_direction;

  -- Call Edge Function
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/jira-sync-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object(
      'operation', 'scheduled-sync',
      'projectId', p_project_id,
      'direction', p_direction,
      'progressTracking', p_enable_progress_tracking,
      'conflictResolution', 'last-write-wins',
      'createIfNotExists', true,
      'batchConfig', jsonb_build_object(
        'batchSize', 10,
        'maxConcurrency', 3,
        'continueOnError', true,
        'retryFailedItems', true
      )
    )
  );

  RAISE NOTICE 'Scheduled JIRA sync triggered for project %', p_project_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error in sync_jira_project: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_jira_project(UUID, TEXT, BOOLEAN) TO postgres;

COMMENT ON FUNCTION sync_jira_project IS 'Triggers scheduled JIRA synchronization for a project';


-- Step 4: Create function to sync all active projects
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_all_jira_projects(
  p_direction TEXT DEFAULT 'bidirectional'
)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_status TEXT;
  v_message TEXT;
BEGIN
  FOR v_project IN
    SELECT
      jsc.project_id,
      pkb.name as project_name,
      jsc.jira_project_key
    FROM jira_sync_config jsc
    JOIN project_knowledge_base pkb ON pkb.id = jsc.project_id
    WHERE jsc.is_active = true
    ORDER BY pkb.name
  LOOP
    BEGIN
      -- Trigger sync for this project
      PERFORM sync_jira_project(v_project.project_id, p_direction, true);

      v_status := 'success';
      v_message := format('Sync triggered successfully for JIRA project %s', v_project.jira_project_key);

    EXCEPTION WHEN OTHERS THEN
      v_status := 'error';
      v_message := SQLERRM;
    END;

    -- Return result for this project
    project_id := v_project.project_id;
    project_name := v_project.project_name;
    status := v_status;
    message := v_message;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_all_jira_projects(TEXT) TO postgres;

COMMENT ON FUNCTION sync_all_jira_projects IS 'Triggers JIRA sync for all active projects';


-- Step 5: Schedule cron jobs
-- ==============================================================================

-- EXAMPLE 1: Daily bidirectional sync at 2 AM UTC for a specific project
-- Replace YOUR_PROJECT_ID with actual project UUID
SELECT cron.schedule(
  'jira-daily-sync-project-1',                    -- Job name
  '0 2 * * *',                                    -- Daily at 2 AM UTC
  $$SELECT sync_jira_project('YOUR_PROJECT_ID', 'bidirectional', true)$$
);

-- EXAMPLE 2: Hourly sync to JIRA only for a specific project
-- SELECT cron.schedule(
--   'jira-hourly-to-jira',
--   '0 * * * *',                                  -- Every hour
--   $$SELECT sync_jira_project('YOUR_PROJECT_ID', 'to-jira', true)$$
-- );

-- EXAMPLE 3: Every 6 hours sync from JIRA only
-- SELECT cron.schedule(
--   'jira-6hourly-from-jira',
--   '0 */6 * * *',                                -- Every 6 hours
--   $$SELECT sync_jira_project('YOUR_PROJECT_ID', 'from-jira', true)$$
-- );

-- EXAMPLE 4: Sync all active projects daily at 3 AM UTC
-- SELECT cron.schedule(
--   'jira-daily-all-projects',
--   '0 3 * * *',                                  -- Daily at 3 AM UTC
--   $$SELECT sync_all_jira_projects('bidirectional')$$
-- );

-- EXAMPLE 5: Sync all active projects every 6 hours
-- SELECT cron.schedule(
--   'jira-6hourly-all-projects',
--   '0 */6 * * *',                                -- Every 6 hours
--   $$SELECT sync_all_jira_projects('bidirectional')$$
-- );

-- EXAMPLE 6: Weekly sync on Sundays at 1 AM UTC
-- SELECT cron.schedule(
--   'jira-weekly-sync',
--   '0 1 * * 0',                                  -- Sunday at 1 AM
--   $$SELECT sync_all_jira_projects('bidirectional')$$
-- );


-- Step 6: Verify cron jobs are created
-- ==============================================================================

-- List all scheduled JIRA sync jobs
SELECT
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname LIKE 'jira-%'
ORDER BY jobname;


-- Step 7: Create monitoring views
-- ==============================================================================

-- View recent sync executions
CREATE OR REPLACE VIEW jira_cron_executions AS
SELECT
  jrd.jobid,
  j.jobname,
  jrd.runid,
  jrd.start_time,
  jrd.end_time,
  jrd.status,
  jrd.return_message,
  EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) as duration_seconds
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'jira-%'
ORDER BY jrd.start_time DESC;

COMMENT ON VIEW jira_cron_executions IS 'Recent JIRA sync cron job executions';


-- View sync summary by project
CREATE OR REPLACE VIEW jira_sync_summary AS
SELECT
  jsl.project_id,
  pkb.name as project_name,
  DATE_TRUNC('day', jsl.created_at) as sync_date,
  jsl.direction,
  COUNT(*) as total_syncs,
  COUNT(*) FILTER (WHERE jsl.status = 'success') as successful,
  COUNT(*) FILTER (WHERE jsl.status = 'error') as failed,
  COUNT(*) FILTER (WHERE jsl.status = 'pending') as pending,
  MAX(jsl.created_at) as last_sync_at
FROM jira_sync_log jsl
JOIN project_knowledge_base pkb ON pkb.id = jsl.project_id
WHERE jsl.operation = 'sync'
  AND jsl.created_at > NOW() - INTERVAL '30 days'
GROUP BY jsl.project_id, pkb.name, DATE_TRUNC('day', jsl.created_at), jsl.direction
ORDER BY sync_date DESC, project_name;

COMMENT ON VIEW jira_sync_summary IS 'Daily summary of JIRA sync operations by project';


-- Step 8: Create health check function
-- ==============================================================================

CREATE OR REPLACE FUNCTION check_jira_sync_health()
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  health_status TEXT,
  recent_failures INTEGER,
  last_successful_sync TIMESTAMPTZ,
  message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jsc.project_id,
    pkb.name as project_name,
    CASE
      WHEN recent_errors.error_count > 10 THEN 'critical'
      WHEN recent_errors.error_count > 5 THEN 'warning'
      WHEN last_success.last_sync < NOW() - INTERVAL '48 hours' THEN 'stale'
      ELSE 'healthy'
    END as health_status,
    COALESCE(recent_errors.error_count, 0) as recent_failures,
    last_success.last_sync as last_successful_sync,
    CASE
      WHEN recent_errors.error_count > 10 THEN 'Critical: High failure rate'
      WHEN recent_errors.error_count > 5 THEN 'Warning: Elevated failure rate'
      WHEN last_success.last_sync < NOW() - INTERVAL '48 hours' THEN 'Warning: No recent successful sync'
      ELSE 'All systems operational'
    END as message
  FROM jira_sync_config jsc
  JOIN project_knowledge_base pkb ON pkb.id = jsc.project_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as error_count
    FROM jira_sync_log
    WHERE project_id = jsc.project_id
      AND status = 'error'
      AND created_at > NOW() - INTERVAL '24 hours'
  ) recent_errors ON true
  LEFT JOIN LATERAL (
    SELECT MAX(created_at) as last_sync
    FROM jira_sync_log
    WHERE project_id = jsc.project_id
      AND status = 'success'
  ) last_success ON true
  WHERE jsc.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION check_jira_sync_health() TO postgres;

COMMENT ON FUNCTION check_jira_sync_health IS 'Check health status of JIRA sync for all active projects';


-- Step 9: Schedule health check (optional)
-- ==============================================================================

-- Run health check every hour and log issues
-- SELECT cron.schedule(
--   'jira-health-check',
--   '0 * * * *',                                  -- Every hour
--   $$
--   DO $$
--   DECLARE
--     v_health RECORD;
--   BEGIN
--     FOR v_health IN SELECT * FROM check_jira_sync_health() WHERE health_status IN ('critical', 'warning')
--     LOOP
--       RAISE WARNING 'JIRA Sync Health Alert - Project: %, Status: %, Message: %',
--         v_health.project_name, v_health.health_status, v_health.message;
--     END LOOP;
--   END $$;
--   $$
-- );


-- ==============================================================================
-- Verification Queries
-- ==============================================================================

-- Check if pg_cron is enabled
SELECT 'pg_cron extension' as check_name,
       CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_extension WHERE extname = 'pg_cron';

-- Check active JIRA configurations
SELECT 'Active JIRA configs' as check_name,
       CASE WHEN COUNT(*) > 0 THEN 'PASS (' || COUNT(*) || ' projects)' ELSE 'FAIL (no active configs)' END as status
FROM jira_sync_config WHERE is_active = true;

-- Check scheduled cron jobs
SELECT 'Scheduled JIRA jobs' as check_name,
       CASE WHEN COUNT(*) > 0 THEN 'PASS (' || COUNT(*) || ' jobs)' ELSE 'FAIL (no jobs scheduled)' END as status
FROM cron.job WHERE jobname LIKE 'jira-%' AND active = true;

-- View all scheduled JIRA jobs
SELECT * FROM cron.job WHERE jobname LIKE 'jira-%';

-- View recent cron executions
SELECT * FROM jira_cron_executions LIMIT 10;

-- View sync health
SELECT * FROM check_jira_sync_health();


-- ==============================================================================
-- Useful Management Queries
-- ==============================================================================

-- Disable a cron job
-- SELECT cron.unschedule('jira-daily-sync-project-1');

-- Re-enable with same schedule
-- SELECT cron.schedule('jira-daily-sync-project-1', '0 2 * * *', ...);

-- View cron job execution history
-- SELECT * FROM cron.job_run_details WHERE jobid IN (
--   SELECT jobid FROM cron.job WHERE jobname LIKE 'jira-%'
-- ) ORDER BY start_time DESC LIMIT 20;

-- Manually trigger sync (for testing)
-- SELECT sync_jira_project('YOUR_PROJECT_ID', 'bidirectional', true);

-- Check recent sync logs
-- SELECT * FROM jira_sync_log
-- WHERE operation = 'sync'
-- ORDER BY created_at DESC LIMIT 20;


-- ==============================================================================
-- Cleanup (if needed)
-- ==============================================================================

-- Remove all JIRA cron jobs
-- DO $$
-- DECLARE
--   v_job RECORD;
-- BEGIN
--   FOR v_job IN SELECT jobid, jobname FROM cron.job WHERE jobname LIKE 'jira-%'
--   LOOP
--     PERFORM cron.unschedule(v_job.jobname);
--     RAISE NOTICE 'Unscheduled job: %', v_job.jobname;
--   END LOOP;
-- END $$;

-- Drop functions
-- DROP FUNCTION IF EXISTS sync_jira_project(UUID, TEXT, BOOLEAN);
-- DROP FUNCTION IF EXISTS sync_all_jira_projects(TEXT);
-- DROP FUNCTION IF EXISTS check_jira_sync_health();

-- Drop views
-- DROP VIEW IF EXISTS jira_cron_executions;
-- DROP VIEW IF EXISTS jira_sync_summary;


-- ==============================================================================
-- End of Setup Script
-- ==============================================================================

-- Next steps:
-- 1. Replace YOUR_PROJECT_ID with your actual project UUID
-- 2. Uncomment and customize the cron schedule examples that fit your needs
-- 3. Monitor execution using the provided views and queries
-- 4. Set up alerting based on check_jira_sync_health() results
