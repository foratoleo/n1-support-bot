---
name: routing-system
description: Route structure, lazy loading, route guards, navigation patterns
area: 15
maintained_by: routing-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Routing System

## Overview

The application uses React Router v6 for client-side routing with a hierarchical area-based structure. Routes are organized by workflow areas (planning, development, quality, governance, legacy-code) with guards enforcing authentication, project selection, and area-specific access permissions.

## Route Structure

Routes are defined in `src/App.tsx` using React Router's declarative `<Routes>` component. The structure follows a three-tier hierarchy:

1. **Public Routes** -- no authentication required
2. **Protected Routes** -- wrapped in `ProtectedRoute`, require authentication
3. **Area-Guard Routes** -- wrapped in `AreaAccessGuard`, require area-specific permissions

```
BrowserRouter
  AuthProvider
    AreaAccessProvider
      AreaProvider
        GovernanceProvider
          Suspense (PageLoader fallback)
            Routes
              Public Routes
              ProtectedRoute (Layout)
                AreaAccessGuard (planning)
                  Planning Routes
                AreaAccessGuard (development)
                  Development Routes
                AreaAccessGuard (quality)
                  Quality Routes
                AreaAccessGuard (governance)
                  Governance Routes
                AreaAccessGuard (legacy-code)
                  Legacy Code Routes
                MultiAreaAccessGuard
                  Shared Routes (sprints, bugs)
                Cross-Area Routes
```

## Lazy Loading Pattern

All page components are loaded lazily using `React.lazy()` combined with a custom `lazyWithRetry` wrapper (`src/lib/lazy-with-retry.ts`) that retries failed chunk loads up to 3 times with exponential backoff.

### Usage

```tsx
import { lazy } from 'react';
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Tasks = lazy(() => import('./pages/Tasks'));
const BugListPage = lazy(() => import('./pages/quality/BugListPage'));
```

### Suspense Boundary

A single `Suspense` boundary at the root level wraps all routes with a `PageLoader` fallback:

```tsx
<Suspense fallback={<PageLoader />}>
  <Routes>
    {/* all routes */}
  </Routes>
</Suspense>
```

Some routes include nested `Suspense` for particularly heavy components:

```tsx
<Route
  path="/quality/accessibility-test"
  element={
    <Suspense fallback={<PageLoader />}>
      <AccessibilityTestPage />
    </Suspense>
  }
/>
```

### Retry Logic

The `lazyWithRetry` wrapper catches chunk load failures (network errors, stale caches) and retries up to 3 times with a 1-second delay between attempts:

```typescript
// src/lib/lazy-with-retry.ts
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function lazyWithRetry(factory: LazyFactory) {
  return lazy(() => retryImport(factory, MAX_RETRIES));
}
```

## Route Guards

The application implements three layers of route protection:

### 1. ProtectedRoute

Checks authentication and project selection before rendering protected content.

**Location:** `src/components/ProtectedRoute.tsx`

**Behavior:**
- While auth is loading, renders `PageLoader`
- If not authenticated, redirects to `/login` preserving `location.state`
- While project selection is loading, renders `PageLoader`
- If no project is selected and route is not exempt, redirects to `/project-selector`

**Exempt Routes** (no project required):
```typescript
const PROJECT_EXEMPT_ROUTES = [
  '/project-selector', '/projects', '/products/create',
  '/team', '/profile', '/governance', '/privacy-policy',
  '/terms-of-service', '/admin',
];
```

### 2. AreaAccessGuard

Validates the authenticated user has permission for a specific workflow area.

**Location:** `src/components/navigation/AreaAccessGuard.tsx`

**Behavior:**
- While area access is loading, renders `PageLoader`
- If user lacks access, shows a toast warning and redirects to `redirectTo` (default: `/`)
- Admin users always pass through

**Usage:**
```tsx
<Route element={<AreaAccessGuard area="planning"><Outlet /></AreaAccessGuard>}>
  <Route path="/planning" element={<PlanningLanding />} />
  <Route path="/planning/features" element={<FeaturesListPage />} />
</Route>
```

