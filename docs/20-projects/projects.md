---
name: projects
description: project_knowledge_base, project creation, settings, isolation architecture
area: 20
maintained_by: project-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Projects

## Overview

Projects are the top-level organizational unit in the Workforce platform. Every piece of data in the system -- tasks, sprints, meeting transcripts, generated documents, and AI interactions -- is scoped to a specific project. The project defines the boundary of data isolation, ensuring that users can only access information within projects they have been explicitly granted access to.

At the database level, the `project_knowledge_base` table serves as the central anchor for all project-scoped data. Every core table maintains a foreign key to this table, and Row Level Security (RLS) policies enforce isolation at the database layer. At the application layer, the `useProjectSelection()` hook provides the active project context and is the single source of truth for determining which project is currently in use.

## Data Model

### Project Hierarchy

```
profiles (user account)
  |
  v
user_project_access (grants project access)
  |
  v
project_knowledge_base (project -- the isolation boundary)
  |
  +-- sprints (development iterations)
  +-- dev_tasks (tasks and user stories)
  +-- meeting_transcripts (meeting records for AI processing)
  +-- generated_documents (AI-produced PRDs, specs, test cases, etc.)
  +-- ai_interactions (token usage and cost tracking)
  +-- features (feature definitions)
  +-- backlog_items (backlog entries)

project_knowledge_base
  |
  +-- project_team_members (links to team_members with role)
        |
        v
        team_members (globally visible, assigned to tasks across projects)
              |
              +-- team_member_skills
              +-- team_member_tools
```

## project_knowledge_base Table

The `project_knowledge_base` table is the central repository for all project metadata. It stores the project's identity, configuration, and leadership information, serving as the anchor for all project-scoped data in the system.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key; referenced as project_id by all scoped tables |
| name | text | NO | null | Project display name |
| description | text | NO | null | Project description |
| category | text | YES | null | Project category or type (e.g., "web-app", "mobile", "api") |
| owner | uuid | YES | null | FK to profiles.id -- the project owner |
| context_data | jsonb | YES | '{}'::jsonb | Flexible metadata storage for custom project fields |
| is_active | boolean | YES | true | Soft-delete flag; inactive projects are hidden from most queries |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |
| tags | text[] | YES | '{}'::text[] | Project tags for filtering and categorization |
| git_repository_url | text | YES | null | Linked Git repository URL |
| jira_url | text | YES | null | Linked Jira instance URL |
| logo_url | text | YES | null | Project logo image URL |
| icon | text | YES | null | Project icon identifier (used in the UI) |
| color | text | YES | null | Project color theme (hex value for UI theming) |
| leaders_managers | jsonb | YES | '[]'::jsonb | Project leadership information (name, role, contact) |
| team_member_links | jsonb | YES | '[]'::jsonb | Team member associations and metadata |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |

### Relationships

- **owner** -> `profiles.id` (N:1, optional): The user who owns and administers the project.
- **Referenced by**: All core scoped tables (`dev_tasks`, `sprints`, `generated_documents`, `ai_interactions`, `meeting_transcripts`, `features`, `backlog_items`) as the primary project isolation anchor via `project_id`.
- **Join table**: `project_team_members` links team members to projects with role information.

### RLS Policies

Access to projects is controlled through the `user_project_access` table. A user can only see or interact with a project if they have a non-deleted access record in that table.

