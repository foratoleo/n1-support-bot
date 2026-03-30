---
name: database-views
description: Database view patterns, complex query encapsulation, view naming conventions
area: 13
maintained_by: views-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Database View Patterns

This document covers the rationale, conventions, and implementation patterns for database views in the Workforce project. Views encapsulate complex JOIN logic at the database layer, reducing query duplication across the codebase and enforcing project_id filtering consistently.

---

## 1. Why Complex JOINs Should Be Database Views

The Workforce database is built around a strict project isolation model. Every meaningful query joins at least two tables and filters by `project_id`. Without views, this pattern is repeated across every component that needs combined data, leading to several categories of problems.

### 1.1 Query Duplication

Consider the common need to display a task list with sprint information. Without a view, every component that needs this data must independently write:

```sql
SELECT
  t.id,
  t.title,
  t.status,
  t.story_points,
  s.name AS sprint_name,
  s.start_date,
  s.end_date,
  s.status AS sprint_status
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id = $1
ORDER BY t.created_at DESC;
```

This exact query (or minor variations) would appear in multiple places: a task list component, a sprint board component, a backlog view, a sprint report. When the schema evolves -- adding a new column to sprints, for instance -- every copy of this query must be updated. A view centralizes the JOIN logic so a single change propagates everywhere automatically.

### 1.2 Inconsistent Filtering Risk

The project isolation rule requires `.eq('project_id', selectedProjectId)` on every table query. Complex JOINs involving three or more tables make it easy to forget the filter on one of the joined tables, creating a potential data leak across projects. A view enforces the filter at the source:

```sql
CREATE VIEW tasks_with_sprints AS
SELECT
  t.id,
  t.project_id,           -- always present, always filtered
  t.title,
  t.status,
  t.story_points,
  s.name AS sprint_name,
  s.start_date,
  s.end_date
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.deleted_at IS NULL;  -- filter encapsulated here
```

The frontend then queries the view with a single `.eq('project_id', selectedProjectId)`, and the underlying tables are never queried directly for this combined data.

### 1.3 Performance Benefits

Views that reference base tables with existing indexes allow the query planner to use those indexes directly. When the view encapsulates a stable, frequently-used JOIN pattern, the planner optimizes it as if it were a hand-written query, while the application benefits from a simpler surface area.

### 1.4 When NOT to Use Views

- **Highly dynamic queries**: When filters, columns, or JOINs change frequently based on user configuration, a view adds rigidity without benefit.
- **Write operations**: Views are generally read-only. For insert/update/delete operations, continue using the base tables.
- **One-off exploratory queries**: Views should represent stable, reusable data combinations, not ad-hoc analysis.

---

## 2. View Naming Conventions

The Workforce project follows a consistent naming scheme for views that communicates their purpose and scope.

### 2.1 Pattern

```
<base_table>_with_<related_table>[_and_<related_table>]
```

The name begins with the primary table being queried, followed by `_with_` and the names of joined tables in order of importance. When a third table is included, it is appended with `_and_`.

### 2.2 Examples

| View Name | Purpose |
|-----------|---------|
| `tasks_with_sprints` | Tasks joined with sprint information |
| `documents_with_transcripts` | Generated documents joined with their source transcripts |
| `documents_with_interactions` | Documents joined with AI interaction metadata |
| `member_task_counts` | Aggregated task counts per team member |
| `sprint_velocity_summary` | Sprint velocity and point tracking |
| `tasks_with_members_and_sprints` | Tasks joined with both assignees and sprint data |

### 2.3 Naming Rules

- Use lowercase with underscores (snake_case).
- Pluralize the base table name (`tasks`, not `task`).
- Do not include the `_v` or `_view` suffix -- the context of the `views` directory makes this redundant.
- Prefix administrative or cross-project views with their domain: `admin_`, `cross_project_`, etc.

---

## 3. project_id Filtering Enforcement in Views

Views are the primary mechanism for enforcing project_id filtering on complex queries. Every view that spans multiple tables must ensure that project isolation is applied at the view level, not delegated to the caller.

### 3.1 Rule: Filter at the Outer Level

