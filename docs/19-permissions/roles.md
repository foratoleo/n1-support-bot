---
name: permissions-roles
description: RBAC, Supabase RLS policies, project-level isolation, permission checks
area: 19
maintained_by: permissions-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Permissions and Roles

## Overview

Workforce implements a two-layered security model that separates authentication from authorization. Authentication verifies user identity through Supabase Auth, while authorization enforces what each user can do through Role-Based Access Control (RBAC) combined with Supabase Row Level Security (RLS) policies. This document describes both layers, the role model, how project isolation works, and how permissions are checked throughout the application.

## Authentication vs Authorization

These two concepts serve distinct purposes in the security model.

| Concept | Layer | Purpose | Implementation |
|---------|-------|---------|----------------|
| Authentication | Identity | Verifies who the user is | Supabase Auth (email/password, session tokens) |
| Authorization | Access | Determines what the user can do | RBAC + RLS policies |
| Auth Context | Frontend | Exposes `user`, `isAuthenticated`, `signIn`, `signOut` | `AuthContext` in `src/contexts/AuthContext.tsx` |
| Permission Service | Frontend | Validates role-based actions | `PermissionService` in `src/lib/services/permission-service.ts` |

Authentication happens once at login. Every subsequent request to the database is automatically scoped to the authenticated user via `auth.uid()`. Authorization is evaluated on every operation, both at the frontend level (for UI gating) and at the database level (for query enforcement).

The `AuthContext` manages the user session:

```typescript
// src/contexts/AuthContext.tsx
const { user, isAuthenticated } = useAuth();
```

The `PermissionService` evaluates role-based actions:

```typescript
// src/lib/services/permission-service.ts
const hasAccess = await hasPermission(
  userId,
  'project',
  projectId,
  'edit'
);
```

## Role Hierarchy

Workforce defines four user roles with a strict hierarchy. Higher roles inherit all permissions of lower roles.

### Role Definitions

| Role | Hierarchy Level | Description |
|------|-----------------|-------------|
| `owner` | 4 (highest) | Full control over team and all projects. Can delete team. |
| `admin` | 3 | Full control over team and projects. Cannot delete team. |
| `member` | 2 | Standard access. Can view and edit team and project resources. |
| `viewer` | 1 (lowest) | Read-only access to team and projects. |

### Permission Matrix

Each role grants different capabilities per resource type (team, project, document).

**Team Permissions:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| view | Yes | Yes | Yes | Yes |
| edit | Yes | Yes | No | No |
| delete | Yes | No | No | No |
| manage | Yes | Yes | No | No |
| invite | Yes | Yes | No | No |

**Project Permissions:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| view | Yes | Yes | Yes | Yes |
| edit | Yes | Yes | Yes | No |
| delete | Yes | Yes | No | No |
| manage | Yes | Yes | No | No |
| invite | Yes | Yes | No | No |

**Document Permissions:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| view | Yes | Yes | Yes | Yes |
| edit | Yes | Yes | Yes | No |
| delete | Yes | Yes | No | No |
| manage | Yes | Yes | No | No |

The role hierarchy constant used in code:

```typescript
// src/lib/services/permission-service.ts
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};
```

### Subscription Tier Limits

Roles are further constrained by subscription tier limits:

| Tier | Max Teams | Max Projects | Max Members | Features |
|------|-----------|--------------|------------|----------|
| free | 1 | 3 | 5 | basic_permissions, view_documents |
| starter | 3 | 10 | 15 | basic_permissions, edit_documents, api_access |
| professional | 10 | 50 | 50 | advanced_permissions, edit_documents, api_access, audit_logs |
| enterprise | Unlimited | Unlimited | Unlimited | advanced_permissions, edit_documents, api_access, audit_logs, sso, custom_roles |

## Supabase RLS Policies

RLS provides database-level enforcement. When enabled on a table, every query and mutation is filtered by the applicable policies before results are returned.

### RLS Migration

The migration `20260323_enable_rls_all_tables.sql` enables RLS on all tables in the public schema and creates a fallback policy for authenticated users:

```sql
-- supabase/migrations/20260323_enable_rls_all_tables.sql
DO $$
DECLARE
    tbl RECORD;
    policy_exists BOOLEAN;
    policy_name TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        -- Enable RLS if not already active
        IF NOT tbl.rowsecurity THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
        END IF;

        -- Create fallback policy for authenticated users if none exists
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = tbl.tablename
        ) INTO policy_exists;

        IF NOT policy_exists THEN
            policy_name := 'authenticated_access_' || tbl.tablename;
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
                policy_name,
                tbl.tablename
            );
        END IF;
    END LOOP;
END;
$$;
```

### Project-Level Isolation Policy Pattern

All RLS policies follow a consistent pattern that enforces project isolation. Every policy checks that the requesting user belongs to the team or project associated with the data being accessed.

```sql
-- Users can only read tasks in projects they belong to
CREATE POLICY "Members can read tasks"
ON dev_tasks FOR SELECT
USING (
  project_id IN (
    SELECT project_id
    FROM team_members
    WHERE user_id = auth.uid()
  )
);

-- Users can only insert tasks into projects they have edit access to
CREATE POLICY "Members can insert tasks"
ON dev_tasks FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id
    FROM team_members
    WHERE user_id = auth.uid()
  )
);

-- Users can only read documents in their projects
CREATE POLICY "Users can read project documents"
ON generated_documents FOR SELECT
USING (
  project_id IN (
    SELECT project_id
    FROM team_members
    WHERE user_id = auth.uid()
  )
);
```

The `USING` clause filters which rows are visible on SELECT. The `WITH CHECK` clause validates that inserted or updated rows satisfy the same constraint.

