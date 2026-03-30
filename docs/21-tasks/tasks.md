---
name: tasks
description: dev_tasks table, task statuses, assignments, area classification, task creation
area: 21
maintained_by: tasks-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Tasks

## Overview

Tasks represent units of work within a project. They are the atomic building blocks of sprint planning and track all development work from initial planning through completion. The `dev_tasks` table stores every task with its metadata, relationships to sprints and team members, and workflow status.

## dev_tasks Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| project_id | UUID | Project association (REQUIRED) |
| title | TEXT | Task title (required, non-empty) |
| description | TEXT | Detailed task description |
| task_type | task_type | Classification type (default: feature) |
| status | task_status | Current workflow status (default: todo) |
| priority | task_priority | Priority level (default: medium) |
| tags | TEXT[] | Array of string tags for categorization |
| component_area | TEXT | Area classification for UI theming |
| estimated_hours | INTEGER | Original time estimate (default: 0) |
| actual_hours | INTEGER | Time spent working on task (default: 0) |
| story_points | INTEGER | Agile story points estimate (default: 0) |
| parent_task_id | UUID | Optional parent task for subtasks |
| dependencies | JSONB | Task dependency relationships |
| feature_id | UUID | Optional link to parent feature |
| generated_from_interaction_id | UUID | AI interaction that generated this task |
| ai_metadata | JSONB | AI-specific metadata |
| created_by | TEXT | User who created the task |
| assigned_to | UUID | team_members.id |
| sprint_id | UUID | sprints.id |
| jira_issue_key | TEXT | External Jira issue key |
| jira_issue_id | TEXT | External Jira issue ID |
| jira_sync_status | TEXT | synced / pending / error / conflict |
| jira_last_synced_at | TIMESTAMP | Last Jira sync timestamp |
| jira_sync_enabled | BOOLEAN | Enable Jira synchronization (default: false) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last modification |
| deleted_at | TIMESTAMP | Soft delete timestamp |

### Constraints

- `title` must be non-empty (trimmed)
- `jira_sync_status` must be one of: synced, pending, error, conflict

### Relationships

| Relationship | Target Table | Notes |
|-------------|--------------|-------|
| project_id | projects | REQUIRED - all tasks must belong to a project |
| sprint_id | sprints | Optional - tasks may be backlogged |
| assigned_to | team_members | Optional - unassigned tasks are allowed |
| feature_id | features | Optional - groups tasks under a feature |
| parent_task_id | dev_tasks | Enables subtask hierarchy |

## Task Statuses

| Status | Label | Description |
|--------|-------|-------------|
| todo | To Do | Task created but work has not started |
| in_progress | In Progress | Work is actively underway |
| in_review | In Review | Work submitted for code/design review |
| testing | Testing | Work is being validated by QA |
| blocked | Blocked | Task cannot proceed due to external dependency or issue |
| done | Done | Task completed and accepted |
| cancelled | Cancelled | Task cancelled and will not be worked on |

## Status Transition Diagram

```
                                    [cancelled]
                                        ^
                                        |
                                        X (any state can be cancelled)

[blocked] <---- [in_progress] ----> [in_review]
    ^                |                  |
    |                v                  v
    |           [testing] <------- [in_review] (if review fails)
    |                |
    |                v
    +---------> [done]

[todo] ----> [in_progress] ----> [done]
```

### Valid Transitions

| From | To | Notes |
|------|----|-------|
| todo | in_progress | Start working on task |
| todo | cancelled | Cancel without starting |
| in_progress | in_review | Submit for review |
| in_progress | testing | Move to QA phase |
| in_progress | blocked | Encounter blocking issue |
| in_progress | cancelled | Cancel while working |
| in_review | testing | Review passed |
| in_review | in_progress | Review rejected, return to work |
| in_review | cancelled | Cancel after review |
| testing | done | QA passed |
| testing | in_progress | QA failed, return to work |
| testing | cancelled | Cancel after testing |
| blocked | in_progress | Block resolved |
| blocked | cancelled | Cancel blocked task |

## Area Assignment

