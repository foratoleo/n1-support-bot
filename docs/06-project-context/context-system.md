---
name: project-context-system
description: Project isolation, selectedProject pattern, context system - CRITICAL correct usage
area: 06
maintained_by: context-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Project Context System

## Overview

The Project Context System is the foundation of data isolation in this application. Every piece of data -- tasks, sprints, documents, meetings, transcripts, etc. -- is scoped to a specific project. All queries to the database must include a `project_id` filter, and the `useProjectSelection()` hook is the single source of truth for determining which project is currently active.

The system consists of two React contexts that flow top-down: `AuthContext` provides the authenticated user, and `ProjectSelectionContext` provides the currently selected project and project mode. No component should ever hardcode a project ID or assume a project is selected without checking.

---

## The Hook: `useProjectSelection()`

**File:** `src/hooks/useProjectSelection.ts` (exported also from `src/contexts/ProjectSelectionContext.tsx`)

**CRITICAL:** The hook returns an object with a `selectedProject` property of type `Project | null`. It does NOT return a property named `selectedProjectId`.

```typescript
// Interface as defined in src/hooks/useProjectSelection.ts
export interface UseProjectSelectionReturn {
  selectedProject: Project | null;   // <-- The full Project object, NOT selectedProjectId
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

The `Project` type (defined in `src/types/project-selection.ts`) includes:

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
  // Branding fields
  icon?: string;
  color?: string;
  logo_url?: string;
}
```

---

## Context Hierarchy

The context providers are stacked in the application root. Understanding the order matters because `ProjectSelectionContext` depends on having an authenticated user in order to validate project access.

```
App
  AuthProvider              --> provides user: User | null
    ProjectSelectionProvider --> provides selectedProject: Project | null, isProjectMode, etc.
      [application routes and components]
```

### AuthContext

**File:** `src/contexts/AuthContext.tsx`

Provides authentication state. All other contexts depend on the user being authenticated.

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
}
```

Usage:

```typescript
import { useAuth } from '@/contexts/AuthContext';

const { user, isAuthenticated, signOut } = useAuth();
```

### ProjectSelectionContext

**File:** `src/contexts/ProjectSelectionContext.tsx`

Provides project selection state and project-mode behavior. The context:

1. Persists the selected project in `localStorage` under the key `dr-ai-selected-project`
2. Persists project mode state in `localStorage` under `dr-ai-project-mode`
3. Maintains a project history (up to 5 recent projects) in `localStorage` under `dr-ai-project-history`
4. Validates user access to a project before setting it (non-admin users are checked against `user_project_access`)
5. Redirects to `/project-selector` when navigating to protected routes without a project selected in project mode

**Important:** The context exports both `useProjectSelection` (from the hook file) and `useProjectSelectionContext` (from the context file). Both return the same interface. The hook file version adds navigation helpers (`navigateToProject`, `navigateToDashboard`, `switchProject`). Always prefer importing from `src/hooks/useProjectSelection.ts`.

---

## WRONG vs RIGHT: The `selectedProjectId` Mistake

This is the most common and most critical error in the codebase. The destructuring pattern `const { selectedProjectId } = useProjectSelection()` does NOT work. There is no `selectedProjectId` property on the returned object. This produces a variable that is always `undefined`, silently breaking every query and mutation in the component.

### WRONG Pattern

```typescript
// WRONG - selectedProjectId does NOT exist on the returned object
import { useProjectSelection } from '@/hooks/useProjectSelection';

function MyComponent() {
  const { selectedProjectId } = useProjectSelection(); // ALWAYS undefined

  // Every query using selectedProjectId will fail silently
  const { data } = useQuery({
    queryKey: ['tasks', selectedProjectId],
    queryFn: () => supabase.from('dev_tasks').select('*').eq('project_id', selectedProjectId),
    // selectedProjectId is undefined, so .eq('project_id', undefined) matches nothing
  });

  return <div>{selectedProjectId}</div>; // renders: undefined
}
```

The same applies to any variation of this mistake:

```typescript
// WRONG - all of these create undefined variables
const { selectedProjectId } = useProjectSelection();
const { projectId } = useProjectSelection();
const { id } = useProjectSelection();
```

When `selectedProjectId` is `undefined`, every Supabase query that uses it in a filter becomes:

```typescript
// What actually happens:
supabase.from('tasks').select('*').eq('project_id', undefined)
// Translates to: WHERE project_id = NULL  (not WHERE project_id = 'some-uuid')
// Returns zero rows instead of the project's data
```

### RIGHT Pattern

```typescript
// RIGHT - destructure selectedProject, then access .id
import { useProjectSelection } from '@/hooks/useProjectSelection';

