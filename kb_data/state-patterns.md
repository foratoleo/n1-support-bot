---
name: state-management-patterns
description: TanStack Query v5, React Context, and local state patterns
area: 7
maintained_by: state-specialist
created: 2026-03-30
updated: 2026-03-30
---

# State Management Patterns

This document describes the state management architecture for the RAG Workforce application, covering TanStack Query v5 for server state, React Context for global application state, and `useState` for local UI state.

## Overview

The application follows a clear separation between three categories of state:

| Category | Tool | Scope | Persistence |
|----------|------|-------|-------------|
| Server State | TanStack Query v5 | Fetched from Supabase | Cached in query client |
| Global App State | React Context | Application-wide | localStorage for some contexts |
| UI State | useState | Component-local | Memory only |

## TanStack Query v5 Patterns

TanStack Query (formerly React Query) is the primary tool for managing all server state, including data fetching, caching, synchronization, and mutations.

### Basic Query Pattern

Hooks wrap `useQuery` with typed return interfaces for consistency. The project convention is to define a return type interface and return normalized data:

```typescript
// src/hooks/useMeetings.ts
export interface UseMeetingsReturn {
  meetings: MeetingWithDetails[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isRefetching: boolean;
  isSuccess: boolean;
}

export function useMeetings(
  projectId?: string,
  filters?: MeetingFilters,
  enabled: boolean = true
): UseMeetingsReturn {
  const query = useQuery({
    queryKey: ['meetings', projectId, filters],
    queryFn: async () => {
      const { meetingService } = await import('@/lib/services/meeting-service');
      const result = await meetingService.fetchMeetingsListView(projectId, filters, { page: 1, limit: 500 });
      return result.data;
    },
    enabled: enabled && !!projectId,
    staleTime: 30000,       // 30 seconds
    gcTime: 300000,         // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    meetings: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    isSuccess: query.isSuccess,
  };
}
```

### Query Key Patterns

Query keys are always array-based, with parameters listed from most to least specific. The project does not use a centralized queryKeyFactory; keys are defined inline in each hook.

**Project-scoped queries** always include `projectId` as the second element:

```typescript
// Entity list queries with project context
queryKey: ['meetings', projectId, filters]
queryKey: ['backlog', projectId, filters, viewOptions, showAllStatuses]
queryKey: ['tasks', projectId, filters]

// Statistics queries (separate from list to allow independent invalidation)
queryKey: ['backlog-statistics', projectId]
queryKey: ['backlog-statistics-extended', projectId]
queryKey: ['backlog-matrix-items', projectId]

// Document-specific queries
queryKey: ['project-documents', selectedProject?.id, filters, includeContent]
queryKey: ['document-content', documentId, documentSource]
queryKey: ['document-stats', selectedProject?.id]
queryKey: ['task-documents', selectedProject?.id, filters]

// Count queries (for pagination)
queryKey: ['project-wide-documents-count', selectedProject?.id, filters]
queryKey: ['sprint-documents-count', selectedProject?.id, filters]
```

**Key principles:**
- Always include `projectId` as the second element when data is project-scoped
- Include all filter parameters in the key for proper cache segmentation
- Group related queries with a common prefix (e.g., `backlog`, `document`)
- Use separate keys for statistics and counts to allow independent invalidation
- Never hardcode project IDs in query keys

### Mutation Patterns

Mutations use `useMutation` with `onSuccess` and `onError` callbacks for cache invalidation and user feedback via toast:

```typescript
// src/hooks/useBacklog.ts
const createItemMutation = useMutation({
  mutationFn: async (data: BacklogItemFormData) => {
    // Get max position for ordering
    const { data: maxPosData } = await supabase
      .from('backlog_items')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPosition = maxPosData ? maxPosData.position + 1 : 0;

    const { data: newItem, error } = await supabase
      .from('backlog_items')
      .insert({ ...data, project_id: projectId, position: newPosition })
      .select()
      .single();

    if (error) throw error;
    return newItem;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['backlog', projectId] });
    queryClient.invalidateQueries({ queryKey: ['backlog-statistics', projectId] });
    queryClient.invalidateQueries({ queryKey: ['backlog-statistics-extended', projectId] });
    queryClient.invalidateQueries({ queryKey: ['backlog-matrix-items', projectId] });
    toast.success('Backlog item created successfully');
  },
  onError: (error) => {
    console.error('Failed to create backlog item:', error);
    toast.error('Failed to create backlog item');
  }
});
```

### Optimistic Updates with Rollback

For operations where immediate UI feedback is important (reordering, drag-and-drop), use optimistic updates with rollback on failure:

