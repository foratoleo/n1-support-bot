---
name: team-members
description: team_members table, profile management, TeamContext, member roles
area: 17
maintained_by: team-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Team Members Management

This document covers the complete team member management system, including database structure, profile types, team-project associations, context providers, and permission hierarchies.

---

## 1. team_members Table Structure

The `team_members` table stores individual team member profiles with their professional attributes. It is a global resource visible across projects, but members must be explicitly assigned to a project via the `project_team_members` join table to participate in that project's context.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | null | Full display name |
| slug | text | NO | null | URL-friendly unique identifier |
| headline | text | YES | null | Short professional headline |
| avatar_url | text | YES | null | Profile picture URL |
| profile | text | NO | 'fullstack' | Professional profile/specialization |
| status | text | NO | 'active' | Member status: active, suspended, archived |
| member_type | character varying | YES | 'human' | human or ai-agent |
| created_by | text | YES | null | Creator reference ID |
| created_at | timestamp with time zone | NO | now() | Creation timestamp |
| updated_at | timestamp with time zone | NO | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Supporting Tables

**team_member_skills** -- Stores detailed skills with proficiency levels.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| team_member_id | uuid | FK to team_members.id |
| skill_name | text | Name of the skill |
| skill_type | text | technical, soft, language, domain |
| proficiency_level | integer | 1 to 5 scale |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft-delete timestamp |

**team_member_tools** -- Stores tools, frameworks, and languages with proficiency.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| team_member_id | uuid | FK to team_members.id |
| tool_name | text | Name of the tool |
| proficiency_level | integer | 1 to 5 scale |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft-delete timestamp |

---

## 2. Profile Management

Each team member has a `profile` field that defines their professional specialization. Profiles are grouped into four organizational areas, each with its own color theme.

### Profile Types

**Planning Area**

| Profile | Label |
|---------|-------|
| pm | Product Manager |
| po | Product Owner |
| analyst | Analyst |
| requirements_analyst | Requirements Analyst |
| business_analyst | Business Analyst |
| designer | Designer |
| ux_researcher | UX Researcher |

**Development Area**

| Profile | Label |
|---------|-------|
| fullstack | Full Stack |
| frontend | Frontend |
| backend | Backend |
| mobile | Mobile |
| devops | DevOps |
| tech_lead | Tech Lead |
| architect | Architect |
| data_engineer | Data Engineer |

**Quality Area**

| Profile | Label |
|---------|-------|
| qa | QA Engineer |
| test_analyst | Test Analyst |
| automation_qa | Automation QA |
| code_reviewer | Code Reviewer |

**Governance Area**

| Profile | Label |
|---------|-------|
| admin | Administrator |
| director | Director |
| cto | CTO |
| ceo | CEO |
| scrum_master | Scrum Master |

### Profile Configuration

The `PROFILE_CONFIG` constant maps each profile to a display label and icon.

```typescript
export const PROFILE_CONFIG: Record<TeamMemberProfile, { label: string; icon: string }> = {
  fullstack: { label: 'Full Stack', icon: '...' },
  frontend: { label: 'Frontend', icon: '...' },
  // ...
};
```

### Area Mapping

Each profile belongs to an area that determines the CSS color theme applied in the interface.

```typescript
export const TEAM_AREA_CONFIG: Record<TeamArea, {
  label: string;
  profiles: TeamMemberProfile[];
}> = {
  planning: {
    label: 'Planning',
    profiles: ['pm', 'po', 'analyst', 'requirements_analyst', 'business_analyst', 'designer', 'ux_researcher'],
  },
  development: {
    label: 'Development',
    profiles: ['fullstack', 'frontend', 'backend', 'mobile', 'devops', 'tech_lead', 'architect', 'data_engineer'],
  },
  quality: {
    label: 'Quality',
    profiles: ['qa', 'test_analyst', 'automation_qa', 'code_reviewer'],
  },
  governance: {
    label: 'Governance',
    profiles: ['admin', 'director', 'cto', 'ceo', 'scrummaster'],
  },
};
```

CSS variables define the colors per area:

```css
[data-area="planning"] {
  --phase-primary: #B8860B;
  --phase-accent: #DAA520;
  --phase-bg: rgba(255, 249, 230, 0.4);
}

[data-area="development"] {
  --phase-primary: #9E9E9E;
  --phase-accent: #C0C0C0;
  --phase-bg: rgba(245, 245, 245, 0.4);
}

[data-area="quality"] {
  --phase-primary: #CD7F32;
  --phase-accent: #D4A574;
  --phase-bg: rgba(255, 245, 235, 0.4);
}

[data-area="governance"] {
  --phase-primary: #1B4332;
  --phase-accent: #2D6A4F;
  --phase-bg: rgba(240, 247, 244, 0.4);
}
```

---

## 3. TeamContext for Team State

`TeamContext` provides app-wide team selection state and persistence. It wraps the application and exposes team-related data and operations to all components.

### Provider Setup

```typescript
// Wrap your app with TeamProvider
import { TeamProvider } from '@/contexts/TeamContext';

function App() {
  return (
    <TeamProvider>
      <YourApp />
    </TeamProvider>
  );
}
```

### Context Value

```typescript
interface TeamContextValue {
  // Current team state
  currentTeam: Team | null;
  teams: Team[];

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Team selection operations
  selectTeam: (teamId: string | null) => Promise<void>;
  refreshTeams: () => Promise<void>;
  clearTeamSelection: () => void;

  // Team selector UI state
  isTeamSelectorOpen: boolean;
  setTeamSelectorOpen: (open: boolean) => void;
}
```

### Persistence

Team selection is persisted to localStorage under the key `dr-meet-transform-current-team`. On mount, the provider restores the previously selected team or auto-selects the first available team if none is persisted.

Selection priority on mount:

1. `initialTeamId` prop if provided.
2. Persisted team ID from localStorage.
3. First team in the list if no prior selection exists.

### Convenience Hooks

```typescript
// Full context access
const { currentTeam, teams, selectTeam } = useTeamContext();

// Just the current team
const currentTeam = useCurrentTeam();

// Check if a team is selected
const hasTeam = useHasTeam(); // returns boolean
```

---

## 4. Member Roles and Permissions

The system uses a role-based access control model with four roles: `owner`, `admin`, `member`, and `viewer`. Role hierarchy is enforced numerically, with `owner` at the top.

### Role Hierarchy

```typescript
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};
```

### Permission Matrix

| Role | Team | Project | Document |
|------|------|---------|----------|
| owner | view, edit, delete, manage, invite | view, edit, delete, manage, invite | view, edit, delete, manage |
| admin | view, edit, manage, invite | view, edit, delete, manage, invite | view, edit, delete, manage |
| member | view | view, edit | view, edit |
| viewer | view | view | view |

### Permission Service

`PermissionService` is a singleton that handles all permission checks with caching.

```typescript
import { permissionService } from '@/lib/services/permission-service';

// Check team-level permission
const permission = await permissionService.checkTeamPermission(
  userId,
  teamId,
  'edit'
);

// Check project-level permission
const permission = await permissionService.checkProjectPermission(
  userId,
  projectId,
  'manage'
);

// Check if user can perform an action
const can = await permissionService.canPerformAction(
  userId,
  'invite_member',
  { teamId: '...' }
);

// Get all permissions for a user
const permissions = await permissionService.getUserPermissions(userId);
```

### useTeamPermissions Hook

The `useTeamPermissions` hook provides React bindings for the permission service with caching, batching, and state management.

```typescript
import { useTeamPermissions } from '@/hooks/useTeamPermissions';

function MyComponent() {
  const {
    permissions,
    hasPermission,
    canPerformAction,
    checkTeamPermission,
    checkProjectPermission,
    isLoading,
    error,
    refreshPermissions,
    clearCache
  } = useTeamPermissions({
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    preloadPermissions: [
      { resource: 'team', resourceId: teamId, action: 'view' },
      { resource: 'project', resourceId: projectId, action: 'edit' }
    ]
  });

  // Check a specific permission
  const canEdit = await hasPermission('project', projectId, 'edit');

  // Check action-based permission
  const canInvite = await canPerformAction('invite_member', { teamId });

  // Check team permission with caching
  const teamPerm = await checkTeamPermission(teamId, 'manage');

  return <div>{/* ... */}</div>;
}
```

### Subscription Tier Limits

Permission checks also validate subscription tier limits.