The project_id filter should appear in the WHERE clause of the view's defining query, not just in the RLS policy. This ensures that even queries bypassing RLS (e.g., service role queries) still respect project boundaries.

```sql
-- CORRECT: project_id filter is explicit in the view definition
CREATE VIEW tasks_with_sprints AS
SELECT
  t.id,
  t.project_id,
  t.title,
  t.status,
  t.story_points,
  s.name        AS sprint_name,
  s.start_date  AS sprint_start_date,
  s.end_date    AS sprint_end_date
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id IS NOT NULL
  AND t.deleted_at IS NULL
  AND (s.id IS NULL OR s.deleted_at IS NULL);

-- INCORRECT: project_id filter is omitted from the view
-- This relies entirely on RLS, which can be bypassed
CREATE VIEW tasks_with_sprints_broken AS
SELECT t.*, s.*
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.deleted_at IS NULL;
```

### 3.2 Why Both View Filtering and RLS?

View-level filtering provides defense in depth:

- **RLS** enforces project isolation for all authenticated user queries automatically.
- **View-level WHERE clauses** protect against service role queries, direct database access, and future API clients that might not enforce RLS.

Both layers should be present. The view defines the logical boundary; RLS enforces it at runtime for the application.

### 3.3 Optional project_id Parameter in View Definitions

If a view should support querying across multiple projects (for administrative purposes), this must be explicit. Do not default to cross-project behavior -- the standard pattern is project-scoped only.

```sql
-- Administrative view: explicitly labeled and documented
CREATE VIEW admin_all_tasks AS
SELECT
  t.id,
  t.project_id,
  p.name AS project_name,
  t.title,
  t.status,
  t.story_points,
  tm.name AS assigned_member_name
FROM dev_tasks t
JOIN project_knowledge_base p ON p.id = t.project_id
LEFT JOIN team_members tm ON tm.id = t.assigned_to
WHERE t.deleted_at IS NULL;
```

---

## 4. Useful View Examples

### 4.1 Tasks with Sprint Information

Returns all tasks for a project with their associated sprint details. This is the most frequently needed combined query, used by the sprint board, backlog view, and sprint report.

```sql
CREATE VIEW tasks_with_sprints AS
SELECT
  t.id,
  t.project_id,
  t.sprint_id,
  t.assigned_to,
  t.status,
  t.priority,
  t.task_type,
  t.title,
  t.description,
  t.story_points,
  t.estimated_hours,
  t.actual_hours,
  t.tags,
  t.created_at,
  t.updated_at,
  s.name        AS sprint_name,
  s.status      AS sprint_status,
  s.start_date  AS sprint_start_date,
  s.end_date    AS sprint_end_date,
  s.planned_points,
  s.completed_points,
  s.velocity    AS sprint_velocity
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id IS NOT NULL
  AND t.deleted_at IS NULL
  AND (t.sprint_id IS NULL OR s.deleted_at IS NULL);
```

**Frontend usage:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks } = await supabase
  .from('tasks_with_sprints')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .eq('sprint_status', 'active')
  .order('priority', { ascending: false });
```

### 4.2 Documents with Transcript Information

Returns generated documents enriched with their source transcript metadata. Used by the document review interface and transcript-to-document navigation.

```sql
CREATE VIEW documents_with_transcripts AS
SELECT
  d.id,
  d.project_id,
  d.meeting_transcript_id,
  d.ai_interaction_id,
  d.status,
  d.document_type,
  d.document_name,
  d.content,
  d.version,
  d.is_current_version,
  d.word_count,
  d.section_count,
  d.estimated_reading_time,
  d.quality_score,
  d.quality_issues,
  d.created_at,
  d.updated_at,
  mt.title              AS transcript_title,
  mt.meeting_date       AS transcript_meeting_date,
  mt.transcript_text    AS transcript_preview,
  mt.tags               AS transcript_tags,
  ai.interaction_type   AS ai_interaction_type,
  ai.request_model      AS ai_model,
  ai.cost_usd           AS ai_cost