```sql
-- Project visibility: user must have a record in user_project_access
CREATE POLICY project_isolation_select ON project_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_project_access
      WHERE user_project_access.project_id = project_knowledge_base.id
      AND user_project_access.user_id = auth.uid()
      AND user_project_access.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `owner`
- Index on `is_active`
- Index on `deleted_at`

---

## Project Creation and Settings

### Creating a Project

Project creation is typically performed by an administrator. The process involves inserting a record into `project_knowledge_base` and then granting access to users via `user_project_access`.

**Steps:**

1. An administrator inserts a new record into `project_knowledge_base` with `name`, `description`, and optionally `category`, `tags`, `git_repository_url`, `jira_url`, `icon`, `color`, and other configuration fields.
2. The project owner is set via the `owner` column (FK to `profiles.id`).
3. Users who need access are added to `user_project_access` with their `user_id` and `project_id`.
4. Team members are linked to the project through `project_team_members`, associating each member with a role (e.g., "developer", "qa", "product-owner").
5. Once these steps are complete, all data operations scoped to this project will work correctly through the `project_id` filter.

**Example: Inserting a new project (SQL)**

```sql
INSERT INTO project_knowledge_base (name, description, category, owner, tags, git_repository_url, jira_url)
VALUES (
  'E-Commerce Platform Redesign',
  'Full redesign of the customer-facing e-commerce experience with new checkout flow and mobile optimization.',
  'web-app',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',  -- owner profile ID
  ARRAY['frontend', 'ux', 'mobile-first'],
  'https://github.com/org/ecommerce-platform',
  'https://company.atlassian.net/jira/projects/ECOM'
)
RETURNING id;
```

**Example: Granting user access (SQL)**

```sql
INSERT INTO user_project_access (user_id, project_id, created_by)
VALUES (
  'user-uuid-to-grant',
  'project-uuid-from-insert',
  'admin-uuid'
);
```

**Example: Linking team members (SQL)**

```sql
INSERT INTO project_team_members (project_id, member_id, role)
VALUES
  ('project-uuid', 'member-uuid-1', 'frontend-developer'),
  ('project-uuid', 'member-uuid-2', 'backend-developer'),
  ('project-uuid', 'member-uuid-3', 'product-owner');
```

### Project Settings

Projects support several configuration options that affect behavior and appearance:

| Setting | Column | Description |
|---------|--------|-------------|
| Project Name | `name` | The display name shown across the UI |
| Description | `description` | A brief description of the project's purpose and scope |
| Category | `category` | A type identifier used for filtering and organization |
| Tags | `tags` | An array of text tags for further classification |
| Git Repository | `git_repository_url` | URL to the linked Git repository |
| Jira URL | `jira_url` | URL to the linked Jira instance |
| Icon | `icon` | Icon identifier used in the project selector and header |
| Color | `color` | Hex color code used to theme the project's UI elements |
| Logo | `logo_url` | URL to a custom project logo image |
| Leadership | `leaders_managers` | JSONB array of leadership roles and contacts |
| Active Status | `is_active` | Controls visibility; inactive projects are hidden from most queries |

### Branding Fields

The `icon`, `color`, and `logo_url` fields allow per-project theming. The UI applies these values to the project header and selector components, giving each project a distinct visual identity.

---

## Project Knowledge Base Structure

The project knowledge base functions as a central repository for all project-related information. Beyond the metadata in `project_knowledge_base`, the repository encompasses:

**Tasks and Work Items**

All development tasks are stored in `dev_tasks` and scoped to a project via `project_id`. Tasks can be assigned to sprints, assigned to team members, organized into features, and tagged for categorization. The project provides the top-level container for all work tracking.

**Sprints**

Development iterations are stored in `sprints` and scoped to a project. Each sprint has a defined start and end date, planned and completed story points, and a velocity metric. Sprints group tasks within the project scope.

**Meeting Transcripts**

Records of meetings are stored in `meeting_transcripts` and scoped to a project. These transcripts serve as input for AI-powered document generation, producing PRDs, user stories, technical specs, test cases, and meeting notes.

**Generated Documents**

AI-produced documents are stored in `generated_documents` and scoped to a project. Each document is linked to a source meeting transcript and an AI interaction record. Documents support versioning, approval workflows, and quality scoring.

**AI Interactions**

Every AI operation (document generation, task creation, analysis) is tracked in `ai_interactions` and scoped to a project. Each interaction records token usage, cost, model, duration, and quality metrics, enabling project-level AI budget tracking.

---

## Project-Level Data Isolation

Data isolation is the most critical architectural constraint in the system. Every table that contains project-scoped data must include a `project_id` column, and every query and mutation must filter by that column. Isolation is enforced at two layers: the application layer (through `useProjectSelection()`) and the database layer (through RLS policies).

### The Isolation Rule

**Every Supabase query that reads or writes project-scoped data must include a `project_id` filter.**

```typescript
// WRONG -- no project filter, returns data from all projects (or nothing due to RLS)
const { data } = await supabase.from('dev_tasks').select('*');

// WRONG -- uses undefined value, produces empty results
const { selectedProjectId } = useProjectSelection();
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProjectId);  // selectedProjectId is always undefined