| Tier | Max Teams | Max Projects | Max Members |
|------|-----------|--------------|-------------|
| free | 1 | 3 | 5 |
| starter | 3 | 10 | 15 |
| professional | 10 | 50 | 50 |
| enterprise | unlimited | unlimited | unlimited |

```typescript
const { withinLimit, current, limit } = await permissionService.checkSubscriptionLimits(
  teamId,
  'members'
);
```

---

## 5. Team-Project Associations

Members do not belong directly to teams. Instead, they are assigned to projects via the `project_team_members` join table.

### project_team_members Table

| Column | Type | Purpose |
|--------|------|---------|
| id | bigint | Primary key |
| project_id | uuid | FK to project_knowledge_base.id |
| member_id | uuid | FK to team_members.id |
| role | text | Project-specific role (optional) |
| joined_at | timestamp | When member joined the project |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft-delete timestamp |

### Service Operations

```typescript
import {
  getProjectMembers,
  getMemberProjects,
  addMemberToProject,
  removeMemberFromProject,
  bulkAddMembersToProject,
  bulkRemoveMembersFromProject,
  updateProjectMemberRelationship
} from '@/lib/services/project-team-member-service';

// Get all members assigned to a project
const members = await getProjectMembers(projectId);

// Get all projects for a member
const projects = await getMemberProjects(memberId);

// Assign a member to a project
await addMemberToProject({
  project_id: projectId,
  member_id: memberId,
  role: 'developer'
});

// Remove a member from a project
await removeMemberFromProject(projectId, memberId);

// Bulk assign multiple members
await bulkAddMembersToProject(projectId, [id1, id2, id3], 'developer');
```

### useProjectTeams Hook

```typescript
import { useProjectTeams } from '@/hooks/useProjectTeams';

function ProjectTeamPanel({ projectId }: { projectId: string }) {
  const {
    projectTeam,        // Members assigned to this project
    orgTeam,            // All organization team members
    availableMembers,   // Members not yet in the project
    isLoadingProject,
    isLoadingOrg,
    addMember,
    removeMember,
    addMultipleMembers,
    getMemberProjects,
    isAddingMember,
    isRemovingMember
  } = useProjectTeams(projectId);

  return (
    <div>
      {/* Assigned members */}
      {projectTeam.map(pt => (
        <div key={pt.id}>
          {pt.member.name}
          <button onClick={() => removeMember(pt.member_id)}>Remove</button>
        </div>
      ))}

      {/* Add available members */}
      {availableMembers.map(member => (
        <button key={member.id} onClick={() => addMember({ memberId: member.id })}>
          Add {member.name}
        </button>
      ))}
    </div>
  );
}
```

### Views for Project-Member Data

The system provides database views for efficient querying of member-project relationships:

- `view_project_team_members_detail` -- Full details of member-project relationships with member and project info.
- `view_project_member_counts` -- Per-project member counts.
- `view_member_project_counts` -- Per-member project counts.

---

## 6. Common Team Member Operations

### useTeamMembers Hook

```typescript
import { useTeamMembers } from '@/hooks/useTeamMembers';

// Read-only usage
const {
  members,
  selectedMember,
  selectedMemberId,
  isLoading,
  error,
  memberStats,
  selectMember,
  refreshMembers,
  clearSelection
} = useTeamMembers();

// With management operations enabled
const {
  members,
  selectedMember,
  addMember,
  updateMember,
  updateMemberStatus,
  removeMember,
  mutationStates
} = useTeamMembers(filters, true);

// Fetch with project data for card display
const { members } = useTeamMembers(undefined, false, true); // fetchWithProjects = true
```

### Creating a Team Member

```typescript
import { addTeamMember } from '@/lib/services/team-member-service';

const member = await addTeamMember({
  name: 'John Smith',
  slug: 'john-smith',          // Optional, auto-generated from name
  headline: 'Senior Developer',
  avatar_url: 'https://...',
  profile: 'fullstack',
  member_type: 'human',
  status: 'active',
  created_by: userId,
  bio: 'Experienced full-stack developer...',
  email: 'john@example.com'
});
```

### Updating a Team Member

