---
name: tasks
description: Task management via dev_tasks table, statuses, sprint relationships, and area assignment
area: 21
maintained_by: tasks-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Tasks

## Overview

Tasks are managed via the `dev_tasks` table. Each task belongs to a project, can be assigned to a team member, and belongs to a sprint.

## dev_tasks Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| project_id | UUID | Project association (REQUIRED) |
| sprint_id | UUID | Sprint association |
| title | TEXT | Task title |
| description | TEXT | Task details |
| status | TEXT | todo / in_progress / done / blocked |
| area | TEXT | planning / development / testing / governance |
| assigned_to | UUID | team_members.id |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

## Task Statuses

| Status | Description |
|--------|-------------|
| `todo` | Task created but not started |
| `in_progress` | Task is being worked on |
| `done` | Task completed |
| `blocked` | Task cannot proceed (dependency or issue) |

## Area Assignment

Tasks are assigned an area that determines UI styling:

| Area | Color | Theme |
|------|-------|-------|
| `planning` | Dark Gold #B8860B | Planning area |
| `development` | Gray #9E9E9E | Development area |
| `testing` | Bronze #CD7F32 | Testing/Quality area |
| `governance` | Dark Green #1B4332 | Governance area |

## Task Query Pattern

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks } = useQuery({
  queryKey: ['tasks', selectedProject?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('dev_tasks')
      .select('*')
      .eq('project_id', selectedProject?.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProject?.id,
});
```

## Task Creation (Legacy)

The legacy task creation used `generateDocumentsWithOpenAI()` from `src/lib/openai.ts`. This is being migrated to Edge Functions.

## Common User Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Tasks not showing | Wrong project selected | Check selectedProject |
| Cannot assign task | User not in project | Add user to team_members |
| Sprint tasks missing | sprint_id not set | Edit task to assign sprint |

## Related Topics

- [Sprints](../22-sprints/sprints.md)
- [Project Context](../06-project-context/context-system.md)
- [Tasks Table Schema](../04-database-schema/schema.md)