### Key RLS Principles

1. Every table with user data must have RLS enabled.
2. Every RLS policy must reference `auth.uid()` to identify the requesting user.
3. Policies must filter by `project_id` or `team_id` to enforce isolation.
4. Service role keys bypass RLS entirely. Never expose service role keys to the client.

## Project-Level Isolation

All data in Workforce is scoped to a project. The `project_id` column appears on every user-facing table and every query must filter by it.

### Project Selection Pattern

The `ProjectSelectionContext` manages the active project across the application:

```typescript
// src/contexts/ProjectSelectionContext.tsx
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;

// Every query MUST include project_id
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProjectId);
```

### Access Validation Flow

When a user selects a project, the context validates access:

```typescript
// src/contexts/ProjectSelectionContext.tsx
const setSelectedProject = async (project: Project | null) => {
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
};
```

### Required Pattern for All Queries

ALL Supabase queries in the application must follow this pattern:

```typescript
// Correct — includes project_id filter
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .eq('project_id', selectedProjectId)
  .order('created_at', { ascending: false });

// Incorrect — missing project_id filter
const { data } = await supabase
  .from('dev_tasks')
  .select('*')
  .order('created_at', { ascending: false });
```

The project context is available via the `useProjectSelection()` hook. Never extract a raw `selectedProjectId` variable; always access it through `selectedProject?.id` from the hook.

## Permission Checks in Components

The frontend enforces permissions at multiple levels: context providers, hooks, and service methods.

### Area Access Control

Platform-level area access (planning, development, quality, governance) is managed by `AreaAccessContext`:

```typescript
// src/contexts/AreaAccessContext.tsx
const { allowedAreas, hasAreaAccess, isLoadingAreaAccess } = useAreaAccessContext();

if (isLoadingAreaAccess) return <Spinner />;
if (!hasAreaAccess('planning')) return <Redirect to="/" />;
```

Internally, this uses `useMyAreaAccess()` which fetches areas from the `user_area_access` table. Admin users automatically receive all areas without a database query.

### Permission Service API

The `PermissionService` provides a comprehensive API for checking permissions:

```typescript
// Check team permission
const permission = await checkTeamPermission(userId, teamId, 'edit');
if (!permission.granted) {
  console.error(permission.reason);
}

// Check project permission
const projectPerm = await checkProjectPermission(userId, projectId, 'delete');

// Convenience method — returns boolean
const canDelete = await hasPermission(userId, 'project', projectId, 'delete');

// Action-based check — maps action names to permissions
const canInvite = await canPerformAction(userId, 'invite_member', { teamId });

// Get all permissions for a user
const allPermissions = await getUserPermissions(userId);
```

### Action Mapping

The `canPerformAction` method maps high-level action names to resource/permission pairs:

```typescript
const actionMapping: Record<string, { resource: 'team' | 'project' | 'document'; permission: string }> = {
  'create_project': { resource: 'team', permission: 'manage' },
  'delete_project': { resource: 'project', permission: 'delete' },
  'invite_member': { resource: 'team', permission: 'invite' },
  'remove_member': { resource: 'team', permission: 'manage' },
  'edit_document': { resource: 'document', permission: 'edit' },
  'delete_document': { resource: 'document', permission: 'delete' },
  'manage_team': { resource: 'team', permission: 'manage' },
  'view_team': { resource: 'team', permission: 'view' },
  'view_project': { resource: 'project', permission: 'view' },
  'edit_project': { resource: 'project', permission: 'edit' }
};
```

### Caching

The permission service caches role and permission data for 5 minutes to reduce database load:

```typescript
// src/lib/services/permission-service.ts
private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache is cleared when:
// 1. TTL expires (automatic cleanup every 5 minutes)
// 2. User calls clearUserCache(userId)
// 3. User calls clearAllCaches()
permissionService.clearUserCache(userId);
```

## Database Schema

The permissions system relies on these core tables:

### team_members

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Reference to the user |
| team_id | uuid | Reference to the team |
| role | text | One of: owner, admin, member, viewer |
| created_at | timestamp | Membership creation time |

### project_members

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Reference to the user |
| project_id | uuid | Reference to the project |
| role | text | One of: owner, admin, member, viewer |
| team_id | uuid | Optional team association |

### user_area_access

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Reference to the user |
| area | text | One of: planning, development, quality, governance |
| is_active | boolean | Whether access is currently active |

## Testing

Permission service behavior is validated through comprehensive unit tests in `src/lib/services/__tests__/permission-service.test.ts`:

- Role permission evaluation for each role/resource combination
- Caching behavior (second calls use cache, cleared cache forces database query)
- Subscription tier feature and limit checks
- Role hierarchy comparison
- Invalid input handling
- Action-to-permission mapping

## Security Considerations

1. **Never expose service role keys** to the client. Service role keys bypass all RLS policies.
2. **Always filter by project_id** in queries. RLS provides a safety net, but frontend queries should enforce isolation explicitly.
3. **Validate on both layers**. Frontend checks provide a better user experience. RLS provides defense in depth.
4. **Sanitize all inputs**. The permission service uses UUID sanitization before database queries.
5. **Rate limiting**. Permission checks are rate-limited to 100 checks per minute per user to prevent abuse.

## Related Topics

- [Authentication](../05-authentication/auth-flows.md) — Auth context, session management, sign-in flows
- [Project Context](../06-project-context/context-system.md) — Project selection context, state management patterns
- [Team Members](../17-team-members/members.md) — Member management, team operations
- [Database Schema](../04-database-schema/schema.md) — Core tables, relationships, and constraints