```typescript
import { updateTeamMember } from '@/lib/services/team-member-service';

const updated = await updateTeamMember(memberId, {
  name: 'John A. Smith',
  headline: 'Lead Engineer',
  profile: 'tech_lead'
});
```

### Changing Member Status

```typescript
import { updateMemberStatus } from '@/lib/services/team-member-service';

// Suspend a member
await updateMemberStatus(memberId, 'suspended');

// Archive a member (soft delete)
await updateMemberStatus(memberId, 'archived');
```

### Managing Skills and Tools

```typescript
import { getMemberSkills, updateMemberSkills, getMemberTools, updateMemberTools } from '@/lib/services/team-member-service';

// Get current skills
const skills = await getMemberSkills(memberId);

// Update skills
await updateMemberSkills(memberId, [
  { skill_name: 'TypeScript', skill_type: 'technical', proficiency_level: 5 },
  { skill_name: 'React', skill_type: 'technical', proficiency_level: 4 }
]);

// Get current tools
const tools = await getMemberTools(memberId);

// Update tools
await updateMemberTools(memberId, [
  { tool_name: 'VS Code', proficiency_level: 5 },
  { tool_name: 'Docker', proficiency_level: 4 }
]);
```

### Filters for Querying Members

```typescript
const filters: TeamMemberFilters = {
  status: 'active',           // active, suspended, archived
  member_type: 'human',       // human, ai-agent
  profile: 'fullstack',
  search: 'John',
  include_deleted: false
};

const { members } = useTeamMembers(filters);
```

### Checking Slug Availability

```typescript
import { isSlugAvailable } from '@/lib/services/team-member-service';

const available = await isSlugAvailable('john-smith', excludeId);
```

---

## 7. Utility Functions

The `TeamMemberUtils` object provides helper functions for common operations.

```typescript
import { TeamMemberUtils } from '@/types/team';

// Check member type
TeamMemberUtils.isHuman(member);      // true for humans
TeamMemberUtils.isAIAgent(member);    // true for AI agents

// Check status
TeamMemberUtils.isActive(member);     // status === 'active' && !deleted_at
TeamMemberUtils.isDeleted(member);    // !!deleted_at

// Generate slug from name
const slug = TeamMemberUtils.generateSlug('John Smith'); // 'john-smith'

// Get display labels
TeamMemberUtils.getProfileLabel('fullstack');     // 'Full Stack'
TeamMemberUtils.getMemberTypeLabel('human');      // 'Human'
TeamMemberUtils.getStatusConfig('active');        // { label: 'Active', color: 'success' }

// Create a member payload with defaults
const payload = TeamMemberUtils.createPayload('Jane Doe', {
  profile: 'frontend',
  member_type: 'human'
});
```

---

## 8. Related Files

| File | Purpose |
|------|---------|
| `src/types/team.ts` | All type definitions for team members, profiles, areas |
| `src/contexts/TeamContext.tsx` | Global team state provider |
| `src/hooks/useTeamMembers.ts` | React hook for team member data management |
| `src/hooks/useTeamPermissions.ts` | React hook for permission checking |
| `src/hooks/useProjectTeams.ts` | React hook for project-member associations |
| `src/lib/services/team-member-service.ts` | CRUD operations for team_members table |
| `src/lib/services/project-team-member-service.ts` | Project-member relationship management |
| `src/lib/services/permission-service.ts` | Role-based access control and caching |
| `docs/04-database-schema/schema.md` | Database schema reference |

---

## 9. Key Design Decisions

1. **Global team_members, project-scoped usage** -- The team_members table is not tied to a team_id. Members are globally available and assigned to projects via the join table. This allows the same member to participate in multiple projects with potentially different roles.

2. **Soft deletes everywhere** -- All member status changes (suspended, archived) and project-team associations use soft delete via the `deleted_at` column. No hard deletes occur.

3. **Separation of profile from role** -- A member's `profile` (fullstack, qa, etc.) is their professional specialization, distinct from the project-level `role` that controls their permissions within a specific project.

4. **Permission caching** -- The `PermissionService` caches role lookups and permission results for 5 minutes to reduce database queries. The `useTeamPermissions` hook also maintains a local cache keyed by userId and resource.

5. **Area-based theming** -- CSS variables driven by `data-area` attributes apply consistent color themes to components based on the profile area (Planning, Development, Quality, Governance).