// CORRECT -- derives project ID from selectedProject object
const { selectedProject } = useProjectSelection();
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProject?.id);  // safe -- returns undefined if no project
```

### Tables That Require Project Isolation

| Table | Filter | Notes |
|-------|--------|-------|
| `dev_tasks` | `.eq('project_id', selectedProject.id)` | Mandatory -- every task belongs to a project |
| `sprints` | `.eq('project_id', selectedProject.id)` | Mandatory -- every sprint belongs to a project |
| `meeting_transcripts` | `.eq('project_id', selectedProject.id)` | Optional at insert, but filtered when project-scoped |
| `generated_documents` | `.eq('project_id', selectedProject.id)` | Mandatory -- documents belong to a project |
| `ai_interactions` | `.eq('project_id', selectedProject.id)` | Mandatory -- costs tracked per project |
| `features` | `.eq('project_id', selectedProject.id)` | Mandatory -- features belong to a project |
| `backlog_items` | `.eq('project_id', selectedProject.id)` | Mandatory -- backlog entries belong to a project |

### TanStack Query Integration

When using TanStack Query, queries should be gated on the presence of a selected project to prevent unnecessary requests with undefined filters:

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks, isLoading } = useQuery({
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
  enabled: !!selectedProject?.id,  // Query will not execute until a project is selected
});
```

### RLS Enforcement

Even if application-level filtering is bypassed, RLS policies on every table ensure that users cannot access data from projects they have not been granted access to:

```sql
-- Example: tasks isolation policy
CREATE POLICY tasks_project_isolation ON dev_tasks
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

This means that a query without a `project_id` filter will return zero rows rather than cross-project data, because the RLS policy additionally restricts results to projects in the user's access list.

---

## Relationships

### Relationship to team_members

Team members (`team_members`) are globally visible across the entire system. A team member record represents a person who can be assigned to tasks in any project. The link between a team member and a specific project is managed through the `project_team_members` join table:

```
project_knowledge_base (1)
  |
  +-- project_team_members (N)
        |
        +-- team_members (1)
              |
              +-- team_member_skills (1:N)
              +-- team_member_tools (1:N)
```

**project_team_members columns:**

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| project_id | uuid | FK to project_knowledge_base.id |
| member_id | uuid | FK to team_members.id |
| role | text | Member's role within the project |
| joined_at | timestamp | When the member joined the project |

**Querying team members for a project:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: projectMembers } = await supabase
  .from('project_team_members')
  .select(`
    role,
    joined_at,
    member:team_members (
      id,
      name,
      email,
      profile,
      headline,
      avatar_url
    )
  `)
  .eq('project_id', selectedProject?.id)
  .is('deleted_at', null);
```

### Relationship to sprints

Sprints (`sprints`) are development iterations that belong to a specific project:

```
project_knowledge_base (1)
  |
  +-- sprints (N)
        |
        +-- dev_tasks (N) -- tasks assigned to the sprint
        +-- generated_documents (N) -- documents generated during the sprint
        +-- meetings (N) -- meetings held during the sprint
```

**sprints columns relevant to project isolation:**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| project_id | uuid | FK to project_knowledge_base.id (mandatory) |
| name | varchar | Sprint name |
| status | sprint_status | planning, active, completed, cancelled |
| start_date | date | Sprint start date |
| end_date | date | Sprint end date |
| planned_points | int | Total planned story points |
| completed_points | int | Completed story points |
| velocity | numeric | Calculated velocity |

**Querying sprints for a project:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: sprints } = await supabase
  .from('sprints')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .order('start_date', { ascending: false });
```

**Sprint-to-task relationship:**

Tasks are assigned to sprints via the `sprint_id` foreign key in `dev_tasks`. To retrieve all tasks for the active sprint:

```typescript
const { selectedProject } = useProjectSelection();

const { data: sprintTasks } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProject?.id)
  .eq('sprint_id', activeSprintId)
  .order('priority', { ascending: false });