### 3. MultiAreaAccessGuard

Allows access when the user has permission for at least one of multiple areas.

**Location:** `src/components/navigation/MultiAreaAccessGuard.tsx`

**Usage:**
```tsx
<Route element={
  <MultiAreaAccessGuard areas={['planning', 'development']}>
    <Outlet />
  </MultiAreaAccessGuard>
}>
  <Route path="/sprints" element={<SprintList />} />
</Route>
```

### 4. AreaRouteGuard

Validates and enforces area context on route changes for `/tasks` routes.

**Location:** `src/components/navigation/AreaRouteGuard.tsx`

**Behavior:**
- Validates the `area` query parameter on `/tasks` routes
- Redirects invalid or missing area to a valid fallback (navigation history, localStorage, or default `planning`)
- Uses `sessionStorage` to maintain navigation history for back button support

## Area Theme System

Each workflow area applies a distinct color theme via the `data-area` CSS attribute on a container element. This is applied by the `Layout` component using the `AreaContext`.

### Area Color Palettes

| Area | Primary Color | CSS Attribute |
|------|--------------|---------------|
| Planning | Dark Gold `#B8860B` | `data-area="planning"` |
| Development | Gray `#9E9E9E` | `data-area="development"` |
| Quality | Bronze `#CD7F32` | `data-area="quality"` |
| Governance | Dark Green `#1B4332` | `data-area="governance"` |
| Legacy Code | Dark Terracotta `#8B3A1A` | `data-area="legacy-code"` |

### CSS Variable Usage

Components consume area-specific colors through CSS variables:

```css
[data-area="planning"] {
  --phase-primary: #B8860B;
  --phase-accent: #DAA520;
  --phase-bg: rgba(255, 249, 230, 0.4);
}

.my-component {
  background-color: var(--phase-bg);
  border-color: var(--phase-primary);
}
```

## Route Table

