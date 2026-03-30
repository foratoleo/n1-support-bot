---
name: sprints
description: Sprint planning, velocity tracking, burndown, and sprint-task relationships
area: 22
maintained_by: sprint-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Sprints

## Overview

Sprints are time-boxed development periods. They contain tasks and track velocity.

## sprints Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Project association (REQUIRED) |
| name | TEXT | Sprint name |
| start_date | DATE | Sprint start |
| end_date | DATE | Sprint end |
| velocity | INTEGER | Story points completed |
| status | TEXT | planned / active / completed |
| created_at | TIMESTAMP | Creation timestamp |

## Sprint Statuses

| Status | Description |
|--------|-------------|
| `planned` | Sprint created but not started |
| `active` | Sprint currently in progress |
| `completed` | Sprint finished |

## Velocity Tracking

Velocity measures how much work was completed:

```typescript
const sprintVelocity = sprint.velocity; // Total story points done
```

Velocity is calculated from tasks marked `done` in the sprint.

## Sprint Planning Flow

1. Create sprint with name and date range
2. Assign tasks to sprint via `sprint_id` on dev_tasks
3. Track progress as tasks move to `done`
4. Velocity auto-calculated at sprint end

## Query Pattern

```typescript
const { selectedProject } = useProjectSelection();

const { data: sprints } = useQuery({
  queryKey: ['sprints', selectedProject?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('project_id', selectedProject?.id)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProject?.id,
});
```

## Sprint-Task Relationships

```typescript
// Get tasks for a sprint
const { data: sprintTasks } = useQuery({
  queryKey: ['tasks', 'sprint', sprintId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('dev_tasks')
      .select('*')
      .eq('sprint_id', sprintId);

    if (error) throw error;
    return data;
  },
});
```

## Common User Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| No sprints showing | Wrong project selected | Check selectedProject |
| Cannot create sprint | Permission issue | User may be viewer role |
| Velocity not updating | Tasks not marked done | Move tasks to done status |

## Related Topics

- [Tasks](../21-tasks/tasks.md)
- [Project Context](../06-project-context/context-system.md)
- [Database Schema](../04-database-schema/schema.md)
