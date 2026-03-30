import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split('T')[0];

    const { data: activeSprints, error: sprintsError } = await supabase
      .from('sprints')
      .select('id, project_id')
      .eq('status', 'active');

    if (sprintsError) {
      throw new Error(`Failed to fetch active sprints: ${sprintsError.message}`);
    }

    if (!activeSprints || activeSprints.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active sprints to snapshot', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const snapshots = [];

    for (const sprint of activeSprints) {
      const { data: tasks, error: tasksError } = await supabase
        .from('dev_tasks')
        .select('status, story_points')
        .eq('sprint_id', sprint.id)
        .is('deleted_at', null);

      if (tasksError) {
        console.error(`Failed to fetch tasks for sprint ${sprint.id}:`, tasksError.message);
        continue;
      }

      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
      const remainingTasks = totalTasks - completedTasks;
      const blockedTasks = tasks?.filter(t => t.status === 'blocked').length || 0;

      const totalPoints = tasks?.reduce((sum, t) => sum + (t.story_points || 0), 0) || 0;
      const completedPoints = tasks?.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0) || 0;
      const remainingPoints = totalPoints - completedPoints;

      const tasksByStatus: Record<string, number> = {};
      tasks?.forEach(t => {
        const status = t.status || 'unknown';
        tasksByStatus[status] = (tasksByStatus[status] || 0) + 1;
      });

      const { data: previousSnapshot } = await supabase
        .from('sprint_daily_snapshots')
        .select('total_points')
        .eq('sprint_id', sprint.id)
        .lt('snapshot_date', today)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single();

      const addedPoints = previousSnapshot ? Math.max(0, totalPoints - previousSnapshot.total_points) : 0;
      const removedPoints = previousSnapshot ? Math.max(0, previousSnapshot.total_points - totalPoints) : 0;

      const snapshotData = {
        sprint_id: sprint.id,
        snapshot_date: today,
        total_points: totalPoints,
        completed_points: completedPoints,
        remaining_points: remainingPoints,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        remaining_tasks: remainingTasks,
        added_points: addedPoints,
        removed_points: removedPoints,
        blocked_tasks: blockedTasks,
        tasks_by_status: tasksByStatus,
      };

      const { error: upsertError } = await supabase
        .from('sprint_daily_snapshots')
        .upsert(snapshotData, { onConflict: 'sprint_id,snapshot_date' });

      if (upsertError) {
        console.error(`Failed to upsert snapshot for sprint ${sprint.id}:`, upsertError.message);
      } else {
        snapshots.push(snapshotData);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Snapshotted ${snapshots.length} active sprints`,
        count: snapshots.length,
        date: today,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