FROM generated_documents d
LEFT JOIN meeting_transcripts mt ON mt.id = d.meeting_transcript_id
LEFT JOIN ai_interactions ai ON ai.id = d.ai_interaction_id
WHERE d.project_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND (d.meeting_transcript_id IS NULL OR mt.deleted_at IS NULL);
```

**Frontend usage:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: documents } = await supabase
  .from('documents_with_transcripts')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .eq('is_current_version', true)
  .order('created_at', { ascending: false });
```

### 4.3 Member Task Counts

Returns aggregated task counts per team member for a project, used by the team workload dashboard and assignment recommendations.

```sql
CREATE VIEW member_task_counts AS
SELECT
  ptm.project_id,
  ptm.member_id,
  tm.name        AS member_name,
  tm.email       AS member_email,
  tm.headline    AS member_headline,
  tm.avatar_url  AS member_avatar_url,
  COUNT(t.id) FILTER (WHERE t.status = 'todo')       AS tasks_todo,
  COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS tasks_in_progress,
  COUNT(t.id) FILTER (WHERE t.status = 'done')       AS tasks_done,
  COUNT(t.id) FILTER (WHERE t.status = 'blocked')    AS tasks_blocked,
  COUNT(t.id)                                        AS tasks_total,
  COALESCE(SUM(t.story_points) FILTER (WHERE t.status = 'done'), 0)
    AS completed_story_points,
  COALESCE(SUM(t.story_points) FILTER (WHERE t.status IN ('todo', 'in_progress')), 0)
    AS remaining_story_points,
  COALESCE(AVG(t.story_points) FILTER (WHERE t.status = 'done'), 0)::numeric(3,1)
    AS avg_story_points_per_completed_task
FROM project_team_members ptm
JOIN team_members tm ON tm.id = ptm.member_id
LEFT JOIN dev_tasks t ON t.assigned_to = ptm.member_id
  AND t.project_id = ptm.project_id
  AND t.deleted_at IS NULL
WHERE ptm.deleted_at IS NULL
  AND tm.deleted_at IS NULL
  AND ptm.project_id IS NOT NULL
GROUP BY
  ptm.project_id,
  ptm.member_id,
  tm.name,
  tm.email,
  tm.headline,
  tm.avatar_url;
```

**Frontend usage:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: workload } = await supabase
  .from('member_task_counts')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .order('tasks_in_progress', { ascending: false });
```

### 4.4 Sprint Velocity Summary

Returns sprint-level metrics including planned vs. completed points, task counts, and date ranges. Used by sprint reporting and velocity tracking charts.

```sql
CREATE VIEW sprint_velocity_summary AS
SELECT
  s.id,
  s.project_id,
  s.name,
  s.status,
  s.start_date,
  s.end_date,
  s.planned_points,
  s.completed_points,
  s.velocity,
  s.goals,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL)     AS total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'todo')        AS tasks_todo,
  COUNT(t.id) FILTER (WHERE t.status = 'in_progress') AS tasks_in_progress,
  COUNT(t.id) FILTER (WHERE t.status = 'done')         AS tasks_completed,
  COUNT(t.id) FILTER (WHERE t.status = 'blocked')      AS tasks_blocked,
  COALESCE(SUM(t.story_points) FILTER (WHERE t.status = 'done'), 0)
    AS actual_completed_points,
  COALESCE(SUM(t.estimated_hours) FILTER (WHERE t.status = 'done'), 0)
    AS actual_completed_hours,
  CASE
    WHEN s.planned_points > 0
    THEN ROUND((COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric
      / NULLIF(COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL), 0)) * 100, 1)
    ELSE NULL
  END AS task_completion_rate_pct
FROM sprints s
LEFT JOIN dev_tasks t ON t.sprint_id = s.id
WHERE s.project_id IS NOT NULL
  AND s.deleted_at IS NULL
GROUP BY
  s.id, s.project_id, s.name, s.status,
  s.start_date, s.end_date, s.planned_points,
  s.completed_points, s.velocity, s.goals;
