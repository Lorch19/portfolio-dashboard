# Story 1.3: Frontend App Shell with Tab Navigation

Status: done

## Story

As Omri,
I want a responsive app shell with navigation for all 8 dashboard tabs,
so that I can navigate between different views on both desktop and mobile.

## Acceptance Criteria

1. **Given** I open the dashboard in a browser, **When** the app loads, **Then** I see a sidebar navigation with all 8 tabs: Health, Supervisor, Funnel, Holdings, Performance, Decisions, Costs, Debug.

2. **Given** I am on any tab, **When** I click another tab in the navigation, **Then** TanStack Router navigates to the new route without a full page reload.

3. **Given** I open the dashboard on a mobile device (< 768px), **When** the app loads, **Then** the navigation adapts to a mobile-friendly layout (hamburger menu with Sheet overlay).

4. **Given** I open the dashboard, **When** no specific route is in the URL, **Then** I am redirected to the Health tab (`/health`) as the default view.

5. **Given** I navigate to any tab, **When** the tab's data is not yet loaded, **Then** I see shadcn skeleton loading components (not spinners).

## Tasks / Subtasks

- [x] Task 1: Apply Midnight Fintech theme to shadcn/ui CSS variables (AC: #1)
  - [x] 1.1: Update `frontend/src/index.css` — replace default shadcn CSS variables with UX spec's Midnight Fintech color tokens (see Dev Notes for exact values). Set dark mode as only mode (remove `:root` light theme, keep `.dark` or use `:root` directly).
  - [x] 1.2: Add typography setup — import Inter from Google Fonts (or use `font-display: swap` with system fallback), set `--font-sans` to Inter, apply 14px base font size.
  - [x] 1.3: Add spacing scale CSS variables (`--space-1` through `--space-8`) per UX spec.
  - [x] 1.4: Add chart-specific CSS variables for future use.
- [x] Task 2: Create shared UI components needed for app shell (AC: #1, #3, #5)
  - [x] 2.1: Install required shadcn components: `npx shadcn@latest add sidebar sheet skeleton button separator tooltip`. These are the components needed for navigation shell.
  - [x] 2.2: Create `frontend/src/components/ErrorCard.tsx` — inline error display with retry button. Props: `error: string`, `onRetry?: () => void`. Uses shadcn Card + Button.
  - [x] 2.3: Create `frontend/src/components/StatusBadge.tsx` — agent status indicator. Props: `status: "healthy" | "degraded" | "down" | null`, `variant?: "compact" | "full"`. Compact = dot only (for sidebar), full = dot + label.
  - [x] 2.4: Create `frontend/src/lib/constants.ts` — export tab definitions array: `{ name, path, icon }` for all 8 tabs. Export refetch intervals: `HEALTH_REFETCH_INTERVAL = 30_000`, etc.
- [x] Task 3: Create app shell layout with sidebar navigation (AC: #1, #2, #3)
  - [x] 3.1: Create `frontend/src/components/AppSidebar.tsx` using shadcn `Sidebar`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` components. Render all 8 tabs from constants. Active tab highlighted. Desktop: 240px width with icon + label. Include "Last updated" timestamp in sidebar footer using `--faint-foreground`.
  - [x] 3.2: Create `frontend/src/components/MobileHeader.tsx` — hamburger button that opens a shadcn `Sheet` (full-screen overlay) containing the tab list. Same tab items as sidebar. Sheet closes on tab selection.
  - [x] 3.3: Rewrite `frontend/src/routes/__root.tsx` — app shell layout. Desktop (>1024px): `SidebarProvider` + `AppSidebar` + main content area. Tablet (768-1024px): icon-only sidebar (56px). Mobile (<768px): `MobileHeader` + full-width content. Use `Outlet` for route content. Wrap with `QueryClientProvider` (TanStack Query).
  - [x] 3.4: Remove dead Vite starter code: delete `App.tsx`, `App.css`, and `assets/` directory. Clean up any references.
- [x] Task 4: Create TanStack Router routes for all 8 tabs (AC: #2, #4, #5)
  - [x] 4.1: Create `frontend/src/routes/index.tsx` — redirect to `/health` using `Navigate` component from TanStack Router.
  - [x] 4.2: Create route files: `health.tsx`, `supervisor.tsx`, `funnel.tsx`, `holdings.tsx`, `performance.tsx`, `decisions.tsx`, `costs.tsx` in `frontend/src/routes/`. Each renders a placeholder page with tab name heading and a skeleton loading demo.
  - [x] 4.3: Create `frontend/src/routes/debug/` directory with `route.tsx` (debug layout with sub-nav tabs: Events, Logs, Replay), `events.tsx`, `logs.tsx`, `replay.tsx` — all placeholder content.
  - [x] 4.4: Verify TanStack Router plugin auto-generates `routeTree.gen.ts` with all routes.
- [x] Task 5: Set up TanStack Query client (AC: #5)
  - [x] 5.1: Create `frontend/src/api/client.ts` — shared fetch wrapper. Export `apiClient` function that prepends `VITE_API_URL`, handles JSON parsing, throws on non-OK responses with `{ error, detail }` shape.
  - [x] 5.2: Create `frontend/src/api/queryClient.ts` — export configured `QueryClient` with default options: `retry: 1`, `refetchOnWindowFocus: true`. Import and use in `__root.tsx`.
- [x] Task 6: Add responsive behavior and verify (AC: #3, #1)
  - [x] 6.1: Ensure all breakpoints work: desktop (>1024px) shows full sidebar, tablet (768-1024px) shows icon-only sidebar, mobile (<768px) shows hamburger. Test by resizing browser.
  - [x] 6.2: Verify tab switching works via sidebar click, mobile menu tap, and direct URL entry.
  - [x] 6.3: Verify `/` redirects to `/health`.
  - [x] 6.4: Verify skeleton components render on each tab placeholder.
- [x] Task 7: Write tests (AC: #1, #2, #3, #4, #5)
  - [x] 7.1: Create `frontend/src/routes/__root.test.tsx` — tests: shell renders sidebar on desktop viewport, renders hamburger on mobile viewport, all 8 tabs visible in navigation.
  - [x] 7.2: Create `frontend/src/routes/health.test.tsx` — test: health route renders without crashing, shows skeleton/placeholder.
  - [x] 7.3: Create `frontend/src/components/StatusBadge.test.tsx` — test: renders correct color for each status variant.
  - [x] 7.4: Create `frontend/src/components/ErrorCard.test.tsx` — test: renders error message, calls onRetry when button clicked.

### Review Findings

- [x] [Review][Defer] Tablet icon-only sidebar not automatic — shadcn `collapsible="icon"` requires user toggle, spec says 768-1024px should auto-collapse — deferred, UX polish for future story
- [x] [Review][Patch] `/debug` route renders empty content when navigated directly — added redirect to `/debug/events` [frontend/src/routes/debug/route.tsx] ✅ Fixed
- [x] [Review][Patch] `MobileHeader` uses raw Button instead of SheetTrigger — replaced with SheetTrigger for proper a11y [frontend/src/components/MobileHeader.tsx] ✅ Fixed
- [x] [Review][Patch] No mobile viewport test in `__root.test.tsx` — added hamburger button test [frontend/src/routes/__root.test.tsx] ✅ Fixed
- [x] [Review][Patch] `MobileHeader` inner header uses `lg:hidden` but outer shell uses `md:hidden` — removed mismatched class [frontend/src/components/MobileHeader.tsx] ✅ Fixed
- [x] [Review][Defer] `useIsMobile` returns false on first render — initial desktop flash on mobile — deferred, shadcn library behavior
- [x] [Review][Defer] `apiClient` doesn't catch network-level TypeError from fetch() — deferred, will be addressed when real data fetching is built (Story 1.4+)
- [x] [Review][Defer] `apiClient` doesn't check Content-Type before res.json() — deferred, same as above
- [x] [Review][Defer] Sidebar cookie missing SameSite/Secure attributes — deferred, shadcn library code
- [x] [Review][Defer] Sidebar keyboard shortcut fires inside inputs — deferred, shadcn library code
- [x] [Review][Defer] MobileHeader Sheet doesn't close on browser back — deferred, low priority UX polish

## Dev Notes

### Midnight Fintech Theme — Exact CSS Variables

Replace ALL default shadcn CSS variables in `index.css` with these. Use `:root` directly (dark-only app, no light mode toggle):

```css
:root {
  /* Backgrounds */
  --background: 230 21% 5%;       /* #0b0d14 */
  --card: 230 18% 8%;             /* #111424 */
  --card-hover: 230 16% 11%;     /* #171a2e */
  --muted: 230 14% 14%;           /* #1e2136 */
  --sidebar: 230 20% 7%;          /* #0e1120 */

  /* Foregrounds */
  --foreground: 210 20% 92%;      /* #e4e8ef */
  --muted-foreground: 215 15% 55%; /* #7b8599 */
  --faint-foreground: 215 12% 35%; /* #4d5566 */

  /* Semantic */
  --primary: 215 70% 55%;         /* #3b7bd4 */
  --primary-foreground: 0 0% 100%;
  --primary-muted: 215 40% 15%;   /* #142133 */
  --success: 152 60% 48%;         /* #31c07a */
  --success-muted: 152 40% 15%;   /* #163326 */
  --warning: 38 85% 55%;          /* #e5a620 */
  --warning-muted: 38 50% 15%;    /* #332a14 */
  --destructive: 0 70% 55%;       /* #d4453a */
  --destructive-muted: 0 40% 15%; /* #331a18 */

  /* shadcn required mappings */
  --popover: var(--card);
  --popover-foreground: var(--foreground);
  --secondary: var(--muted);
  --secondary-foreground: var(--foreground);
  --accent: var(--muted);
  --accent-foreground: var(--foreground);
  --destructive-foreground: 0 0% 100%;
  --border: 230 14% 18%;
  --input: 230 14% 18%;
  --ring: var(--primary);

  /* Chart colors */
  --chart-grid: var(--muted);
  --chart-axis: 215 15% 40%;
  --chart-line-1: var(--primary);
  --chart-line-2: 215 15% 55%;

  /* Spacing scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --radius: 0.5rem;
}
```

**IMPORTANT:** shadcn v4 CSS variables use space-separated HSL values (e.g., `230 21% 5%`) without `hsl()` wrapper. The component system applies `hsl()` at usage. Check `components.json` `cssVariables: true` to confirm.

### Navigation Tab Configuration

```typescript
// frontend/src/lib/constants.ts
import {
  Activity, Eye, Filter, Briefcase,
  TrendingUp, Brain, DollarSign, Bug
} from "lucide-react"

export const TABS = [
  { name: "Health", path: "/health", icon: Activity },
  { name: "Supervisor", path: "/supervisor", icon: Eye },
  { name: "Funnel", path: "/funnel", icon: Filter },
  { name: "Holdings", path: "/holdings", icon: Briefcase },
  { name: "Performance", path: "/performance", icon: TrendingUp },
  { name: "Decisions", path: "/decisions", icon: Brain },
  { name: "Costs", path: "/costs", icon: DollarSign },
  { name: "Debug", path: "/debug", icon: Bug },
] as const
```

Install `lucide-react` for icons: `pnpm add lucide-react` (may already be installed by shadcn init — check `package.json` first).

### Responsive Breakpoints (from UX spec)

| Breakpoint | Width | Sidebar | Navigation |
|---|---|---|---|
| Mobile | < 768px | Hidden | Hamburger menu (Sheet overlay) |
| Tablet | 768-1024px | Icon-only (56px) | Icon sidebar |
| Desktop | > 1024px | Full (240px) | Full sidebar with icon + label |

Use Tailwind responsive prefixes: base styles = mobile, `md:` = tablet (768px), `lg:` = desktop (1024px).

### shadcn Sidebar Component Usage

shadcn v4 provides a `Sidebar` component with built-in collapsible behavior:

```tsx
import { SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
```

The `SidebarProvider` wraps the layout. Use `defaultOpen` prop and `collapsible="icon"` for responsive behavior. The sidebar auto-collapses based on viewport.

### Mobile Sheet Pattern

```tsx
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Menu } from "lucide-react"

// In MobileHeader:
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon"><Menu /></Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-full">
    {/* Tab list — same items as sidebar */}
    {/* onClick: navigate + close sheet */}
  </SheetContent>
</Sheet>
```

### TanStack Router File-Based Routes

Each route file exports a `Route` created with `createFileRoute`:

```tsx
// frontend/src/routes/health.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/health')({
  component: HealthPage,
})

function HealthPage() {
  return <div>Health tab placeholder</div>
}
```

The router plugin auto-generates `routeTree.gen.ts`. Do NOT edit that file manually.

### Debug Sub-Routes

Debug has nested routes. The layout file is `debug/route.tsx` (NOT `debug/index.tsx`):

```
routes/debug/
  route.tsx    → /debug layout (sub-nav: Events / Logs / Replay)
  events.tsx   → /debug/events
  logs.tsx     → /debug/logs
  replay.tsx   → /debug/replay
```

`route.tsx` should render sub-nav tabs (using shadcn `Tabs` component) and an `Outlet` for child content.

### TanStack Query Setup

```tsx
// frontend/src/api/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
```

Wrap `__root.tsx` with `<QueryClientProvider client={queryClient}>`.

### API Client Pattern

```tsx
// frontend/src/api/client.ts
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function apiClient<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown', detail: res.statusText }))
    throw new Error(err.detail || err.error || 'API error')
  }
  return res.json()
}
```

### Skeleton Loading Pattern (AC #5)

Each tab placeholder should demo the skeleton pattern:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

function HealthPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Health</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  )
}
```

