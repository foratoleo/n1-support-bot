---
name: sprints
description: sprints table, sprint planning, velocity tracking, burndown, sprint-task relationships
area: 22
maintained_by: sprint-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Sprints

## Overview

Sprints are time-boxed development iterations within a project. They provide a structured framework for planning, executing, and measuring software delivery. Each sprint has a defined duration (typically 1-2 weeks), a set of goals, and a collection of tasks that team members work on during that period.

The sprint system integrates with the broader project management infrastructure, linking tasks, features, team members, and analytics into a cohesive workflow. Sprint data is organized by `project_id`, ensuring proper data isolation across multiple projects.

## sprints Table

The `sprints` table stores all sprint records. It uses UUID as the primary key and includes comprehensive fields for sprint planning and tracking.

### Schema Definition

```sql
CREATE TABLE IF NOT EXISTS "public"."sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "project_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "public"."sprint_status" DEFAULT 'planning'::"public"."sprint_status",
    "goals" "text"[] DEFAULT ARRAY[]::"text"[],
    "planned_points" integer,
    "completed_points" integer,
    "velocity" numeric(5,2),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "valid_name_length" CHECK ((("length"(("name")::"text") >= 1) AND ("length"(("name")::"text") <= 255))),
    CONSTRAINT "valid_points" CHECK (((("planned_points" IS NULL) OR ("planned_points" >= 0)) AND (("completed_points" IS NULL) OR ("completed_points" >= 0))))
);
```

### Field Reference

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | Primary key, auto-generated | Unique sprint identifier |
| `project_id` | UUID | NOT NULL, FK to `project_knowledge_base` | Associates sprint with a project |
| `name` | VARCHAR(255) | NOT NULL, 1-255 chars | Sprint display name (e.g., "Sprint 3") |
| `description` | TEXT | NULL | Detailed description of sprint objectives |
| `start_date` | DATE | NOT NULL | Sprint start date (inclusive) |
| `end_date` | DATE | NOT NULL | Sprint end date (inclusive) |
| `status` | sprint_status | DEFAULT 'planning' | Current sprint lifecycle status |
| `goals` | TEXT[] | DEFAULT empty array | Array of sprint goal strings |
| `planned_points` | INTEGER | >= 0 | Total story points planned for sprint |
| `completed_points` | INTEGER | >= 0 | Total story points completed in sprint |
| `velocity` | NUMERIC(5,2) | NULL | Calculated velocity (story points per week) |
| `created_by` | UUID | NULL | User who created the sprint |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |
| `deleted_at` | TIMESTAMPTZ | NULL | Soft delete timestamp |

### Database Constraints

| Constraint | Expression | Description |
|------------|------------|-------------|
| `valid_date_range` | `end_date >= start_date` | End date must be on or after start date |
| `valid_name_length` | `LENGTH(name) BETWEEN 1 AND 255` | Name must be non-empty and under 255 characters |
| `valid_points` | `planned_points >= 0 AND completed_points >= 0` | Point values cannot be negative |

### Indexes

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `idx_sprints_project_id` | `project_id` | Fast lookup by project |
| `idx_sprints_status` | `status` | Fast filter by status |
| `idx_sprints_dates` | `start_date, end_date` | Date range queries |
| `idx_sprints_project_status` | `project_id, status` | Combined project and status filter |
| `idx_sprints_team_id` | `team_id` | Team-based sprint queries |

## Sprint Statuses

Sprints transition through a defined lifecycle. The `sprint_status` enum governs these transitions.

### Status Values

| Status | Value | Description |
|--------|-------|-------------|
| `planning` | Planning | Sprint is created but not yet started. Tasks can be assigned and goals can be set. |
| `active` | Active | Sprint is in progress. Team is actively working on assigned tasks. |
| `completed` | Completed | Sprint has ended. All work is reviewed and velocity is calculated. |
| `cancelled` | Cancelled | Sprint was cancelled before completion. No further work is expected. |

### Status Transition Flow

```
[Created] --> planning --> active --> completed --> [Archived]
                      |         |
                      +----> cancelled --> [Archived]
```

### Auto-Status Suggestions

The system can suggest appropriate status based on current date:

```typescript
function getSuggestedStatus(startDate: string, endDate: string): SprintStatus {
  const today = new Date();

  if (isAfter(start, today)) {
    return 'planning';    // Start date is in the future
  } else if (isWithinInterval(today, { start, end })) {
    return 'active';      // Today falls within sprint dates
  } else {
    return 'completed';   // End date has passed
  }
}
```

## Sprint Planning Workflow

Planning a sprint involves three key activities: selecting or creating the sprint, assigning tasks, and defining sprint goals.

### Step 1: Create Sprint

```typescript
import { sprintService } from '@/lib/services/sprint-service';

const sprint = await sprintService.createSprint({
  name: 'Sprint 3',
  project_id: selectedProject.id,
  start_date: '2025-01-15',
  end_date: '2025-01-29',
  goals: ['Implement user authentication', 'Add role-based access control'],
  planned_points: 50,
});
```

### Step 2: Assign Tasks to Sprint

Tasks are linked to sprints via the `sprint_id` field on `dev_tasks`. There are two primary methods for assignment:

#### Method A: Drag and Drop (UI)

The `SprintTaskManager` component provides a visual interface with two columns: Backlog and Sprint. Users can drag tasks from backlog to sprint, or use checkboxes for bulk selection.

#### Method B: Direct Update (API)

```typescript
// Add task to sprint
await taskService.updateTask(taskId, { sprint_id: sprintId });

// Remove task from sprint
await taskService.updateTask(taskId, { sprint_id: undefined });
```

#### Task Assignment Rules

- Only tasks with status other than `done` or `cancelled` should be added to a sprint.
- Tasks can be moved between sprints or back to backlog at any time during planning.
- During an active sprint, moving tasks in or out constitutes scope change and affects scope stability metrics.

### Step 3: Set Sprint Goals

Sprint goals are stored as a `TEXT[]` array, allowing multiple discrete objectives per sprint:

```typescript
// Set goals when creating
const goals = [
  'Complete user authentication module',
  'Reduce API response time by 30%',
  'Write unit tests for core services',
];

// Goals can be updated at any time
await sprintService.updateSprint(sprintId, { goals });
```

### Step 4: Activate Sprint

When the start date arrives, the sprint status changes to `active`:

```typescript
await sprintService.updateSprint(sprintId, { status: 'active' });
```

## Velocity Tracking

Velocity measures the rate at which a team completes work, expressed in story points per sprint.

### Velocity Calculation Formula

The velocity calculation normalizes points by sprint duration:

```
Velocity = Completed Story Points / Sprint Duration in Weeks
```

### Implementation

```typescript
function calculateVelocity(completedPoints: number, durationDays: number): number {
  const durationWeeks = durationDays / 7;
  if (durationWeeks <= 0) return 0;
  return Math.round((completedPoints / durationWeeks) * 10) / 10;
}
```

### Example Calculation

For a 2-week sprint (14 days):

| Completed Points | Duration Weeks | Velocity |
|-----------------|----------------|----------|
| 30 | 2 | 15.0 |
| 45 | 2 | 22.5 |
| 20 | 2 | 10.0 |

### Historical Velocity

The system tracks velocity across completed sprints to calculate averages:

```typescript
const velocityHistory = sprints
  .filter(s => s.status === 'completed')
  .map(s => ({
    name: s.name,
    velocity: s.velocity,
    completedPoints: s.completed_points,
  }));

const averageVelocity = velocityHistory.reduce((sum, s) => sum + s.velocity, 0)
  / velocityHistory.length;
```

### Velocity Trend Analysis

Velocity trends are calculated by comparing recent sprints against older ones:

```typescript
function determineVelocityTrend(velocityHistory: VelocityDataPoint[]): 'up' | 'down' | 'stable' {
  if (velocityHistory.length < 3) return 'stable';

  const recent = velocityHistory.slice(-3);
  const older = velocityHistory.slice(0, -3);

  if (older.length > 0) {
    const recentAvg = average(recent.map(s => s.velocity));
    const olderAvg = average(older.map(s => s.velocity));

    if (recentAvg > olderAvg * 1.1) return 'up';
    if (recentAvg < olderAvg * 0.9) return 'down';
  }

  return 'stable';
}
```

## Burndown Tracking

Burndown charts visualize remaining work over the sprint duration, comparing actual progress against an ideal linear burndown.

### Burndown Data Structure