```

### 4.5 Tasks with Members and Sprints

A three-table view combining tasks with both assignee information and sprint details. Used by the sprint board where full context is needed in a single row.

```sql
CREATE VIEW tasks_with_members_and_sprints AS
SELECT
  t.id,
  t.project_id,
  t.sprint_id,
  t.assigned_to,
  t.parent_task_id,
  t.feature_id,
  t.status,
  t.priority,
  t.task_type,
  t.title,
  t.description,
  t.story_points,
  t.estimated_hours,
  t.actual_hours,
  t.tags,
  t.component_area,
  t.created_at,
  t.updated_at,
  -- Sprint fields
  s.name        AS sprint_name,
  s.status      AS sprint_status,
  s.start_date  AS sprint_start_date,
  s.end_date    AS sprint_end_date,
  -- Member fields
  tm.name       AS member_name,
  tm.email      AS member_email,
  tm.avatar_url AS member_avatar_url,
  tm.headline   AS member_headline
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
LEFT JOIN team_members tm ON tm.id = t.assigned_to
WHERE t.project_id IS NOT NULL
  AND t.deleted_at IS NULL
  AND (t.sprint_id IS NULL OR s.deleted_at IS NULL)
  AND (t.assigned_to IS NULL OR tm.deleted_at IS NULL);
```

---

## 5. Frontend Queries: Views vs. Tables

The frontend queries views using the same Supabase client as tables. The only semantic difference is that views represent pre-joined, pre-filtered datasets.

### 5.1 Querying a View

```typescript
import { useI18n } from '@/hooks/useI18n';
import { useProjectSelection } from '@/contexts/ProjectSelectionContext';

const { selectedProject } = useProjectSelection();

const { data, error, isLoading } = await supabase
  .from('tasks_with_sprints')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .eq('sprint_status', 'active')
  .order('priority', { ascending: false });
```

### 5.2 Querying a Table Directly

Direct table queries are still appropriate for simple, single-table operations:

```typescript
// Creating a task: direct table insert
const { data, error } = await supabase
  .from('dev_tasks')
  .insert({
    project_id: selectedProject?.id,
    title: newTask.title,
    status: 'todo',
    priority: 'medium',
    task_type: 'feature',
  })
  .select()
  .single();

// Updating a task status: direct table update
const { data, error } = await supabase
  .from('dev_tasks')
  .update({ status: 'done', updated_at: new Date().toISOString() })
  .eq('id', taskId)
  .eq('project_id', selectedProject?.id)
  .select()
  .single();
```

### 5.3 Decision Matrix

| Scenario | Approach | Reason |
|----------|----------|--------|
| Read task with sprint name | View | Avoids JOIN duplication |
| Read document with transcript title | View | Encapsulates multi-table JOIN |
| Read aggregated member workload | View | Aggregation logic centralized |
| Read single task by ID | Table | No JOIN needed; direct PK lookup is faster |
| Insert a new task | Table | View is read-only |
| Update task status | Table | Write operation on base table |
| Bulk update tasks | Table | Write operations |
| Read tasks for a specific sprint | View | Consistent JOIN pattern |
| Read sprint velocity metrics | View | Aggregation centralized |

### 5.4 Query Consistency Pattern

All Supabase queries that access project-scoped data must follow this pattern:

```typescript
// ALWAYS: Include project_id filter
const { data } = await supabase
  .from('tasks_with_sprints')
  .select('*')
  .eq('project_id', selectedProject?.id);  // Required on every query

// NEVER: Omit project_id filter on project-scoped data
// const { data } = await supabase
//   .from('tasks_with_sprints')
//   .select('*');  // Missing project_id -- violates isolation
```

---

## 6. RLS Policies on Views

Views in PostgreSQL do not have their own storage; they execute their defining query at runtime. RLS policies on views behave differently depending on whether the view is defined as `SECURITY DEFINER` or `SECURITY INVOKER`.

### 6.1 Security Invoker Views (Default)

Views created without `SECURITY DEFINER` run with the privileges of the invoking user. RLS policies from the underlying base tables are applied as part of the view's query execution.

```sql
-- This view runs with the caller's RLS context
CREATE VIEW tasks_with_sprints AS
SELECT t.*, s.name AS sprint_name
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id IS NOT NULL;
```

With this default definition, when a user queries `tasks_with_sprints`, PostgreSQL applies the RLS policy from `dev_tasks` (which restricts to the user's accessible project_ids) before the JOIN with `sprints` is evaluated. The view naturally respects project isolation through inherited RLS.

### 6.2 Security Definer Views

Views created with `SECURITY DEFINER` run with the privileges of the view owner (typically the schema owner or a service role). RLS policies from base tables are bypassed. In the Workforce project, `SECURITY DEFINER` views should only be used when RLS must be deliberately overridden, such as for administrative views.

```sql
-- Runs with owner privileges; base table RLS is bypassed
CREATE OR REPLACE VIEW admin_all_tasks
  (id, project_id, project_name, title, status, story_points)