```typescript
const reorderItemsMutation = useMutation({
  mutationFn: async (updates: BacklogPositionUpdate[]) => {
    const results = await Promise.all(
      updates.map(update =>
        supabase
          .from('backlog_items')
          .update({ position: update.position, status: update.status, updated_at: new Date().toISOString() })
          .eq('id', update.id)
      )
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw new Error('Failed to reorder some items');
  },
  onMutate: async (updates) => {
    // Cancel outgoing queries to prevent race conditions
    await queryClient.cancelQueries({ queryKey: ['backlog', projectId] });

    // Snapshot current state for rollback
    const previousItems = queryClient.getQueryData(['backlog', projectId, filters, viewOptions, showAllStatuses]);

    // Optimistic update - apply changes immediately
    queryClient.setQueryData(['backlog', projectId, filters, viewOptions, showAllStatuses], (old: BacklogItem[] = []) => {
      const newItems = [...old];
      updates.forEach(update => {
        const index = newItems.findIndex(item => item.id === update.id);
        if (index !== -1) {
          newItems[index] = {
            ...newItems[index],
            position: update.position,
            ...(update.status && { status: update.status })
          };
        }
      });
      return newItems.sort((a, b) => a.position - b.position);
    });

    return { previousItems };
  },
  onError: (error, variables, context) => {
    // Rollback on error
    if (context?.previousItems) {
      queryClient.setQueryData(['backlog', projectId, filters, viewOptions, showAllStatuses], context.previousItems);
    }
    toast.error('Failed to reorder items');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['backlog', projectId] });
  }
});
```

### Cache Invalidation Strategy

Invalidate all related queries after mutations to keep data consistent. Group invalidations by entity:

```typescript
// After document deletion - invalidate all related document queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['project-documents'] });
  queryClient.invalidateQueries({ queryKey: ['project-wide-documents'] });
  queryClient.invalidateQueries({ queryKey: ['sprint-documents'] });
  queryClient.invalidateQueries({ queryKey: ['task-documents'] });
  queryClient.invalidateQueries({ queryKey: ['document-stats'] });
  queryClient.invalidateQueries({ queryKey: ['project-wide-documents-count'] });
  queryClient.invalidateQueries({ queryKey: ['sprint-documents-count'] });
  queryClient.invalidateQueries({ queryKey: ['task-documents-count'] });
}
```

### Stale Time Configuration

Configure `staleTime` based on data volatility:

| Data Type | staleTime | gcTime | Rationale |
|-----------|-----------|--------|-----------|
| User activity (meetings, tasks) | 30s | 5min | Changes frequently, refetch on focus |
| Documents (list) | 2min | 10min | Changes infrequently |
| Document content | 5min | 30min | Large payloads, rarely changes |
| Extended statistics (database views) | 5min | 10min | Computed views, expensive to refresh |
| Matrix items | 2min | 10min | Derived data |

### The `enabled` Flag

Use the `enabled` parameter to conditionally run queries. The most common pattern is gating on project selection:

```typescript
// Only run when project is selected
enabled: !!selectedProject?.id

// Combine with other conditions
enabled: enabled && !!projectId

// Explicit enable/disable
enabled: !!epicId && !!projectId
```

When `enabled` is `false`, the query does not fire and returns `{ data: undefined, isLoading: false, isFetching: false }`.

## React Context Patterns

React Context is used for truly global state that does not belong in TanStack Query: authentication, active project, active team, and current area detection.

### When to Use Each Context

| Context | Use Case | Persisted to localStorage |
|---------|----------|--------------------------|
| AuthContext | User session, sign-in/sign-out | No (Supabase handles session) |
| ProjectSelectionContext | Active project, project mode, navigation guards | Yes |
| TeamContext | Active team, team list, team selector UI | Yes |
| AreaContext | Current area detection, area-aware navigation | Yes |

### AuthContext

Manages authentication state and Supabase session. Does not manually persist; relies on Supabase's built-in session management.

