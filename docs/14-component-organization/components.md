---
name: component-organization
description: UI components, project components, naming conventions, component structure patterns
area: 14
maintained_by: component-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Component Organization

The workforce application organizes its React components into two primary directories following a clear separation of concerns between generic UI primitives and domain-specific project features.

## Directory Structure

```
src/components/
  ui/          # Shadcn/ui base components (49 files)
  projects/    # Project-specific components (37 files)
```

## src/components/ui/ - Base Component Library

All components in `src/components/ui/` are built on top of Radix UI primitives and styled with Tailwind CSS. These are generic, reusable components that are not tied to any specific business domain.

### Core Components (49 files)

| Component | Purpose |
|-----------|---------|
| button.tsx | Button with CVA variants (default, destructive, outline, secondary, ghost, link, area) |
| dialog.tsx | Modal dialog built on @radix-ui/react-dialog |
| badge.tsx | Status badge component |
| card.tsx | Card container component |
| input.tsx | Text input field |
| select.tsx | Dropdown select built on Radix |
| table.tsx | Data table structure |
| form.tsx | Form wrapper with validation |
| toast.tsx | Toast notification (sonner) |
| dropdown-menu.tsx | Dropdown menu built on Radix |
| tooltip.tsx | Tooltip component |
| tabs.tsx | Tabbed interface |
| calendar.tsx | Date picker calendar |
| chart.tsx | Chart visualization wrapper |
| checkbox.tsx | Checkbox input |
| switch.tsx | Toggle switch |
| textarea.tsx | Multi-line text input |
| alert.tsx | Alert message component |
| alert-dialog.tsx | Alert dialog confirmation |
| progress.tsx | Progress bar indicator |
| skeleton.tsx | Loading skeleton placeholder |
| pagination.tsx | Pagination controls |
| sidebar.tsx | Sidebar navigation container |
| sheet.tsx | Side panel (drawer) |
| scroll-area.tsx | Scrollable container |
| resizable.tsx | Resizable panel |
| avatar.tsx | User avatar image |
| breadcrumb.tsx | Breadcrumb navigation |
| carousel.tsx | Carousel/slider component |
| accordion.tsx | Collapsible accordion panels |
| collapsible.tsx | Collapsible container |
| popover.tsx | Popover menu |
| context-menu.tsx | Right-click context menu |
| menubar.tsx | Menu bar container |
| combobox.tsx | Searchable combobox |
| code-editor.tsx | Code editor wrapper |
| file-upload.tsx | File upload component |
| input-otp.tsx | OTP input code |
| radio-group.tsx | Radio button group |
| slider.tsx | Range slider |
| toggle.tsx | Toggle button |
| toggle-group.tsx | Toggle button group |
| hover-card.tsx | Hover card popover |
| separator.tsx | Horizontal/vertical separator |
| label.tsx | Form label |
| aspect-ratio.tsx | Aspect ratio container |
| sonner.tsx | Sonner toast provider |

### Architecture Pattern

All Shadcn/ui components follow a consistent pattern:

1. Import React and Radix primitive
2. Import `cn` utility from `@/lib/utils`
3. Define component with `React.forwardRef` for ref forwarding
4. Apply Tailwind classes with `cn()` utility for conditional styling

Example from `button.tsx`:

```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// CVA (Class Variance Authority) for variant management
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium...",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--phase-primary)] text-white...",
        destructive: "bg-destructive text-destructive-foreground...",
        outline: "border border-input bg-background...",
        // ...
      },
      size: { default: "h-10 px-4 py-2", sm: "h-9...", lg: "h-11...", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

// Forward ref pattern for ref accessibility
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

## src/components/projects/ - Domain-Specific Components

Components in `src/components/projects/` implement business logic tied to project management features. They consume the base UI components and integrate with application contexts.

### Component Inventory (37 files)

| Component | Purpose |
|-----------|---------|
| ProjectAccessBadge.tsx | Badge showing user access level (owner/granted/denied) |
| ProjectAccessControl.tsx | Access control settings for projects |
| ProjectAccessManager.tsx | Full access management interface |
| ProjectActionsDropdown.tsx | Actions menu for project items |
| ProjectActivityFeed.tsx | Activity stream display |
| ProjectAvatar.tsx | Project visual identifier |
| ProjectBrandingFields.tsx | Branding configuration form |
| ProjectCollaborators.tsx | Collaborator list display |
| ProjectDeleteDialog.tsx | Project deletion confirmation |
| ProjectDetailsCard.tsx | Project summary card |
| ProjectDetailsHeader.tsx | Project header section |
| ProjectFilters.tsx | Filter controls for project views |
| ProjectFormDialog.tsx | Create/edit project form |
| ProjectImportExportDialog.tsx | Data import/export interface |
| ProjectLeaderManager.tsx | Project leader assignment |
| ProjectMemberManager.tsx | Team member management |
| ProjectOverviewTab.tsx | Overview tab content |
| ProjectPermissionRules.tsx | Permission rule configuration |
| ProjectPermissionsDialog.tsx | Permission settings dialog |
| ProjectStatsCards.tsx | Statistics display cards |
| ProjectTeamSelector.tsx | Team selection control |
| ProjectVisibilitySettings.tsx | Visibility configuration |
| ProjectVisibilityToggle.tsx | Visibility toggle control |
| TeamMemberManager.tsx | Team member operations |
| DocumentList.tsx | Document listing wrapper |
| DocumentManager.tsx | Full document management |
| DocumentUpload.tsx | Document upload interface |
| GitRepositoryForm.tsx | Git repository configuration |
| GitRepositoryItem.tsx | Repository list item |
| GitRepositoryManager.tsx | Repository management interface |
| MemberListItem.tsx | Team member list entry |
| BulkAccessDialog.tsx | Bulk access operations |
| BulkActionsBar.tsx | Bulk action toolbar |
| BulkDeleteDialog.tsx | Bulk deletion confirmation |
| BulkOwnerAssignDialog.tsx | Bulk owner assignment |
| AccessStatusBadge.tsx | Access status indicator |
| ProjectAccessBadge.example.tsx | Example usage documentation |

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `Project[Feature].tsx` | `ProjectDetailsCard.tsx` | Project entity feature |
| `[Feature]List.tsx` | `DocumentList.tsx` | List/collection views |
| `[Feature]Manager.tsx` | `TeamMemberManager.tsx` | Full CRUD management |
| `[Feature]Dialog.tsx` | `ProjectDeleteDialog.tsx` | Modal dialogs |
| `[Feature]Badge.tsx` | `ProjectAccessBadge.tsx` | Status indicators |
| `Bulk[Action]Dialog.tsx` | `BulkDeleteDialog.tsx` | Batch operations |
| `[Feature]Item.tsx` | `MemberListItem.tsx` | List item components |

## Component Structure Pattern

All components follow a consistent internal structure to ensure maintainability and readability.

### Standard Component Template

```typescript
/**
 * [ComponentName] Component
 *
 * Brief description of what the component does and its main use cases.
 */

import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUserProjectAccess } from '@/hooks/useUserProjectAccess';
import { useAuth } from '@/contexts/AuthContext';
import { AccessStatus } from '@/types/project';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';

// 1. Type definitions and interfaces at the top
export interface ComponentNameProps {
  /** Primary prop description */
  propA: string;
  /** Optional callback description */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// 2. Helper functions (outside component or before hooks)
function getVariant(status: Status): 'variant-a' | 'variant-b' {
  switch (status) {
    case Status.ACTIVE: return 'variant-a';
    case Status.INACTIVE: return 'variant-b';
  }
}

// 3. Main component with hooks at the top
export const ComponentName: React.FC<ComponentNameProps> = ({
  propA,
  onAction,
  className
}) => {
  // Context hooks
  const { user } = useAuth();
  const { t } = useI18n('namespace');

  // Data hooks
  const { hasAccess, isLoading } = useUserProjectAccess(propA);

  // Local state hooks
  const [localState, setLocalState] = useState<string>('');
  const [isRetrying, setIsRetrying] = useState(false);

  // 4. Event handlers (useCallback for stability)
  const handleAction = useCallback(async () => {
    // Handler implementation
    onAction?.();
  }, [onAction]);

  const handleRetry = useCallback(async () => {
    // Retry logic
  }, []);

  // 5. Derived values and conditional logic
  const derivedValue = localState ? `prefix-${localState}` : 'default';

  // 6. Render logic at the bottom
  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className={cn("container-class", className)}>
      {/* Component content */}
    </div>
  );
};

export default ComponentName;
```

### Structure Rules

1. **Type definitions at top** - Export interface before component function
2. **Hooks at top of function** - All hooks called before any conditional logic
3. **Helper functions outside component** - Pure functions for reusable logic
4. **Event handlers use useCallback** - Memoized for performance
5. **Derived values computed before render** - Logical separation of concerns
6. **Render logic at bottom** - Return statement with JSX

## The @/ Alias

The `@/` path alias maps to `./src/` in the project root. This alias is configured in `tsconfig.json` and allows consistent imports regardless of file location.

### Usage Examples

```typescript
// From any file in src/, use @/ to reference src/
import { Button } from '@/components/ui/button';      // src/components/ui/button.tsx
import { useI18n } from '@/hooks/useI18n';            // src/hooks/useI18n.ts
import { supabase } from '@/integrations/supabase/client'; // src/integrations/supabase/client.ts
import type { Project } from '@/types/project';      // src/types/project.ts
import { cn } from '@/lib/utils';                     // src/lib/utils.ts
```

### Why @/ Alias

- Avoids deep relative paths like `../../../../components/...`
- Makes refactoring easier (moving files does not break imports)
- Clear intent: `@/` means "from src root"
- Standard practice in modern React + TypeScript projects

## useProjectSelection Hook

The `useProjectSelection` hook provides access to the currently selected project throughout the application. It is the primary mechanism for project-scoped data filtering.

### Import and Usage

```typescript
import { useProjectSelection } from '@/contexts/ProjectSelectionContext';