| Path | Component | Area Guard | Auth Required |
|------|-----------|-----------|-------------|
| `/` | `Dashboard` | None | Yes |
| `/project-selector` | `ProjectSelector` | None | Yes |
| `/login` | `Login` | None | No |
| `/forgot-password` | `ForgotPassword` | None | No |
| `/reset-password` | `ResetPassword` | None | No |
| `/privacy-policy` | `PrivacyPolicyPage` | None | Yes |
| `/terms-of-service` | `TermsOfServicePage` | None | Yes |
| `/demos` | `DemosPage` | None | No |
| `/meetings/share/:token` | `PublicMeetingSharePage` | None | No |
| `/profile/edit` | `UserProfileEditPage` | None | Yes |
| `/upload-media` | `UploadMedia` | None | Yes |
| `/chat` | `ChatPage` | None | Yes |
| `/my-drafts` | `MyDraftsPage` | None | Yes |
| `/calendar/events/:id` | `CalendarEventDetailPage` | None | Yes |
| `/admin/indexing` | `IndexingManagementPage` | None | Yes |
| `/auth/calendar-callback` | `CalendarOAuthCallback` | None | No |
| `/planning` | `PlanningLanding` | `planning` | Yes |
| `/planning/prds-user-stories` | `PlanningDocumentsPage` | `planning` | Yes |
| `/planning/features` | `FeaturesListPage` | `planning` | Yes |
| `/planning/features/create` | `FeatureCreationPage` | `planning` | Yes |
| `/planning/features/:featureId` | `FeatureDetailPage` | `planning` | Yes |
| `/planning/backlog` | `BacklogHubPage` | `planning` | Yes |
| `/planning/backlog/statistics` | `BacklogStatisticsPage` | `planning` | Yes |
| `/planning/backlog/list` | `BacklogListPage` | `planning` | Yes |
| `/planning/backlog/prioritize` | `BacklogPrioritizationPage` | `planning` | Yes |
| `/planning/backlog/board` | `BacklogBoardPage` | `planning` | Yes |
| `/planning/backlog/generate` | `BacklogGenerationPage` | `planning` | Yes |
| `/planning/projects/edit/:id` | `ProjectForm` | `planning` | Yes |
| `/transcriptions` | `TranscriptionsPage` | `planning` | Yes |
| `/transcriptions/upload` | `TranscriptionUploadPage` | `planning` | Yes |
| `/transcriptions/:id` | `TranscriptionDetailPage` | `planning` | Yes |
| `/transcriptions/:id/edit` | `TranscriptionEditPage` | `planning` | Yes |
| `/team` | `Teams` | `planning` | Yes |
| `/team/create` | `CreateTeam` | `planning` | Yes |
| `/team/expand` | `TeamExpansionPage` | `planning` | Yes |
| `/team/:id` | `TeamMemberDetailPage` | `planning` | Yes |
| `/meetings` | `MeetingList` | `planning` | Yes |
| `/meetings/create` | `MeetingCreate` | `planning` | Yes |
| `/meetings/edit/:id` | `MeetingEdit` | `planning` | Yes |
| `/meetings/:id` | `MeetingDetailPage` | `planning` | Yes |
| `/development` | `DevelopmentLanding` | `development` | Yes |
| `/development/pull-requests` | `PullRequestsDashboard` | `development` | Yes |
| `/development/pr-metrics` | `PRMetricsDashboard` | `development` | Yes |
| `/development/code-review-metrics` | `CodeReviewMetricsPage` | `development` | Yes |
| `/development/performance` | `DevPerformanceDashboard` | `development` | Yes |
| `/development/performance/compare` | `DevPerformanceComparePage` | `development` | Yes |
| `/development/performance/:login` | `DevPerformanceDetailPage` | `development` | Yes |
| `/development/refactor-insights` | `RefactorInsightsPage` | `development` | Yes |
| `/development/repositories` | `RepositoriesListingPage` | `development` | Yes |
| `/development/analysis-reports` | `AnalysisReportsPage` | `development` | Yes |
| `/development/analysis-reports/:id` | `AnalysisReportDetailPage` | `development` | Yes |
| `/development/ai-agents` | `AIAgentsListPage` | `development` | Yes |
| `/development/ai-agents/:memberId` | `AIAgentConfigPage` | `development` | Yes |
| `/development/style-guides` | `StyleGuidesPage` | `development` | Yes |
| `/development/style-guides/settings` | `StyleGuideChatSettingsPage` | `development` | Yes |
| `/development/style-guides/new` | `StyleGuideDetailPage` | `development` | Yes |
| `/development/style-guides/:id` | `StyleGuideDetailPage` | `development` | Yes |
| `/documents` | `DocumentsListingPage` | `development` | Yes |
| `/documents/task-viewer` | `TaskDocumentViewerPage` | `development` | Yes |
| `/quality` | `QualityLanding` | `quality` | Yes |
| `/quality/test-cases` | `TestCasesPage` | `quality` | Yes |
| `/quality/bug-reports` | `BugReportsDashboard` | `quality` | Yes |
| `/quality/automated-tests` | `AutomatedTestingDashboard` | `quality` | Yes |
| `/quality/test-generator` | `TestGeneratorPage` | `quality` | Yes |
| `/quality/accessibility-reports` | `AccessibilityReportsPage` | `quality` | Yes |
| `/quality/performance-reports` | `PerformanceReportsPage` | `quality` | Yes |
| `/quality/accessibility-test` | `AccessibilityTestPage` | `quality` | Yes |
| `/quality/performance-test` | `PerformanceTestPage` | `quality` | Yes |
| `/quality/bugs` | `BugListPage` | `quality` or `development` | Yes |
| `/quality/bugs/:bugId` | `BugDetailPage` | `quality` or `development` | Yes |
| `/governance` | `GovernanceLanding` | `governance` | Yes |
| `/governance/documents` | `GovernanceDocumentsPage` | `governance` | Yes |
| `/governance/indexing` | `GovernanceIndexingPage` | `governance` | Yes |
| `/governance/permissions-visibility` | `PermissionsVisibilityPage` | `governance` | Yes |
| `/governance/jira` | `GovernanceJiraIntegrationsListPage` | `governance` | Yes |
| `/governance/jira/:projectId` | `GovernanceJiraConfigFormPage` | `governance` | Yes |
| `/governance/ai-settings` | `PlatformSettingsPage` | `governance` | Yes |
| `/governance/access-control` | `AccessControlPage` | `governance` | Yes |
| `/governance/area-access` | `AreaAccessPage` | `governance` | Yes |
| `/governance/allocation-requests` | `AllocationRequestsPage` | `governance` | Yes |
| `/governance/users` | `UserManagementPage` | `governance` | Yes |
| `/governance/meeting-recording` | `MeetingRecordingConfigPage` | `governance` | Yes |
| `/governance/rag-config` | `RagConfigPage` | `governance` | Yes |
| `/governance/meeting-share` | `GovernanceMeetingSharePage` | `governance` | Yes |
| `/governance/projects/edit/:id` | `ProjectForm` | `governance` | Yes |
| `/knowledge` | `KnowledgeListPage` | `governance` | Yes |
| `/knowledge/new` | `KnowledgeFormPage` | `governance` | Yes |
| `/knowledge/:id` | `KnowledgeEntryDetail` | `governance` | Yes |
| `/projects` | `ManageProjects` | `governance` | Yes |
| `/projects/edit/:id` | `ProjectForm` | `governance` | Yes |
| `/projects/:projectId` | `ProjectDetails` | `governance` | Yes |
| `/products/create` | `ProductCreationPage` | `governance` | Yes |
| `/legacy-code` | `LegacyCodeLanding` | `legacy-code` | Yes |
| `/legacy-code/code-health` | `CodeHealthDashboard` | `legacy-code` | Yes |
| `/legacy-code/migration-tracker` | `MigrationTrackerPage` | `legacy-code` | Yes |
| `/legacy-code/tech-debt` | `TechDebtRegistryPage` | `legacy-code` | Yes |
| `/legacy-code/compatibility` | `CompatibilityPage` | `legacy-code` | Yes |
| `/legacy-code/refactoring-plans` | `RefactoringPlansPage` | `legacy-code` | Yes |
| `/sprints` | `SprintList` | `planning` or `development` | Yes |
| `/sprints/new` | `SprintForm` | `planning` or `development` | Yes |
| `/sprints/analytics` | `SprintAnalyticsPage` | `planning` or `development` | Yes |
| `/sprints/:id` | `SprintDetails` | `planning` or `development` | Yes |
| `/sprints/:id/edit` | `SprintForm` | `planning` or `development` | Yes |
| `/sprints/:id/tasks` | `SprintTasks` | `planning` or `development` | Yes |
| `/tasks` | `Tasks` | None | Yes |
| `/tasks/hub` | `TasksLandingPage` | None | Yes |
| `/tasks/ai-suggestions` | `AISuggestedTasksPage` | None | Yes |
| `/tasks/:id/edit` | `TaskEditPage` | None | Yes |
| `/suggested-tasks` | `SuggestedTasks` | None | Yes |
| `/code` | `Code` | None | Yes |
| `/qa` | `QA` | None | Yes |
| `/metrics` | `Metrics` | None | Yes |
| `*` | `NotFound` | None | Yes |