**File:** `src/contexts/AuthContext.tsx`

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check active session on mount
    supabaseAuth.getSession().then((session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabaseAuth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_OUT') {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (email: string, password: string) => { /* ... */ };
  const signOut = async () => { /* ... */ };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signOut,
      forgotPassword,
      resetPassword,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Usage:**

```typescript
const { user, isAuthenticated, signOut } = useAuth();
```

### ProjectSelectionContext

Manages the currently selected project, project mode, and navigation guards. Persists selection and mode to localStorage for session continuity.

**File:** `src/contexts/ProjectSelectionContext.tsx`

```typescript
interface ProjectSelectionContextType {
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  clearSelectedProject: () => void;
  isProjectMode: boolean;
  setIsProjectMode: (mode: boolean) => void;
  isLoading: boolean;
  projectHistory: Project[];
  addToHistory: (project: Project) => void;
  clearHistory: () => void;
}
```

**Key behaviors:**
- Validates user access via `checkUserHasAccess` before setting a project
- Admin users bypass access checks
- Redirects to `/project-selector` when no project is selected on protected routes
- Maintains a history of up to 5 recently accessed projects
- Listens to route changes to enforce project selection on protected routes

**Protected route list (enforce project selection):**

```typescript
const protectedRoutes = ['/', '/dashboard', '/tasks', '/sprints', '/code', '/qa', '/metrics', '/meetings', '/documents'];
```

**Exempt routes (no project required):**

```typescript
const exemptRoutes = ['/products/create', '/projects/new', '/project-selector', '/login', '/profile'];
```

**LocalStorage keys:**

```typescript
const PROJECT_SELECTION_KEY = 'dr-ai-selected-project';
const PROJECT_MODE_KEY = 'dr-ai-project-mode';
const PROJECT_HISTORY_KEY = 'dr-ai-project-history';
const MAX_HISTORY_ITEMS = 5;
```

**Composed hook with navigation helpers:**

```typescript
// src/hooks/useProjectSelection.ts
const { selectedProject, isProjectMode, isLoading, projectHistory, selectProject, clearProject, toggleProjectMode, enableProjectMode, disableProjectMode, isProjectSelected, canAccessProjectRoutes, navigateToProject, navigateToDashboard, switchProject, getRecentProjects } = useProjectSelection();
```

### TeamContext

Manages team selection across the application. Composes with the `useTeams` hook for data fetching and adds localStorage persistence.

**File:** `src/contexts/TeamContext.tsx`

```typescript
interface TeamContextValue {
  currentTeam: Team | null;
  teams: Team[];
  isLoading: boolean;
  error: string | null;
  selectTeam: (teamId: string | null) => Promise<void>;
  refreshTeams: () => Promise<void>;
  clearTeamSelection: () => void;
  isTeamSelectorOpen: boolean;
  setTeamSelectorOpen: (open: boolean) => void;
}
```

**Loading priority:**
1. `initialTeamId` prop (from deep linking)
2. localStorage persisted team ID
3. Auto-select first available team

**Available hooks:**

```typescript
useTeamContext()    // Full context value
useCurrentTeam()    // Just currentTeam
useHasTeam()        // Boolean: !!currentTeam
```

### AreaContext

Provides area detection based on the current route and allows manual area switching with URL synchronization.

**File:** `src/contexts/AreaContext.tsx`

```typescript
export interface AreaContextType {
  currentArea: Area;
  areaConfig: AreaConfig;
  setAreaContext: (area: Area) => void;
  navigateWithArea: (path: string, options?: { replace?: boolean }) => void;
  // ...
}
```

**Key behaviors:**
- Detects area from current pathname using `useAreaDetection` hook
- Persists manual selections to localStorage
- Provides `navigateWithArea` to preserve area context during navigation
- Syncs area context with URL for bookmarkable links

## useState for UI-Only State

Reserve `useState` for component-local state that does not need to be shared or persisted:

- Form input values (before submission)
- Modal/dialog open/close state
- Toggle states (expanded/collapsed sections)
- Loading states for local operations
- Filter and sort preferences (when not using TanStack Query filters)

```typescript
// UI state for team selector dropdown
const [isTeamSelectorOpen, setTeamSelectorOpen] = useState(false);

// Local filter state with localStorage persistence for user preference
const [filters, setFiltersState] = useState<BacklogFilters>(() => ({
  ...DEFAULT_BACKLOG_FILTERS,
  ...loadFromStorage(STORAGE_KEY_FILTERS, {})
}));

const setFilters = useCallback((newFilters: BacklogFilters) => {
  setFiltersState(newFilters);
  saveToStorage(STORAGE_KEY_FILTERS, newFilters);
}, []);
```

**When NOT to use useState for:**
- Data fetched from the server (use TanStack Query)
- Authentication state (use AuthContext)
- Selected project (use ProjectSelectionContext)
- Selected team (use TeamContext)
- Global UI toggles shared across multiple components (use a dedicated Context)

## Error Handling Patterns

### Toast Notifications

The project uses `sonner` for toast notifications. Import the `toast` function directly or use the `useToast` hook from `src/hooks/use-toast.ts`:

```typescript
import { toast } from 'sonner';
import { useToast } from '@/hooks/use-toast';

// Direct usage
toast.success('Backlog item created successfully');
toast.error('Failed to create backlog item');
toast.error("You don't have access to this project");

// With useToast hook (for programmatic dismissal)
const { toast } = useToast();
toast({ title: 'Project Selected', description: `You're now working on ${project.name}` });
```

### Error Handling in Queries

TanStack Query provides `error` and `isError` directly from the query result:

```typescript
const { data, isLoading, error } = useQuery({ ... });

if (isError) {
  return <ErrorMessage error={error} />;
}

if (isLoading) {
  return <LoadingSkeleton />;
}
```

### Error Handling in Mutations

Handle errors in the `onError` callback, always providing user feedback:

```typescript
const mutation = useMutation({
  mutationFn: asyncFunction,
  onSuccess: () => {
    toast.success('Operation completed');
  },
  onError: (error) => {
    console.error('Operation failed:', error);
    toast.error('Operation failed: ' + error.message);
  }
});
```

### Error Boundaries

Wrap route-level components with `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) to catch and display rendering errors gracefully.

## Separation of Concerns Decision Tree

When adding state to a component, follow this decision tree:

```
Is the data fetched from the server?
├── YES: Use TanStack Query (useQuery / useMutation)
│         └── Include projectId in queryKey for project-scoped data
└── NO: Is the state needed by multiple components across the app?
          ├── YES: Use React Context
          │         ├── Authentication or session?       -> AuthContext
          │         ├── Active project selection?      -> ProjectSelectionContext
          │         ├── Active team selection?         -> TeamContext
          │         ├── Current area or route?         -> AreaContext
          │         └── Other shared state?            -> Create a new context
          └── NO: Is the state needed only by this component or its children?
                    ├── YES: Pass via props or a focused context
                    └── NO: Use useState
```

## Common Patterns Reference

### Combining Context with TanStack Query

Contexts provide the parameters that TanStack Query uses for scoped queries:

```typescript
// ProjectSelectionContext provides projectId
const { selectedProject } = useProjectSelection();
const projectId = selectedProject?.id;

// TanStack Query uses projectId for scoped queries
const { documents } = useProjectDocuments(filters);

// AuthContext provides user ID for mutations
const { user } = useAuth();
```

### Controlled Filter State with Persistence

Combine `useState` for local filter state with localStorage for persistence:

```typescript
const STORAGE_KEY_FILTERS = 'backlog-filters';

const [filters, setFiltersState] = useState<BacklogFilters>(() => ({
  ...DEFAULT_BACKLOG_FILTERS,
  ...loadFromStorage(STORAGE_KEY_FILTERS, {})
}));

const setFilters = useCallback((newFilters: BacklogFilters) => {
  setFiltersState(newFilters);
  saveToStorage(STORAGE_KEY_FILTERS, newFilters);
}, []);

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}
```

### Automatic Refetch on Context Change

When a context value changes (e.g., project change), queries automatically refetch because the query key changes:

```typescript
// When selectedProject changes, the query key changes
queryKey: ['backlog', projectId, filters, viewOptions]
// TanStack Query treats this as a new query and fetches fresh data
```

### Dependent Queries

Ensure a query only runs when its prerequisites are met:

```typescript
// useMeetings requires projectId
export function useMeetings(
  projectId?: string,
  filters?: MeetingFilters,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['meetings', projectId, filters],
    queryFn: fetchMeetings,
    enabled: enabled && !!projectId,  // Won't run until projectId is available
  });
}
```

### Custom Hooks as the Integration Layer

Custom hooks wrap TanStack Query and contexts to provide a clean API to components:

```typescript
// src/hooks/useDocuments.ts
export function useProjectDocuments(filters?: DocumentFilters, includeContent = false) {
  const { selectedProject } = useProjectSelection();

  return useQuery({
    queryKey: ['project-documents', selectedProject?.id, filters, includeContent],
    queryFn: async (): Promise<UnifiedDocument[]> => {
      if (!selectedProject?.id) throw new Error('No project selected');
      // ... fetch logic
    },
    enabled: !!selectedProject?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
```

## Related Documentation

- [Project Context System](../06-project-context/context-system.md) - ProjectSelectionContext and project isolation
- [Authentication Flows](../05-authentication/auth-flows.md) - AuthContext and session management
- [Tasks](../21-tasks/tasks.md) - useTasks hook and task-specific patterns
- [Database Schema](../04-database-schema/schema.md) - Tables and views that queries target