SECURITY DEFINER
AS
SELECT
  t.id,
  t.project_id,
  p.name,
  t.title,
  t.status,
  t.story_points
FROM dev_tasks t
JOIN project_knowledge_base p ON p.id = t.project_id
WHERE t.deleted_at IS NULL;
```

**Important**: `SECURITY DEFINER` views bypass RLS entirely. Project isolation must be enforced through explicit WHERE clauses in the view definition (as shown in Section 3). Always document `SECURITY DEFINER` views clearly.

### 6.3 RLS Policies on the View Itself

You can attach RLS policies directly to a view, independent of the underlying tables:

```sql
-- Policy on the view itself
CREATE POLICY view_tasks_with_sprints_select ON tasks_with_sprints
  FOR SELECT USING (
    project_id IN (
      SELECT upa.project_id
      FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
        AND upa.deleted_at IS NULL
    )
  );

ALTER VIEW tasks_with_sprints ENABLE ROW LEVEL SECURITY;
```

When both view-level and table-level RLS policies exist, PostgreSQL applies them as `AND` conditions. This provides double enforcement: even if a table's RLS is somehow misconfigured, the view's policy acts as a safety net.

### 6.4 Recommended Policy Structure for Views

```sql
-- Apply RLS directly on the view
CREATE POLICY tasks_with_sprints_rls ON tasks_with_sprints
  FOR SELECT
  USING (
    project_id IN (
      SELECT upa.project_id
      FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
        AND upa.deleted_at IS NULL
    )
  );

-- Enable RLS on the view
ALTER VIEW tasks_with_sprints ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT SELECT ON tasks_with_sprints TO authenticated;
```

### 6.5 Testing RLS on Views

Verify that RLS is working correctly on views by testing with different user contexts:

```sql
-- As an unprivileged user, check that only accessible projects are visible
SELECT DISTINCT project_id
FROM tasks_with_sprints;

-- The result should match the user's entries in user_project_access

-- As a service role (bypassing RLS), verify data completeness
SET ROLE service_role;
SELECT COUNT(*) FROM tasks_with_sprints;
RESET ROLE;
```

---

## 7. Summary of Best Practices

1. **Encapsulate multi-table JOINs in views**: Any query joining two or more tables and filtering by `project_id` should be a view. This prevents duplication and enforces consistent filtering.
2. **Name views following the snake_case pattern**: `<base_table>_with_<related>[_and_<related>]`.
3. **Filter at the outer level**: Always include explicit `project_id IS NOT NULL` and soft-delete filters in the view's WHERE clause. Do not rely solely on RLS.
4. **Default to Security Invoker**: Use `SECURITY DEFINER` only for administrative views that must bypass RLS, and document this explicitly.
5. **Attach RLS policies to views**: Apply project isolation policies directly on the view in addition to the base tables for defense in depth.
6. **Query views with project_id**: Frontend code must always pass `.eq('project_id', selectedProject?.id)` when querying views, just as it does for tables.
7. **Use views for reads, tables for writes**: Views are read-only. All insert, update, and delete operations continue to target base tables.
8. **Keep views stable**: Views represent established data combinations. If a query need changes frequently, it may not be a good candidate for a view.

---

## 8. Related Documentation

- [Database Schema](../04-database-schema/schema.md) -- Tables, columns, relationships, and base RLS policies
- [Project Context System](../06-project-context/context-system.md) -- `useProjectSelection()` hook and project isolation enforcement
- [Supabase Functions](../12-supabase-functions/functions.md) -- Edge Function API patterns that query views server-side