function MyComponent() {
  const { selectedProject } = useProjectSelection();

  // Always check if a project is selected before using the id
  const { data } = useQuery({
    queryKey: ['tasks', selectedProject?.id],
    queryFn: () => supabase
      .from('dev_tasks')
      .select('*')
      .eq('project_id', selectedProject?.id),
    // selectedProject?.id is safe - returns undefined if no project selected
    // Supabase handles undefined by omitting the filter, but you should guard below
    enabled: !!selectedProject, // <-- ALWAYS gate queries on project existence
  });

  return <div>{selectedProject?.name ?? 'No project selected'}</div>;
}
```

---

## Correct Usage Patterns

### Pattern 1: Accessing the project ID for queries

```typescript
import { useProjectSelection } from '@/hooks/useProjectSelection';

function TasksPage() {
  const { selectedProject } = useProjectSelection();

  // Guard: render a message if no project is selected
  if (!selectedProject) {
    return <Alert>Please select a project to view tasks.</Alert>;
  }

  // Now use selectedProject.id safely
  const { data: tasks } = useQuery({
    queryKey: ['tasks', selectedProject.id],
    queryFn: () => supabase
      .from('dev_tasks')
      .select('*')
      .eq('project_id', selectedProject.id)  // <-- correct
      .order('created_at', { ascending: false }),
    enabled: !!selectedProject.id,
  });

  return <TaskList tasks={tasks} />;
}
```

### Pattern 2: Creating a local `selectedProjectId` variable (derived, not destructured)

```typescript
import { useProjectSelection } from '@/hooks/useProjectSelection';

function DocumentPage() {
  const { selectedProject } = useProjectSelection();

  // Derive selectedProjectId from the full object - this is safe
  const selectedProjectId = selectedProject?.id;

  const { data: documents } = useDocuments(selectedProjectId);

  return <DocumentList documents={documents} />;
}
```

This works because you first destructured `selectedProject` correctly, then derived `selectedProjectId` from it. The mistake is in the initial destructuring, not in having a `selectedProjectId` variable.

### Pattern 3: Passing the project ID to child components

```typescript
import { useProjectSelection } from '@/hooks/useProjectSelection';
import TranscriptionsList from '@/components/transcriptions/TranscriptionsList';