Tasks are classified by `component_area` which determines UI theming across the application.

| Area | Color | Hex | Usage |
|------|-------|-----|-------|
| planning | Dark Gold | #B8860B | Requirements, user stories, roadmaps |
| development | Gray/Silver | #9E9E9E | Implementation, coding, features |
| testing / quality | Bronze | #CD7F32 | QA, bugs, test cases, validation |
| governance | Dark Green | #1B4332 | Settings, compliance, administration |

### Setting Component Area

The `component_area` field is set based on the source document type during task generation:

- PRD documents -> planning
- User Stories -> planning
- Technical Specs -> development
- Test Cases -> testing/quality
- Meeting Notes -> planning
- Bug Reports -> testing/quality

### Querying by Area

```typescript
// Filter tasks by component_area
const { data: planningTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .eq('component_area', 'planning')
  .is('deleted_at', null);
```

## Task Types

| Type | Label | Description |
|------|-------|-------------|
| feature | Feature | New functional capability |
| bug | Bug | Defect or issue fix |
| enhancement | Enhancement | Improve existing feature |
| technical_debt | Technical Debt | Code quality refactoring |
| research | Research | Investigation or discovery work |
| documentation | Documentation | Documentation creation/update |
| testing | Testing | QA testing tasks |
| test | Test | Unit or integration test |
| deployment | Deployment | Release and deployment tasks |
| maintenance | Maintenance | Ongoing maintenance work |
| refactor | Refactor | Code restructuring |

## Priority Levels

| Priority | Label | Description |
|----------|-------|-------------|
| low | Low | Nice to have, can be deprioritized |
| medium | Medium | Standard priority |
| high | High | Important, should be prioritized |
| critical | Critical | Must complete for release |
| urgent | Urgent | Immediate attention required |

## Query Patterns

### Tasks by Project