```typescript
interface BurndownDataPoint {
  date: string;        // Formatted date label (e.g., "Jan 15")
  ideal: number;      // Ideal remaining points (linear decrease)
  actual?: number;     // Actual remaining points (from snapshots)
}
```

### Burndown Calculation

```typescript
function buildBurndownData(
  sprint: Sprint,
  snapshots: SprintDailySnapshot[]
): BurndownDataPoint[] {
  const start = parseISO(sprint.start_date);
  const end = parseISO(sprint.end_date);
  const allDays = eachDayOfInterval({ start, end });
  const totalPoints = snapshots[0]?.total_points ?? 0;

  // Calculate ideal burndown: linear decrease from total to zero
  const idealPerDay = totalPoints / (allDays.length - 1);

  return allDays.map((day, index) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const snapshot = snapshots.find(s => s.snapshot_date === dateStr);

    return {
      date: format(day, 'MMM dd'),
      ideal: Math.max(0, Math.round((totalPoints - idealPerDay * index) * 10) / 10),
      actual: snapshot?.remaining_points,
    };
  });
}
```

### Ideal vs Actual Burndown

| Line | Description |
|------|-------------|
| **Ideal** | Linear decrease from `totalPoints` on day 0 to 0 on the last day |
| **Actual** | Real remaining points based on task completion snapshots |

### Daily Snapshots

The system records daily snapshots for accurate burndown tracking:

```sql
CREATE TABLE sprint_daily_snapshots (
  id UUID PRIMARY KEY,
  sprint_id UUID REFERENCES sprints(id),
  snapshot_date DATE,
  total_points INTEGER,
  remaining_points INTEGER,
  completed_points INTEGER,
  todo_tasks INTEGER,
  in_progress_tasks INTEGER,
  blocked_tasks INTEGER
);
```

## Sprint-Task Relationships

Tasks are linked to sprints through the `sprint_id` foreign key on the `dev_tasks` table.

### Relationship Schema

```sql
ALTER TABLE dev_tasks ADD COLUMN sprint_id UUID REFERENCES sprints(id);
```

### Querying Sprint Tasks

```typescript
// Get all tasks for a specific sprint
const { data: sprintTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('sprint_id', sprintId)
  .is('deleted_at', null);

// Get backlog tasks (no sprint assigned)
const { data: backlogTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .is('sprint_id', null)
  .eq('status', 'todo');
```

### View: view_sprints_with_stats

A pre-computed view aggregates sprint statistics for efficient queries:

```sql
CREATE OR REPLACE VIEW view_sprints_with_stats AS
SELECT
  s.*,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.deleted_at IS NULL) AS total_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'done' AND dt.deleted_at IS NULL) AS completed_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'in_progress' AND dt.deleted_at IS NULL) AS in_progress_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'testing' AND dt.deleted_at IS NULL) AS testing_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'in_review' AND dt.deleted_at IS NULL) AS in_review_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'todo' AND dt.deleted_at IS NULL) AS todo_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'blocked' AND dt.deleted_at IS NULL) AS blocked_tasks,
  COALESCE(SUM(dt.story_points) FILTER (WHERE dt.deleted_at IS NULL), 0) AS total_story_points,
  COALESCE(SUM(dt.story_points) FILTER (WHERE dt.status = 'done' AND dt.deleted_at IS NULL), 0) AS completed_story_points
FROM sprints s
LEFT JOIN dev_tasks dt ON s.id = dt.sprint_id
GROUP BY s.id;
```

### Using the Stats View

```typescript
const { data: sprintWithStats } = await supabase
  .from('view_sprints_with_stats')
  .select('*')
  .eq('id', sprintId)
  .single();

// Access aggregated data
const {
  total_tasks,
  completed_tasks,
  total_story_points,
  completed_story_points,
} = sprintWithStats;

// Calculate progress
const progress = total_tasks > 0
  ? Math.round((completed_tasks / total_tasks) * 100)
  : 0;
```

## Current Sprint Selection

The system supports identifying and working with the currently active sprint.

### Finding the Active Sprint

```typescript
// Method 1: Query by status
const { data: activeSprint } = await supabase
  .from('sprints')
  .select('*')
  .eq('project_id', selectedProjectId)
  .eq('status', 'active')
  .single();

// Method 2: Query by date overlap
const { data: activeSprint } = await supabase
  .from('sprints')
  .select('*')
  .eq('project_id', selectedProjectId)
  .lte('start_date', today)
  .gte('end_date', today)
  .single();
```