## Navigation Configuration

Navigation items for each area are centralized in `src/config/navigation.ts` and typed via `src/types/navigation.ts`.

### Navigation Item Structure

```typescript
interface NavigationItem {
  id: string;
  label: string;        // i18n key, e.g. 'navigation.tasks'
  route: string;        // React Router path
  icon: LucideIcon;
  description?: string; // i18n key for tooltip
  badge?: number | string | boolean;
  isNew?: boolean;
  requiresPermission?: string;
}
```

### Area Navigation Config

```typescript
export const navigationConfig: NavigationConfig = {
  planning: [
    { id: 'backlog', label: 'navigation.backlog', route: '/planning/backlog', icon: ListTodo },
    { id: 'features', label: 'navigation.features', route: '/planning/features/list', icon: Boxes },
    { id: 'tasks', label: 'navigation.tasks', route: '/tasks', icon: CheckSquare },
    { id: 'team', label: 'navigation.team', route: '/team', icon: Users },
    { id: 'meetings', label: 'navigation.meetings', route: '/meetings', icon: Calendar },
  ],
  development: [ /* ... */ ],
  quality: [ /* ... */ ],
  governance: [ /* ... */ ],
  'legacy-code': [ /* ... */ ],
};
```

### Area Detection

Area detection uses route patterns defined in `src/lib/navigation/areaMapping.ts`. Each area has a priority-based set of route patterns:

| Priority | Pattern Type | Example |
|----------|-------------|---------|
| 100 | Exact match | `/planning`, `/quality` |
| 50 | Parameterized | `/projects/:id`, `/development/:path` |
| 40 | Nested catch-all | `/planning/*`, `/governance/*` |

## useI18n for Route Labels

All user-facing labels in the navigation use the `useI18n` hook for internationalization.

### Hook Definition

```typescript
// src/hooks/useI18n.ts
export const useI18n = (namespace?: string) => {
  const { t, i18n } = useTranslation();

  return {
    t: (key: string, options?: any) =>
      t(namespace ? `${namespace}.${key}` : key, options),
    language: i18n.language,
    changeLanguage: (lng: string) => i18n.changeLanguage(lng),
    isReady: i18n.isInitialized,
  };
};
```

### Usage in Components

```tsx
import { useI18n } from '@/hooks/useI18n';

export default function Layout() {
  const { t } = useI18n('navigation');

  const navItems = [
    { href: '/team', label: t('layout.teams') },
    { href: '/knowledge', label: t('knowledge') },
    { href: '/meetings', label: t('layout.meetings') },
    { href: '/tasks', label: t('tasks') },
  ];

  return (/* ... */);
}
```

### Translation Structure

Translation keys for navigation are organized in `src/locales/modules/core/en-us/navigation.ts`:

```typescript
export const navigation = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  teams: "Teams",
  meetings: "Meetings",
  backlog: "Product Backlog",
  features: "Features",
  knowledge: "Knowledge Base",
  // ...
  areas: {
    planning: "Planning",
    development: "Development",
    quality: "Quality",
    governance: "Governance",
    legacyCode: "Legacy Code",
  },
  layout: {
    teams: "Team",
    meetings: "Meetings",
    menu: "Menu",
    account: "Account",
  },
};
```

## Layout Component

The `Layout` component (`src/components/Layout.tsx`) wraps all authenticated routes and provides:

- **TopNavigationMenu** -- sticky top navigation bar
- **AreaSidebar** -- collapsible sidebar with area-specific navigation
- **SidebarNavigation** -- area-aware navigation items from `navigationConfig`
- **Footer** -- bottom footer with sidebar offset
- **FloatingChatButton** -- AI assistant chat button
- **Area context** -- sets `data-area` attribute for theming

The sidebar visibility is tied to the current area:

```tsx
const { currentArea } = useArea();
const showSidebar = currentArea !== null && currentArea !== undefined;
```

## Redirect Routes

Legacy routes are maintained for backward compatibility via redirect routes:

| Legacy Path | Redirects To |
|------------|-------------|
| `/manage-projects` | `/projects` |
| `/dashboard` | `/` |
| `/projects/new` | `/products/create` |
| `/presigned-upload-demo` | `/upload-media` |
| `/settings/jira` | `/governance/jira` |

## Related Topics

- [UI Theming](../16-ui-theming/themes.md) -- area color themes and CSS variables
- [Component Organization](../14-component-organization/components.md) -- component structure
- [Auth System](../10-auth-system/auth.md) -- authentication and session management