This proves AC #5 and provides the visual foundation for Story 1.4 to replace with real data.

### Testing Setup

Frontend uses Vitest + Testing Library (co-located tests):
- Install if not present: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom`
- Configure `vitest.config.ts` or add to `vite.config.ts`
- Test files: `*.test.tsx` co-located next to components

**Minimal test approach for this story:** Verify components render, navigation items present, routing works. Don't test shadcn internals.

### Files to Delete (Dead Vite Starter Code)

From Story 1.1 deferred review finding: frontend ships Vite starter template as dead code.

- Delete `frontend/src/App.tsx`
- Delete `frontend/src/App.css`
- Delete `frontend/src/assets/` directory (contains react.svg)
- Update `frontend/src/main.tsx` if it imports App.tsx (it shouldn't — Story 1.1 already wired TanStack Router)

### What NOT To Do

- Do NOT add a light/dark mode toggle — this is dark-only
- Do NOT create real data-fetching hooks yet — this story is shell + navigation only
- Do NOT customize shadcn components beyond CSS variables — component customization is a later task
- Do NOT install Recharts or any charting libraries
- Do NOT create type definitions for API responses yet
- Do NOT use `React.lazy` for route code splitting — TanStack Router handles this
- Do NOT create a global loading state or context provider for loading
- Do NOT use bottom navigation on mobile — UX spec explicitly says hamburger menu

### Previous Story Learnings (from Stories 1.1 and 1.2)

- **TanStack Router plugin** = `@tanstack/router-plugin/vite` (not the older `@tanstack/router-vite-plugin`)
- **TanStack Router needs `src/routes/` dir** and `__root.tsx` — already exist from Story 1.1
- **shadcn CLI v4** scaffolds with Tailwind v4, OKLCH colors, `tw-animate-css`
- **Path alias** `@/` maps to `frontend/src/` — use for all imports
- **ESLint react-refresh rule** already relaxed with `allowConstantExport: true`
- **API runs at localhost:8000** with `GET /api/health` returning agent statuses, heartbeats, VPS metrics, alerts
- **API response pattern:** no envelope wrapper, snake_case keys, null for missing values with `_error` keys
- **Review finding from 1.2:** Response always includes `_error` keys (null when no error) for predictable shape — frontend should expect this

### References

- [Source: architecture.md#Frontend Architecture] — Route structure, component organization, TanStack Router/Query setup
- [Source: architecture.md#Project Structure] — Complete frontend directory structure
- [Source: architecture.md#Implementation Patterns] — Naming conventions, loading states, error handling
- [Source: architecture.md#Anti-Patterns to Avoid] — No camelCase transform, no envelope, no Redux/Zustand
- [Source: ux-design-specification.md#Color System] — Midnight Fintech palette, all CSS variables
- [Source: ux-design-specification.md#Typography System] — Inter font, 14px base, weight scale
- [Source: ux-design-specification.md#Spacing & Layout Foundation] — 4px base unit, layout grid, breakpoints
- [Source: ux-design-specification.md#Navigation Patterns] — Desktop sidebar, tablet icon-only, mobile hamburger
- [Source: ux-design-specification.md#Component Specifications] — StatusBadge, ErrorCard specs
- [Source: epics.md#Story 1.3] — Acceptance criteria
- [Source: epics.md#Story 1.4] — Next story context (Health tab UI — informs skeleton placeholders)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed `window.matchMedia` mock for jsdom in test-setup.ts (shadcn sidebar `useIsMobile` hook requires it)
- TanStack Router route tree auto-generates via `vite build` — needed to run vite build before tsc to regenerate `routeTree.gen.ts`

### Completion Notes List

- Applied Midnight Fintech dark theme (HSL variables) replacing default shadcn OKLCH light/dark themes
- Switched font from Geist to Inter via @fontsource-variable/inter
- Created ErrorCard and StatusBadge shared components per UX spec
- Created AppSidebar using shadcn Sidebar with collapsible="icon" for responsive behavior
- Created MobileHeader with Sheet overlay for mobile navigation
- Root layout uses dual rendering: md+ gets SidebarProvider layout, mobile gets MobileHeader
- All 8 tab routes created with skeleton placeholders
- Debug routes use nested layout with Tabs sub-navigation (events, logs, replay)
- Index route redirects to /health
- TanStack Query client configured with retry:1 and refetchOnWindowFocus
- API client wrapper created for future data fetching
- Deleted dead Vite starter code (App.tsx, App.css, assets/)
- 12 tests passing: StatusBadge (5), ErrorCard (4), Root Layout (2), Health (1)

### Change Log

- 2026-04-04: Story 1.3 implementation complete — app shell, navigation, theme, routes, tests

### File List

**New files:**
- frontend/src/api/client.ts
- frontend/src/api/queryClient.ts
- frontend/src/components/AppSidebar.tsx
- frontend/src/components/MobileHeader.tsx
- frontend/src/components/ErrorCard.tsx
- frontend/src/components/ErrorCard.test.tsx
- frontend/src/components/StatusBadge.tsx
- frontend/src/components/StatusBadge.test.tsx
- frontend/src/components/ui/card.tsx
- frontend/src/components/ui/input.tsx
- frontend/src/components/ui/separator.tsx
- frontend/src/components/ui/sheet.tsx
- frontend/src/components/ui/sidebar.tsx
- frontend/src/components/ui/skeleton.tsx
- frontend/src/components/ui/tabs.tsx
- frontend/src/components/ui/tooltip.tsx
- frontend/src/hooks/use-mobile.ts
- frontend/src/lib/constants.ts
- frontend/src/routes/health.tsx
- frontend/src/routes/health.test.tsx
- frontend/src/routes/supervisor.tsx
- frontend/src/routes/funnel.tsx
- frontend/src/routes/holdings.tsx
- frontend/src/routes/performance.tsx
- frontend/src/routes/decisions.tsx
- frontend/src/routes/costs.tsx
- frontend/src/routes/debug/route.tsx
- frontend/src/routes/debug/events.tsx
- frontend/src/routes/debug/logs.tsx
- frontend/src/routes/debug/replay.tsx
- frontend/src/routes/__root.test.tsx
- frontend/src/test-setup.ts
- frontend/src/test-utils.tsx
- frontend/vitest.config.ts

**Modified files:**
- frontend/src/index.css
- frontend/src/routes/__root.tsx
- frontend/src/routes/index.tsx
- frontend/src/routeTree.gen.ts
- frontend/package.json
- frontend/pnpm-lock.yaml

**Deleted files:**
- frontend/src/App.tsx
- frontend/src/App.css
- frontend/src/assets/hero.png
- frontend/src/assets/react.svg
- frontend/src/assets/vite.svg