All queries must filter by `project_id` for data isolation.

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks } = useQuery({
  queryKey: ['tasks', selectedProject?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('dev_tasks')
      .select('*')
      .eq('project_id', selectedProject?.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProject?.id,
});
```

### Tasks by Sprint

```typescript
// All tasks in a specific sprint
const { data: sprintTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .eq('sprint_id', sprintId)
  .is('deleted_at', null)
  .order('priority', { ascending: false });

// Tasks NOT assigned to any sprint (backlog)
const { data: backlogTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .is('sprint_id', null)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

// Multiple sprints with 'no-sprint' option
const { data: mixedTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .or(`sprint_id.in.(${sprintIds.join(',')}),sprint_id.is.null`)
  .is('deleted_at', null);
```

### Tasks by Team Member

```typescript
// Tasks assigned to a specific member
const { data: assignedTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .eq('assigned_to', memberId)
  .is('deleted_at', null)
  .order('priority', { ascending: false });

// Unassigned tasks
const { data: unassignedTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .is('assigned_to', null)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });

// Using TaskService
const taskService = new TaskService();
const tasks = await taskService.getTasksByAssignee(memberId);
```

### Tasks by Area

```typescript
// Tasks by component_area
const { data: developmentTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .eq('component_area', 'development')
  .is('deleted_at', null);

// Multiple areas
const { data: mixedAreaTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .in('component_area', ['planning', 'development'])
  .is('deleted_at', null);
```

### Tasks by Status

```typescript
// Active tasks (excluding done and cancelled)
const { data: activeTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .neq('status', 'done')
  .neq('status', 'cancelled')
  .is('deleted_at', null);

// Tasks by multiple statuses
const { data: blockedAndInProgress } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .in('status', ['blocked', 'in_progress'])
  .is('deleted_at', null);
```

### Tasks by Feature

```typescript
// All tasks linked to a feature
const { data: featureTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .eq('feature_id', featureId)
  .is('deleted_at', null);

// Tasks without a feature (loose tasks)
const { data: looseTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', projectId)
  .is('feature_id', null)
  .is('deleted_at', null);
```

### Using TaskService

The `TaskService` class in `src/lib/services/task-service.ts` provides centralized query methods:

```typescript
import { taskService } from '@/lib/services/task-service';

// Fetch with filters
const tasks = await taskService.fetchTasks(projectId, {
  status: ['todo', 'in_progress'],
  priority: ['high', 'critical'],
  component_area: ['development'],
  assigned_to: [memberId],
});

// Get tasks by sprint
const sprintTasks = await taskService.getTasksBySprint(sprintId);

// Get tasks by feature
const featureTasks = await taskService.getTasksByFeature(featureId);

// Get task statistics
const stats = await taskService.getTaskStatistics(projectId);
// Returns: total_tasks, completed_tasks, in_progress_tasks, blocked_tasks,
// by_status, by_priority, by_type, total_story_points, etc.

// Batch operations
const updated = await taskService.batchUpdateTasks(taskIds, projectId, {
  status: 'done',
  sprint_id: sprintId,
});

// Assign tasks to sprint
await taskService.assignTasksToSprint(taskIds, sprintId);
```

### View with Relations

The `view_dev_tasks_with_relations` view joins task data with related records:

```sql
SELECT
  dt.id,
  dt.title,
  dt.status,
  dt.priority,
  dt.project_id,
  dt.sprint_id,
  dt.assigned_to,
  -- Joined data
  team_member.name  AS assigned_to_name,
  sprints.name      AS sprint_name,
  features.title    AS feature_title
FROM view_dev_tasks_with_relations dt
WHERE dt.project_id = 'uuid-here';
```

## Task Creation

### Legacy Method (Deprecated)

The legacy task creation used `generateDocumentsWithOpenAI()` from `src/lib/openai.ts`. This method is deprecated but still used by some legacy components (TaskFileUploadDialog, TaskCreationFromTranscriptDialog, Convert page).

```typescript
// DEPRECATED - Do not use for new implementations
import { generateDocumentsWithOpenAI } from '@/lib/openai';

const documents = await generateDocumentsWithOpenAI(
  transcript,
  prompt,
  ['tasks'],  // Request task generation
  project
);

const taskContent = documents.tasks; // Raw task text from AI
```

### Current Method: Edge Functions

Task generation has been migrated to Edge Functions for better security and tracking.

```typescript
import { generateTasksAPI } from '@/lib/services/document-generation-service';

// Generate tasks from document content
const result = await generateTasksAPI(
  transcriptContent,      // Input content
  projectId,               // Project context
  meetingTranscriptId,     // Optional transcript reference
  userId                   // Optional user tracking
);

if (result.success) {
  const { tasks, response_id } = result;
  // Tasks are automatically saved to dev_tasks table
}
```

### UI Workflow: GenerateTasksModal

The frontend component `GenerateTasksModal` orchestrates task creation:

1. User selects a document to generate tasks from
2. Optionally links tasks to a feature
3. Optionally provides additional AI guidance
4. Clicks "Generate with AI" to call the Edge Function
5. Reviews and edits generated tasks inline
6. Saves all tasks to the database

```typescript
// Component usage
<GenerateTasksModal
  open={isOpen}
  onOpenChange={setIsOpen}
  document={selectedDocument}
  projectId={projectId}
  onSuccess={(tasks) => console.log('Created:', tasks)}
/>
```

## Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Tasks not showing | Wrong project selected | Verify `selectedProject?.id` is set |
| Cannot assign task | User not in project team | Add user to `project_team_members` table |
| Sprint tasks missing | `sprint_id` not set on tasks | Edit tasks to assign sprint |
| Task status stuck | Invalid transition attempted | Check valid transition paths |
| Area not styled | `component_area` not set | Set area during task creation |
| Parent task has subtasks | `parent_task_id` used | Subtasks inherit parent's sprint/feature |

## Related Topics

- [Sprints](../22-sprints/sprints.md) - Sprint planning and velocity tracking
- [Features](../20-projects/projects.md) - Feature grouping
- [Team Members](../17-team-members/members.md) - Team member assignments
- [Project Context](../06-project-context/context-system.md) - Project isolation pattern
- [Database Schema](../04-database-schema/schema.md) - Full schema reference
