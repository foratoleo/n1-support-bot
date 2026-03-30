---
name: projects
description: Project management, project_knowledge_base, and project-level data isolation
area: 20
maintained_by: project-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Projects

## Overview

Projects are the top-level organizational unit in Workforce. All data (tasks, sprints, transcripts, documents) is scoped to a project.

## Project Structure

```
User
  |-- Team Membership (team_members)
        |-- Project (project_knowledge_base)
              |-- Sprints (sprints)
              |-- Tasks (dev_tasks)
              |-- Meeting Transcripts (meeting_transcripts)
              |-- Generated Documents (generated_documents)
```

## project_knowledge_base Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Project name |
| description | TEXT | Project description |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update |

## Project Creation

1. Admin creates project
2. Project added to `project_knowledge_base`
3. Team members associated via `team_members`
4. Users can now query with project_id filter

## Project-Level Data Isolation

**Critical**: Every table has `project_id`. Every query MUST filter:

```typescript
// WRONG - no project filter
const { data } = await supabase.from('tasks').select('*');

// CORRECT - project-scoped
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', selectedProject?.id);
```

## Related Topics

- [Project Context](../06-project-context/context-system.md)
- [Database Schema](../04-database-schema/schema.md)
- [Sprints](../22-sprints/sprints.md)
- [Tasks](../21-tasks/tasks.md)
