-- ==============================================================================
-- Advanced Conditional JIRA Sync Setup
-- ==============================================================================
--
-- This script sets up intelligent sync that only runs for projects with
-- recent activity, reducing unnecessary API calls.
--
-- ==============================================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to sync only active projects
CREATE OR REPLACE FUNCTION sync_active_projects()
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  tasks_updated INTEGER,
  sync_triggered BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_tasks_updated INTEGER;
  v_sync_triggered BOOLEAN;
  v_message TEXT;
BEGIN
  FOR v_project IN
    SELECT DISTINCT
      jsc.project_id,
      pkb.name as project_name,
      jsc.jira_project_key
    FROM jira_sync_config jsc
    JOIN project_knowledge_base pkb ON pkb.id = jsc.project_id
    WHERE jsc.is_active = true
  LOOP
    -- Count tasks updated in last 6 hours
    SELECT COUNT(*)
    INTO v_tasks_updated
    FROM dev_tasks
    WHERE project_id = v_project.project_id
      AND updated_at > NOW() - INTERVAL '6 hours';

    -- Only sync if there's recent activity
    IF v_tasks_updated > 0 THEN
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
              'continueOnError', true
            )
          )
        );

        v_sync_triggered := true;
        v_message := format('Sync triggered - %s tasks updated', v_tasks_updated);

      EXCEPTION WHEN OTHERS THEN
        v_sync_triggered := false;
        v_message := 'Error: ' || SQLERRM;
      END;
    ELSE
      v_sync_triggered := false;
      v_message := 'Skipped - no recent activity';
    END IF;

    -- Return result
    project_id := v_project.project_id;
    project_name := v_project.project_name;
    tasks_updated := v_tasks_updated;
    sync_triggered := v_sync_triggered;
    message := v_message;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Schedule to run every 6 hours
SELECT cron.schedule(
  'jira-conditional-sync',
  '0 */6 * * *',
  $$SELECT sync_active_projects()$$
);

-- Create function for incremental sync (only pending/error tasks)
CREATE OR REPLACE FUNCTION sync_pending_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_pending_count INTEGER;
BEGIN
  FOR v_project IN
    SELECT project_id
    FROM jira_sync_config
    WHERE is_active = true
  LOOP
    -- Count pending or error tasks
    SELECT COUNT(*)
    INTO v_pending_count
    FROM dev_tasks
    WHERE project_id = v_project.project_id
      AND jira_sync_status IN ('pending', 'error')
      AND deleted_at IS NULL;

    -- Only sync if there are tasks to process
    IF v_pending_count > 0 THEN
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body := jsonb_build_object(
          'operation', 'scheduled-sync',
          'projectId', v_project.project_id,
          'direction', 'to-jira',
          'filters', jsonb_build_object(
            'syncStatus', ARRAY['pending', 'error']
          ),
          'batchConfig', jsonb_build_object(
            'batchSize', 15,
            'maxConcurrency', 4,
            'continueOnError', true,
            'retryFailedItems', true
          )
        )
      );

      RAISE NOTICE 'Syncing % pending/error tasks for project %',
        v_pending_count, v_project.project_id;
    END IF;
  END LOOP;
END;
$$;

-- Schedule incremental sync every hour
SELECT cron.schedule(
  'jira-incremental-sync',
  '0 * * * *',
  $$SELECT sync_pending_tasks()$$
);

-- Create function for business hours sync (9 AM - 5 PM UTC, weekdays only)
CREATE OR REPLACE FUNCTION sync_business_hours()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_hour INTEGER;
  v_current_dow INTEGER;
BEGIN
  -- Get current hour (0-23) and day of week (0=Sunday, 6=Saturday)
  v_current_hour := EXTRACT(HOUR FROM NOW());
  v_current_dow := EXTRACT(DOW FROM NOW());

  -- Check if it's a weekday (1-5) and business hours (9-17)
  IF v_current_dow BETWEEN 1 AND 5 AND v_current_hour BETWEEN 9 AND 17 THEN
    -- Trigger sync for all active projects
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/jira-sync-tasks',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := jsonb_build_object(
        'operation', 'scheduled-sync',
        'projectId', project_id,
        'direction', 'bidirectional',
        'progressTracking', false,
        'batchConfig', jsonb_build_object(
          'batchSize', 20,
          'maxConcurrency', 5
        )
      )
    )
    FROM jira_sync_config
    WHERE is_active = true;

    RAISE NOTICE 'Business hours sync completed';
  ELSE
    RAISE NOTICE 'Outside business hours, sync skipped';
  END IF;
END;
$$;

-- Schedule to run every 2 hours during business days
-- SELECT cron.schedule(
--   'jira-business-hours-sync',
--   '0 */2 * * *',
--   $$SELECT sync_business_hours()$$
-- );

-- Verify all jobs were created
SELECT
  jobname,
  schedule,
  active,
  CASE
    WHEN schedule = '0 */6 * * *' THEN 'Every 6 hours'
    WHEN schedule = '0 * * * *' THEN 'Every hour'
    WHEN schedule = '0 */2 * * *' THEN 'Every 2 hours'
    ELSE schedule
  END as description
FROM cron.job
WHERE jobname LIKE 'jira-%'
ORDER BY jobname;
