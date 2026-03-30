-- ==============================================================================
-- Multi-Project JIRA Sync Setup
-- ==============================================================================
--
-- This script sets up scheduled sync for multiple projects with staggered
-- execution times to distribute load.
--
-- ==============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to sync all active projects
CREATE OR REPLACE FUNCTION sync_all_jira_projects()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_project IN
    SELECT
      jsc.project_id,
      pkb.name as project_name
    FROM jira_sync_config jsc
    JOIN project_knowledge_base pkb ON pkb.id = jsc.project_id
    WHERE jsc.is_active = true
    ORDER BY pkb.name
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
          'projectId', v_project.project_id,
          'direction', 'bidirectional',
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

      v_count := v_count + 1;
      RAISE NOTICE 'Triggered sync for project: % (% of %)', v_project.project_name, v_count,
        (SELECT COUNT(*) FROM jira_sync_config WHERE is_active = true);

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to sync project %: %', v_project.project_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Completed sync trigger for % projects', v_count;
END;
$$;

-- Schedule daily sync at 2 AM UTC for all projects
SELECT cron.schedule(
  'jira-daily-all-projects',
  '0 2 * * *',
  $$SELECT sync_all_jira_projects()$$
);

-- Alternative: Sync specific projects at different times to distribute load
-- Project A: Every 6 hours starting at midnight
-- SELECT cron.schedule(
--   'jira-project-a-sync',
--   '0 */6 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := jsonb_build_object(
--       'operation', 'scheduled-sync',
--       'projectId', 'PROJECT_A_UUID',
--       'direction', 'bidirectional'
--     )
--   )$$
-- );

-- Project B: Every 6 hours starting at 2 AM (staggered)
-- SELECT cron.schedule(
--   'jira-project-b-sync',
--   '0 2,8,14,20 * * *',
--   $$SELECT net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := jsonb_build_object(
--       'operation', 'scheduled-sync',
--       'projectId', 'PROJECT_B_UUID',
--       'direction', 'bidirectional'
--     )
--   )$$
-- );

-- Verify jobs were created
SELECT * FROM cron.job WHERE jobname LIKE 'jira-%';
