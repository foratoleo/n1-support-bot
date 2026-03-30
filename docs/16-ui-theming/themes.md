---
name: ui-theming
description: Four-area color theming system with CSS data-area attribute
area: 16
maintained_by: theming-specialist
created: 2026-03-30
updated: 2026-03-30
---

# UI Theming

## Overview

The application implements a four-area color theme system that applies distinct visual identities to different functional domains. Each area (planning, development, testing, governance) has its own primary color, accent color, and background tint that propagate to all child components through CSS custom properties.

The theming system uses the `[data-area]` HTML attribute selector, which must be set on a container element to activate area-specific styles for all nested content.

## Color Palettes

### Planning Area

Dark Gold theme for product planning and roadmapping workflows.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#B8860B` | Headers, borders, active states |
| `--phase-accent` | `#DAA520` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(255, 249, 230, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #B8860B  [========]  Dark Gold
Accent    #DAA520  [========]  Goldenrod
Background rgba(255, 249, 230, 0.4)
```

### Development Area

Gray/Silver theme for code and technical implementation work.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#9E9E9E` | Headers, borders, active states |
| `--phase-accent` | `#C0C0C0` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(245, 245, 245, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #9E9E9E  [========]  Gray
Accent    #C0C0C0  [========]  Silver
Background rgba(245, 245, 245, 0.4)
```

### Testing/Quality Area

Bronze theme for QA, bug tracking, and quality assurance processes.

This area responds to two attribute values: `data-area="testing"` and `data-area="quality"`. Both values apply the same color palette.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#CD7F32` | Headers, borders, active states |
| `--phase-accent` | `#D4A574` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(255, 245, 235, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #CD7F32  [========]  Bronze
Accent    #D4A574  [========]  Light Bronze
Background rgba(255, 245, 235, 0.4)
```

### Governance Area

Dark Green theme for configuration, access control, and administrative settings.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#1B4332` | Headers, borders, active states |
| `--phase-accent` | `#2D6A4F` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(240, 247, 244, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #1B4332  [========]  Dark Green
Accent    #2D6A4F  [========]  Green
Background rgba(240, 247, 244, 0.4)
```

## Applying the Theme

### Container-Level Application

Set the `data-area` attribute on a top-level container element. All child elements inherit the theme automatically through CSS inheritance of custom properties.

```html
<!-- Planning area -->
<div data-area="planning">
  <FeatureCard />
  <SprintBoard />
</div>

<!-- Development area -->
<div data-area="development">
  <CodeEditor />
  <PRMetrics />
</div>

<!-- Testing/Quality area -->
<div data-area="testing">
  <BugList />
  <TestResults />
</div>
```

### JSX/TSX Example

```tsx
export function UserManagementPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl" data-area="governance">
      <PageHeader />
      <AccessControlTable />
    </div>
  );
}
```

### Valid Attribute Values

| Value | Theme Applied | Use Cases |
|-------|---------------|-----------|
| `planning` | Dark Gold | Features, PRDs, roadmaps, user stories |
| `development` | Gray/Silver | Code review, style guides, AI agent configs |
| `testing` | Bronze | Bug tracking, test cases, quality metrics |
| `quality` | Bronze | Alias for testing, quality reports |
| `governance` | Dark Green | User management, system configuration, access control |

## CSS Variable Usage

Components reference the three phase variables to apply area-specific styling:

```css
/* Using CSS custom properties */
.phase-header {
  background-color: var(--phase-bg);
  border-left: 4px solid var(--phase-primary);
  color: var(--phase-primary);
}

.phase-badge {
  background-color: var(--phase-accent);
  color: white;
}

.phase-card {
  border: 1px solid var(--phase-primary);
  box-shadow: 0 2px 4px var(--phase-bg);
}
```

```tsx
// Tailwind with CSS variable interpolation
<div
  className="rounded-lg border p-4"
  style={{
    borderColor: 'var(--phase-primary)',
    backgroundColor: 'var(--phase-bg)',
  }}
>
  Content
</div>

// Tailwind arbitrary value syntax
<div className="bg-[var(--phase-bg)] border-[var(--phase-primary)]">
  Content
</div>
```

## Tailwind Custom Theme Configuration

The Tailwind configuration does not need modification to use area themes. The CSS variables are defined globally and referenced at runtime on container elements.

### Recommended Tailwind Extensions

Add to your Tailwind config to enable type-safe access to phase variables:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'phase-primary': 'var(--phase-primary)',
        'phase-accent': 'var(--phase-accent)',
        'phase-bg': 'var(--phase-bg)',
      },
    },
  },
};
```

After extending the theme, use in components:

```tsx
<div className="bg-phase-bg border-phase-primary text-phase-primary">
  Area-themed content
</div>
```

## Default Fallback Values

The `:root` selector defines default phase values when no `data-area` attribute is present:

```css
:root {
  --phase-primary: #B8860B;   /* Planning as default */
  --phase-accent: #DAA520;
  --phase-bg: #FFF9E6;        /* Solid fallback, not rgba */
}
```

Pages without a `data-area` attribute inherit the Planning theme defaults.

## Dark Mode Support

The area theming system is designed to work alongside dark mode. Phase variables are redefined within the `.dark` class scope, but the application currently maintains consistent phase colors across both light and dark modes.

```css
.dark [data-area="governance"] {
  /* Dark mode adjustments can be added here */
  --phase-bg: rgba(27, 67, 50, 0.3);
}
```

## Best Practices

### Do

- Set `data-area` on the page-level container, not individual components
- Use the exact attribute values: `planning`, `development`, `testing`, `quality`, `governance`
- Apply the attribute at the route level so all child pages inherit the theme
- Use CSS variables for all area-themed styles to maintain consistency

### Do Not

- Use custom area names not listed in the valid values table
- Override phase variables inline when the area attribute should handle it
- Set conflicting `data-area` values on nested containers
- Mix area color values with hardcoded hex colors in themed components

## Troubleshooting

### Theme not applying

1. Verify the `data-area` attribute is set on the container element
2. Check that the attribute value matches exactly: lowercase, no spaces
3. Ensure the CSS defining `[data-area="X"]` selectors is loaded
4. Confirm the element is not wrapped in a component that strips attributes

### Inconsistent colors across pages

1. Each page route should set its own `data-area` attribute
2. Check for missing `data-area` on new page components
3. Verify parent layout components do not override child attributes

### CSS variable shows invalid value

1. Open browser DevTools and inspect the computed style of the container
2. Check that `:root` defaults are loaded before area overrides
3. Ensure `@layer base` scope is not preventing variable cascade

## Related Documentation

- [Component Organization](../14-component-organization/components.md) - How components use area context
- [Tasks](../21-tasks/tasks.md) - Tasks include area assignment
- [Routes](../15-routing-system/routes.md) - Area-to-route mapping
- [AreaContext](../06-project-context/context-system.md) - React context for area state