```

---

## Project Context Selection: useProjectSelection()

The `useProjectSelection()` hook is the application-layer mechanism for accessing the currently active project. It is the standard interface for all components that need project-scoped data.

### Hook Interface

**File:** `src/hooks/useProjectSelection.ts`

```typescript
export interface UseProjectSelectionReturn {
  selectedProject: Project | null;   // The full Project object -- NOT selectedProjectId
  isProjectMode: boolean;
  isLoading: boolean;
  projectHistory: Project[];
  selectProject: (project: Project) => void;
  clearProject: () => void;
  toggleProjectMode: () => void;
  enableProjectMode: () => void;
  disableProjectMode: () => void;
  isProjectSelected: boolean;
  canAccessProjectRoutes: boolean;
  navigateToProject: (projectId: string) => void;
  navigateToDashboard: () => void;
  switchProject: (project: Project) => void;
  getRecentProjects: (limit?: number) => Project[];
}
```

### Project Type

The `Project` type (defined in `src/types/project-selection.ts`) reflects the `project_knowledge_base` table structure:

```typescript
export interface Project {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status?: string;
  visibility?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  team_id?: number;
  overall_quality_score?: number;
  total_cost?: number;
  total_tokens?: number;
  total_interactions?: number;
  collaborators_count?: number;
  completed_documents?: string[];
  failed_documents?: string[];
  tags?: string[];
  is_public?: boolean;
  sprints_count?: number;
  tasks_count?: number;
  incomplete_tasks_count?: number;
  meetings_count?: number;
  icon?: string;
  color?: string;
  logo_url?: string;
}
```

### Correct Usage

The most important rule is to never destructure `selectedProjectId` directly from the hook. The hook exposes `selectedProject` (the full object), not a `selectedProjectId` property. Attempting to use a non-existent property produces `undefined`, which silently breaks every query and mutation.

**Correct pattern:**

```typescript
import { useProjectSelection } from '@/hooks/useProjectSelection';

function TasksPage() {
  const { selectedProject } = useProjectSelection();

  if (!selectedProject) {
    return <Alert>Please select a project to view tasks.</Alert>;
  }

  const { data: tasks } = useQuery({
    queryKey: ['tasks', selectedProject.id],
    queryFn: () => supabase
      .from('dev_tasks')
      .select('*')
      .eq('project_id', selectedProject.id)
      .order('created_at', { ascending: false }),
    enabled: !!selectedProject.id,
  });

  return <TaskList tasks={tasks} />;
}
```

**Incorrect pattern (never do this):**

```typescript
// WRONG -- selectedProjectId does not exist on the returned object
const { selectedProjectId } = useProjectSelection();  // always undefined

// WRONG -- same problem with any name that is not "selectedProject"
const { projectId } = useProjectSelection();         // always undefined
const { id } = useProjectSelection();                // always undefined
```

### Navigation Helpers

The hook provides navigation helpers that automatically manage project mode transitions:

```typescript
const {
  selectedProject,
  navigateToProject,
  navigateToDashboard,
  switchProject,
  enableProjectMode,
  disableProjectMode,
} = useProjectSelection();

// Switch to a different project
switchProject(anotherProject);

// Navigate to the current project's home page
navigateToProject(selectedProject.id);

// Return to the global dashboard
navigateToDashboard();

// Enable project-scoped navigation (redirects to /project-selector if no project is active)
enableProjectMode();
```

### Project Mode

The application operates in one of two modes:

- **Project Mode** (`isProjectMode = true`): All data is scoped to the selected project. Navigating to protected routes without a project selected redirects to `/project-selector`.
- **Non-Project Mode** (`isProjectMode = false`): The application behaves like a single-workspace app with no project filtering.

Project mode is the default. The context provider persists the selected project in `localStorage` under the key `dr-ai-selected-project`, along with project history and mode state.

### Access Validation

When `selectProject()` is called, the context validates that the current user has access to the target project before setting it:

```typescript
const setSelectedProject = async (project: Project | null) => {
  if (project) {
    const { data: { user } } = await supabase.auth.getUser();
    const userIsAdmin = isAdminUser(user.id);

    if (!userIsAdmin) {
      const hasAccess = await checkUserHasAccess(user.id, project.id);
      if (!hasAccess) {
        toast.error("You don't have access to this project");
        navigate('/project-selector');
        return;
      }
    }
    setSelectedProjectState(project);
  }
};
```

Non-admin users are checked against `user_project_access`. Admin users bypass this check.

---

## Related Topics

- [Project Context System](../06-project-context/context-system.md) -- Detailed documentation of the `useProjectSelection()` hook, context hierarchy, and isolation enforcement
- [Database Schema](../04-database-schema/schema.md) -- Complete table definitions, relationships, RLS policies, and index strategy
- [Sprints](../22-sprints/sprints.md) -- Sprint management within projects
- [Tasks](../21-tasks/tasks.md) -- Task management within projects
- [Team Members](../17-team-members/members.md) -- Team member management and project linking
- [Area Theming](../16-ui-theming/themes.md) -- Project-level visual theming with colors and icons