### Active Sprint Helper

```typescript
function isSprintActive(sprint: Sprint): boolean {
  if (sprint.status !== 'active') return false;

  const today = new Date();
  const start = parseISO(sprint.start_date);
  const end = parseISO(sprint.end_date);

  return isWithinInterval(today, { start, end });
}
```

### Sprint Progress

```typescript
function calculateSprintProgress(sprint: Sprint): number {
  if (sprint.status === 'completed') return 100;
  if (sprint.status !== 'active') return 0;

  const totalDays = differenceInDays(
    parseISO(sprint.end_date),
    parseISO(sprint.start_date)
  ) + 1;

  const elapsedDays = Math.max(
    0,
    differenceInDays(new Date(), parseISO(sprint.start_date))
  );

  return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
}
```

## Batch Sprint Creation

For teams that plan sprints in advance, batch creation generates multiple consecutive sprints with consistent parameters.

### Configuration

```typescript
interface BatchSprintConfig {
  quantity: number;           // Number of sprints to create
  durationWeeks: number;       // Duration of each sprint (1-6 weeks)
  startDay: number;           // Day of week for sprint start (0=Sunday)
  endDay: number;             // Day of week for sprint end (0=Sunday)
  firstSprintStartDate: string;  // Start date for first sprint
  prefix?: string;            // Optional name prefix
}
```

### Example Usage

```typescript
const config: BatchSprintConfig = {
  quantity: 4,
  durationWeeks: 2,
  startDay: 1,  // Monday
  endDay: 5,    // Friday
  firstSprintStartDate: '2025-01-06',
  prefix: 'Sprint',
};

// Generates:
// Sprint 1: 2025-01-06 to 2025-01-17
// Sprint 2: 2025-01-20 to 2025-01-31
// Sprint 3: 2025-02-03 to 2025-02-14
// Sprint 4: 2025-02-17 to 2025-02-28
```

### Overlap Detection

Before creating batch sprints, the system checks for date conflicts with existing sprints:

```typescript
function checkBatchOverlaps(
  generatedDates: GeneratedSprintDates[],
  existingSprints: Sprint[]
): BatchOverlapResult[] {
  return generatedDates.map((generated, index) => {
    const overlapping = existingSprints
      .filter(s => s.status !== 'cancelled')
      .filter(s => dateRangesOverlap(
        generated.startDate, generated.endDate,
        s.start_date, s.end_date
      ))
      .map(s => s.name);

    return {
      index,
      hasOverlap: overlapping.length > 0,
      overlappingSprintNames: overlapping,
    };
  });
}
```

## API Endpoints

### List Sprints

```
POST /functions/v1/api-sprints-list
```

**Request:**
```json
{
  "projectId": "uuid",
  "status": ["active", "planning"],
  "includeStats": true,
  "page": 1,
  "limit": 10
}
```

### Get Sprint Details

```
POST /functions/v1/api-sprint-details
```

**Request:**
```json
{
  "projectId": "uuid",
  "sprintId": "uuid",
  "includeTasks": true
}
```

## Common Troubleshooting

| Issue | Likely Cause | Solution |
|-------|-------------|----------|
| No sprints displayed | Incorrect project selected | Verify `selectedProject?.id` is set correctly |
| Cannot change sprint status | Invalid date configuration | Ensure `end_date >= start_date` |
| Velocity shows zero | Tasks not marked as `done` | Complete tasks to increment velocity |
| Burndown shows flat line | No daily snapshots recorded | Ensure `sprint_daily_snapshots` is populated |
| Tasks not appearing in sprint | `sprint_id` not set | Assign tasks via task manager or API |
| Batch creation fails | Date overlap with existing sprint | Check overlap before creating |

## Related Documentation

- [Tasks](../21-tasks/tasks.md) - Task management and status workflow
- [Projects](../20-projects/projects.md) - Project context and isolation
- [Database Schema](../04-database-schema/schema.md) - Table definitions and relationships
- [Component Organization](../14-component-organization/components.md) - Sprint-related UI components
- [API Endpoints](../11-api-endpoints/endpoints.md) - Sprint API reference