function TranscriptionsPage() {
  const { selectedProject } = useProjectSelection();

  if (!selectedProject) {
    return <NoProjectAlert />;
  }

  // Pass the id explicitly to components that expect it as a prop
  return <TranscriptionsList selectedProjectId={selectedProject.id} />;
}
```

Note: Some components in the codebase expect a `selectedProjectId` prop directly. This is fine -- you are responsible for correctly deriving that value before passing it.

### Pattern 4: Combining with TanStack Query

```typescript
import { useProjectSelection } from '@/hooks/useProjectSelection';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function SprintAnalytics() {
  const { selectedProject } = useProjectSelection();

  const { data: sprints, isLoading } = useQuery({
    queryKey: ['sprints', selectedProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sprints')
        .select('*')
        .eq('project_id', selectedProject?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedProject?.id,  // Query will not run until a project is selected
  });

  return <SprintList sprints={sprints} isLoading={isLoading} />;
}
```

### Pattern 5: Navigation helpers

```typescript
import { useProjectSelection } from '@/hooks/useProjectSelection';

function ProjectHeader() {
  const { selectedProject, navigateToDashboard, navigateToProject } = useProjectSelection();

  return (
    <div>
      <h1>{selectedProject?.name}</h1>
      <button onClick={() => navigateToDashboard()}>Go to Dashboard</button>
      <button onClick={() => navigateToProject(selectedProject.id)}>Project Home</button>
    </div>
  );
}
```

---

## Project Isolation Architecture

All database tables are scoped by `project_id`. The application enforces this isolation at two levels:

### 1. Application-level enforcement

The `ProjectSelectionContext` validates that the current user has access to the selected project before setting it. This happens in `setSelectedProject`:

```typescript
// src/contexts/ProjectSelectionContext.tsx, setSelectedProject function
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
    // Access granted, set project
    setSelectedProjectState(project);
  }
};
```

### 2. Query-level enforcement

Every Supabase query must include a `project_id` filter:

```typescript
// Every query follows this pattern
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProject.id);  // <-- REQUIRED on every query
```

Core tables that require project isolation:

| Table | Query filter |
|---|---|
| `dev_tasks` | `.eq('project_id', selectedProject.id)` |
| `sprints` | `.eq('project_id', selectedProject.id)` |
| `meeting_transcripts` | `.eq('project_id', selectedProject.id)` |
| `generated_documents` | `.eq('project_id', selectedProject.id)` |
| `ai_interactions` | `.eq('project_id', selectedProject.id)` |
| `features` | `.eq('project_id', selectedProject.id)` |
| `backlog_items` | `.eq('project_id', selectedProject.id)` |

### Route protection

In project mode, the `ProjectSelectionProvider` useEffect intercepts navigation to protected routes and redirects to `/project-selector` if no project is selected:

```typescript
// src/contexts/ProjectSelectionContext.tsx, checkRouteAccess effect
const protectedRoutes = ['/', '/dashboard', '/tasks', '/sprints', '/code', '/qa', '/metrics', '/meetings', '/documents'];

if (isProtectedRoute && !selectedProject) {
  navigate('/project-selector');
  return;
}
```

---

## Common Mistakes Reference

| Mistake | Why it fails | Correct approach |
|---|---|---|
| `const { selectedProjectId } = useProjectSelection()` | Property does not exist; value is always `undefined` | `const { selectedProject } = useProjectSelection()` then use `selectedProject?.id` |
| `const { id } = useProjectSelection()` | No `id` property on the returned object | `const { selectedProject } = useProjectSelection()` then `selectedProject?.id` |
| `.eq('project_id', selectedProject?.id)` without a guard | Query runs with `undefined` filter, returns zero rows | Always use `enabled: !!selectedProject?.id` with TanStack Query, or check `if (!selectedProject)` first |
| `const selectedProjectId = selectedProject?.id` without checking | The variable will be `undefined`, causing the same query problem | Always guard with a `if (!selectedProject)` check before using the derived ID |
| Hardcoding a project ID | Breaks multi-project isolation; accesses wrong project data | Always derive from `selectedProject.id` |
| Using `useProjectSelectionContext` instead of the hook | Both work, but the hook adds navigation helpers | Prefer `import { useProjectSelection } from '@/hooks/useProjectSelection'` |

---

## Project Mode vs Non-Project Mode

The application supports two navigation modes:

- **Project Mode** (`isProjectMode = true`): All data is scoped to the selected project. Protected routes redirect to `/project-selector` if no project is selected. This is the default behavior.
- **Non-Project Mode** (`isProjectMode = false`): The application behaves like a traditional single-workspace application. All queries omit the `project_id` filter.

Use the provided helpers to manage mode switching:

```typescript
const { isProjectMode, enableProjectMode, disableProjectMode, toggleProjectMode } = useProjectSelection();

// Enable project mode (will redirect to /project-selector if no project is selected)
enableProjectMode();

// Disable project mode (will navigate to '/')
disableProjectMode();

// Toggle between modes
toggleProjectMode();
```

---

## Summary

1. Always use `const { selectedProject } = useProjectSelection()` -- never destructure `selectedProjectId` directly.
2. Access the project ID as `selectedProject?.id`.
3. Guard all queries: either check `if (!selectedProject)` before using the ID, or use `enabled: !!selectedProject?.id` in TanStack Query.
4. Every database query must include a `.eq('project_id', selectedProject.id)` filter.
5. The context hierarchy flows from `AuthContext` (user) to `ProjectSelectionContext` (project). Both must be available for the system to function correctly.