// Inside component
const { selectedProject } = useProjectSelection();

// Access project ID for database queries
const selectedProjectId = selectedProject?.id;

// Access full project object
console.log(selectedProject?.name);
console.log(selectedProject?.created_at);
```

### Context Interface

```typescript
interface ProjectSelectionContextType {
  selectedProject: Project | null;      // Currently selected project
  setSelectedProject: (project: Project | null) => void;
  clearSelectedProject: () => void;
  isProjectMode: boolean;               // Whether in project-scoped mode
  setIsProjectMode: (mode: boolean) => void;
  isLoading: boolean;                   // Loading state
  projectHistory: Project[];            // Recent project selection history
  addToHistory: (project: Project) => void;
  clearHistory: () => void;
}
```

### Project-Scoped Query Pattern

All Supabase queries in project-scoped contexts must filter by `project_id`:

```typescript
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('project_id', selectedProject?.id)  // Always filter by project
  .order('created_at', { ascending: false });

// Cross-table queries also use project_id
const { data: documents } = await supabase
  .from('project_documents')
  .select('*')
  .eq('project_id', selectedProject?.id);
```

### Common Mistake: selectedProjectId Property

The `useProjectSelection` hook returns `selectedProject` (the full object), not `selectedProjectId`. Common mistakes:

```typescript
// INCORRECT - property does not exist
const { selectedProjectId } = useProjectSelection();

// CORRECT - access the id property of the selectedProject object
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;
```

### Provider Setup

Wrap the application (or relevant routes) with the provider:

```typescript
// In your app/router setup
import { ProjectSelectionProvider } from '@/contexts/ProjectSelectionContext';

function App() {
  return (
    <ProjectSelectionProvider>
      <YourRoutes />
    </ProjectSelectionProvider>
  );
}
```

## useI18n Hook for Translations

The `useI18n` hook wraps `react-i18next` and provides a namespaced translation interface. All user-facing text should use this hook for internationalization support.

### Import and Usage

```typescript
import { useI18n } from '@/hooks/useI18n';

// Basic usage with namespace
const { t } = useI18n('projects');  // Use translations from 'projects' namespace

// Usage with explicit key
<span>{t('member.create')}</span>  // Translates to "Criar Membro" (pt-BR) or "Create Member" (en-US)

// With interpolation parameters
{t('member.welcome', { name: 'John' })}  // "Welcome, John"
```

### Hook Return Interface

```typescript
interface I18nReturn {
  t: (key: string, options?: object) => string;  // Translation function
  language: string;                               // Current language code (e.g., 'pt-BR')
  changeLanguage: (lng: string) => void;        // Switch language programmatically
  isReady: boolean;                               // Whether translations are loaded
}
```

### Translation Files

Translations are stored in `src/locales/` with one file per language:

```
src/locales/
  pt-br.ts   # Portuguese (Brazil)
  en-us.ts   # English (United States)
```

### Namespace Organization

Translation keys are organized by feature namespace:

```typescript
// src/locales/pt-br.ts
export const projects = {
  member: {
    create: "Criar Membro",
    edit: "Editar Membro",
    save: "Salvar Alteracoes",
    errors: {
      nameRequired: "Nome e obrigatorio"
    }
  }
};

export const tasks = {
  status: {
    todo: "A Fazer",
    in_progress: "Em Andamento",
    done: "Concluido"
  }
};
```

### Using with UI Components

Combine `useI18n` with UI components for translated interfaces:

```typescript
export const ProjectAccessBadge: React.FC<ProjectAccessBadgeProps> = ({ projectId, ... }) => {
  const { t } = useI18n('projects');  // Use 'projects' namespace

  return (
    <Badge variant={variant}>
      {t('accessBadge.ownerLabel')}  // Translates based on current language
    </Badge>
  );
};
```

### Language Switching

Components can trigger language changes:

```typescript
const { changeLanguage, language } = useI18n();

// Switch to Portuguese
changeLanguage('pt-BR');

// Switch to English
changeLanguage('en-US');

// Current language
console.log(language);  // 'pt-BR'
```

## Best Practices Summary

| Practice | Implementation |
|----------|----------------|
| Base components | Use `src/components/ui/` for all Shadcn/ui components |
| Project components | Use `src/components/projects/` for domain features |
| Imports | Always use `@/` alias for src-relative paths |
| Project context | Use `useProjectSelection()` to access `selectedProject` |
| Translations | Use `useI18n('namespace')` for all UI text |
| Component structure | Types -> Hooks -> Handlers -> Render |
| Ref forwarding | Use `React.forwardRef` for components needing refs |
| Variant management | Use CVA (class-variance-authority) for variant props |

## Related Topics

- [Folder Structure](../02-folder-structure/structure.md)
- [Routing System](../15-routing-system/routes.md)
- [State Management Patterns](../07-state-management/state-patterns.md)
- [Project Context System](../06-project-context/context-system.md)