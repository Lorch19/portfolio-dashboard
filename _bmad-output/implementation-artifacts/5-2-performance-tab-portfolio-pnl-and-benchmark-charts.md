# Story 5.2: Performance Tab — Portfolio P&L and Benchmark Charts

Status: done

## Story

As Omri,
I want to see portfolio P&L over time compared to SPY, with CAGR and alpha metrics,
So that I (and potential investors) can evaluate system performance credibly.

## Acceptance Criteria

1. **AC1 — P&L chart:** A Recharts area/line chart shows portfolio value over time vs SPY benchmark, using shadcn/ui chart components. Portfolio line is solid blue (`--primary`), SPY line is dashed gray-blue (`hsl(215, 15%, 55%)`). Area fill at 10% opacity. Gridlines dashed at 1px (`--chart-grid`).

2. **AC2 — Chart tooltip:** Hovering over data points shows a tooltip with date, portfolio value, SPY value, and daily alpha. Mobile: tap-and-hold triggers tooltip, release dismisses.

3. **AC3 — KPI summary cards:** KPI cards display: total P&L ($ and %), CAGR, SPY return, alpha, win rate, total trades. Positive values use `--success` + up arrow, negative use `--destructive` + down arrow. Hero values are `text-2xl font-bold`, labels are `text-sm text-muted-foreground font-medium`.

4. **AC4 — Responsive layout:** Desktop (1024px+): KPI row above, charts side-by-side (P&L left, calibration placeholder right). Mobile (<768px): KPI cards stack vertically, charts full-width stacked. Min chart height: 240px desktop, 180px mobile. No horizontal scrolling.

5. **AC5 — Loading/error/empty states:** Loading shows skeleton rectangles matching chart dimensions. Error shows inline ErrorCard with retry. Empty shows centered "No performance data available" with contextual icon. Per-section error handling using `_error` fields from API.

## Tasks / Subtasks

- [x] Task 1: Install Recharts and add shadcn/ui chart components (AC: 1)
  - [x] 1.1 Run `pnpm add recharts` in frontend/ — already installed (recharts ^3.8.1)
  - [x] 1.2 Add shadcn chart component — already installed (chart.tsx with ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig)
  - [x] 1.3 Verify Recharts + shadcn chart components work together — verified via test render

- [x] Task 2: Create TypeScript types for performance API response (AC: 1,3)
  - [x] 2.1 Create `frontend/src/types/performance.ts` matching the API response schema from Story 5.1

- [x] Task 3: Create usePerformance hook (AC: 1,3,5)
  - [x] 3.1 Create `frontend/src/api/usePerformance.ts` following existing hook pattern
  - [x] 3.2 Use `staleTime: 3_600_000` (60min) per architecture caching strategy
  - [x] 3.3 Add `PERFORMANCE_STALE_TIME` constant to `frontend/src/lib/constants.ts`

- [x] Task 4: Build KPI card row (AC: 3,4)
  - [x] 4.1 Create KPI display section within performance.tsx (PerformanceKpiCards component)
  - [x] 4.2 Implement 6 KPI cards: Total P&L ($ + %), CAGR, SPY Return, Alpha, Win Rate, Total Trades
  - [x] 4.3 Color-code positive/negative values with trend arrows (ArrowUp/ArrowDown/Minus from lucide-react)
  - [x] 4.4 Add `aria-label` on each card (e.g., "Total P&L: $12,500.50")
  - [x] 4.5 Responsive grid: 3 cols desktop (lg:grid-cols-3), 2 cols tablet (sm:grid-cols-2), 1 col mobile

- [x] Task 5: Build ChartCard wrapper component (AC: 1,4,5)
  - [x] 5.1 Create `frontend/src/components/ChartCard.tsx` — wraps chart with title, loading skeleton, error, empty states
  - [x] 5.2 Props: title, subtitle?, children, isLoading, error?, isEmpty?, onRetry?
  - [x] 5.3 Use Card from shadcn/ui, skeleton for loading, ErrorCard for errors

- [x] Task 6: Build P&L line chart (AC: 1,2,4)
  - [x] 6.1 Create chart inside ChartCard using Recharts ComposedChart + shadcn ChartContainer
  - [x] 6.2 Two data lines: portfolio (solid, hsl(215, 70%, 55%)) and SPY (dashed, hsl(215, 15%, 55%))
  - [x] 6.3 Area fill at 10% opacity under each line via linearGradient defs
  - [x] 6.4 Custom tooltip via shadcn ChartTooltip showing date, portfolio value, SPY value
  - [x] 6.5 X-axis: dates (formatted short). Y-axis: dollar values (formatted with $Xk)
  - [x] 6.6 Responsive: ChartContainer with min-h-[240px] desktop / min-h-[180px] mobile

- [x] Task 7: Wire up the full Performance page (AC: 1-5)
  - [x] 7.1 Replace skeleton placeholder in `frontend/src/routes/performance.tsx`
  - [x] 7.2 Integrate usePerformance hook with loading/error/data flow
  - [x] 7.3 Layout: KPI row → charts grid (P&L chart + placeholder for calibration in Story 5.3)
  - [x] 7.4 Handle per-section errors (portfolio_summary_error, snapshots_error)
  - [x] 7.5 Add empty state when no snapshot data exists (TrendingUp icon + message)

- [x] Task 8: Tests (AC: 1-5)
  - [x] 8.1 Test usePerformance hook returns correct query config (verified via integration)
  - [x] 8.2 Test PerformancePage renders KPI cards with correct values
  - [x] 8.3 Test loading state shows skeletons (ChartCard loading test)
  - [x] 8.4 Test error state shows ErrorCard with retry
  - [x] 8.5 Test partial error (e.g., snapshots_error set) shows inline error for that section

### Review Findings

- [x] [Review][Decision] Y-axis scale mismatch: resolved by normalizing to cumulative % returns — both lines start at 0% and are directly comparable
- [x] [Review][Patch] AC2: Daily alpha added to tooltip — computed as portfolio_pct - spy_pct at each data point
- [x] [Review][Patch] spy_value null handling — connectNulls added to SPY Line/Area; null spy_value produces null spy_pct (skipped gracefully)
- [x] [Review][Patch] snapshots_error partial error test added — verifies KPIs still render while chart shows inline error
- [x] [Review][Defer] Exception messages leaked to client via _error fields — pre-existing pattern across all endpoints
- [x] [Review][Defer] No pagination/LIMIT on get_portfolio_snapshots query — pre-existing architectural choice (no pagination on any endpoint)
- [x] [Review][Defer] Win Rate KPI always shows dash — deferred to Story 5.3 (prediction accuracy data not in portfolio_summary)

## Dev Notes

### Critical: Recharts Not Yet Installed

The architecture specifies "Recharts via shadcn/ui chart components" but **neither `recharts` nor shadcn chart components are currently installed**. The existing FunnelChart is a custom div-based component, NOT Recharts. This story introduces the first Recharts usage in the project.

**Install steps:**
```bash
cd frontend
pnpm add recharts
npx shadcn@latest add chart
```

The shadcn chart component provides `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, and `ChartConfig` — these wrap Recharts with consistent theming.

### API Response Shape (from Story 5.1)

The `GET /api/performance` endpoint returns:
```json
{
  "portfolio_summary": {
    "total_pnl": 1250.50,
    "total_pnl_pct": 12.5,
    "cagr": 14.2,
    "spy_return": 8.5,
    "alpha": 5.7,
    "start_date": "2026-01-15",
    "end_date": "2026-04-04",
    "total_trades": 42
  },
  "portfolio_summary_error": null,
  "prediction_accuracy": { ... },
  "prediction_accuracy_error": null,
  "calibration": { ... },
  "calibration_error": null,
  "arena_comparison": [ ... ],
  "arena_comparison_error": null,
  "message": null
}
```

**Important:** The current API does NOT return time-series snapshot data (array of `{date, portfolio_value, spy_value}`). The `portfolio_summary` only has aggregated metrics. The P&L chart needs time-series data. Options:
1. **Add a new query function** to `portfolio.py` that returns `sim_portfolio_snapshots` rows (date, portfolio_value, spy_value) — requires API modification
2. **Add it to the existing endpoint** as a `snapshots` array field

This is a **critical gap** — the chart cannot render without time-series data. The developer MUST add a snapshots array to the API response before building the chart.

**Database source:** `sim_portfolio_snapshots` table in portfolio.db has columns: `snapshot_date`, `portfolio_value`, `spy_value`, filtered by `ticker = '_PORTFOLIO'`.

### Existing Code Patterns to Follow

**Hook pattern** (from `useHealth.ts`):
```typescript
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { PerformanceResponse } from "@/types/performance"
import { PERFORMANCE_STALE_TIME } from "@/lib/constants"

export function usePerformance() {
  return useQuery({
    queryKey: ["performance"],
    queryFn: () => apiClient<PerformanceResponse>("/api/performance"),
    staleTime: PERFORMANCE_STALE_TIME,
  })
}
```

**Page pattern** (from `holdings.tsx`):
- `createFileRoute("/performance")` with `component: PerformancePage`
- Destructure `{ data, isLoading, isError, error, refetch }` from hook
- Loading → return skeleton. Error → return ErrorCard. Data → render content.
- Use `aria-live="polite"` on main container
- Handle per-section `_error` fields from API response (same pattern as holdings)

**Component naming:** PascalCase files and exports. Co-locate tests next to components.

### Chart Styling Tokens (from UX spec)

| Token | Value | Usage |
|-------|-------|-------|
| `--chart-line-1` | `var(--primary)` / `hsl(215, 70%, 55%)` | Portfolio line (solid) |
| `--chart-line-2` | `hsl(215, 15%, 55%)` | SPY benchmark line (dashed) |
| `--chart-grid` | `hsl(230, 14%, 14%)` | Gridlines (1px dashed) |
| `--chart-axis` | `hsl(215, 15%, 40%)` | Axis label text |
| Area fill | Line color at 10% opacity | Under each line |
| Tooltip bg | `--card` / `hsl(230, 18%, 8%)` | Tooltip background |
| Line stroke | 2px | Both data lines |

### KPI Card Styling (from UX spec)

- **Label:** `text-sm text-muted-foreground font-medium`
- **Hero value:** `text-2xl font-bold` in `--foreground` (positive: `text-success`, negative: `text-destructive`)
- **Trend arrow:** ArrowUp (green) / ArrowDown (red) / Minus (gray) from lucide-react, positioned right of value
- **Subtext:** `text-xs text-faint-foreground` (optional comparison text)

### Responsive Breakpoints

- Desktop (1024px+): KPI row above, charts in `grid-cols-2`
- Tablet (768-1024px): KPI in 2-col grid, charts may stack
- Mobile (<768px): Everything stacks vertically, charts full-width

### What NOT To Do

- **Don't** use a charting library other than Recharts — architecture mandates it
- **Don't** create a camelCase transform layer — access API data as `snake_case`
- **Don't** use global state (Redux/Zustand) — TanStack Query handles server state
- **Don't** use loading spinners — use shadcn Skeleton components
- **Don't** wrap API response in an envelope — it comes flat from the API
- **Don't** create `formatCurrency` etc. as separate utility files if they're simple — inline or add to existing `formatters.ts` if it exists
- **Don't** build prediction accuracy, calibration, or arena sections — those are Story 5.3
- **Don't** add drag/zoom to charts — not in MVP scope

### Previous Story Intelligence (Story 5.1)

**Patterns established:**
- Performance router uses dual-DB independent error handling (portfolio.db + supervisor.db)
- Per-section `_error` fields enable partial degradation (frontend shows what it can)
- `ticker = '_PORTFOLIO'` filter on `sim_portfolio_snapshots`
- CAGR formula: `(end/start)^(365/days) - 1` as percentage, returns null if < 7 days
- All 121 API tests pass — no regressions allowed

**Files from 5.1 that may need modification:**
- `api/src/db/portfolio.py` — add `get_portfolio_snapshots()` for time-series data
- `api/src/routers/performance.py` — add snapshots to response
- `api/tests/conftest.py` — may need additional sample snapshot rows for chart data
- `api/tests/test_performance.py` — test the new snapshots field

### Project Structure Notes

Files to create:
- `frontend/src/types/performance.ts` — TypeScript types
- `frontend/src/api/usePerformance.ts` — TanStack Query hook
- `frontend/src/components/ChartCard.tsx` — Reusable chart wrapper

Files to modify:
- `frontend/src/routes/performance.tsx` — Replace skeleton with full implementation
- `frontend/src/lib/constants.ts` — Add PERFORMANCE_STALE_TIME
- `api/src/db/portfolio.py` — Add snapshot time-series query
- `api/src/routers/performance.py` — Add snapshots array to response
- `api/tests/test_performance.py` — Test snapshots field
- `api/tests/conftest.py` — Sample time-series data if needed

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5, Story 5.2]
- [Source: _bmad-output/planning-artifacts/architecture.md — Frontend Stack, Component Structure, Charting, Caching Strategy, API Patterns, Anti-Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Performance Tab, ChartCard, KPI Card, Chart Styling, Responsive Layout]
- [Source: _bmad-output/implementation-artifacts/5-1-performance-api-endpoint.md — API response shape, DB tables, established patterns]
- [Source: frontend/src/routes/holdings.tsx — Page component pattern]
- [Source: frontend/src/api/useHealth.ts — Hook pattern]
- [Source: frontend/src/components/ErrorCard.tsx — Error display pattern]
- [Source: frontend/src/components/FunnelChart.tsx — Custom chart (NOT Recharts)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Installed recharts 3.8.1 and created shadcn/ui chart component (ChartContainer, ChartTooltip, ChartTooltipContent, ChartConfig)
- Added `get_portfolio_snapshots()` to portfolio.py for time-series chart data (critical gap from Story 5.1)
- Wired snapshots into performance router with independent error handling + snapshots_error field
- Created PerformanceResponse, PortfolioSummary, Snapshot, and related types matching full API schema
- Created usePerformance hook with 60-min staleTime per architecture caching strategy
- Built ChartCard reusable wrapper with loading/error/empty states
- Built P&L vs SPY ComposedChart with area fills, dashed SPY line, custom tooltips, responsive sizing
- Built 6 KPI cards with color-coded values, trend arrows, and responsive 3/2/1 column grid
- Wired full PerformancePage with per-section error handling, empty state, calibration placeholder
- Win Rate KPI shows "—" as prediction accuracy data is not yet in portfolio_summary (Story 5.3 scope)
- 4 new API tests for snapshots (query-level + endpoint-level) — 125 API tests pass
- 6 new frontend tests for PerformancePage — zero regressions

### Change Log

- 2026-04-07: Story 5.2 implementation complete — Performance tab with KPI cards, P&L vs SPY chart, ChartCard wrapper

### File List

New files:
- frontend/src/types/performance.ts
- frontend/src/api/usePerformance.ts
- frontend/src/components/ChartCard.tsx
- frontend/src/components/ui/chart.tsx
- frontend/src/routes/performance.test.tsx

Modified files:
- frontend/src/routes/performance.tsx (replaced skeleton with full implementation)
- frontend/src/lib/constants.ts (added PERFORMANCE_STALE_TIME)
- frontend/package.json (added recharts dependency)
- api/src/db/portfolio.py (added get_portfolio_snapshots)
- api/src/routers/performance.py (added snapshots to response)
- api/tests/test_performance.py (added snapshot tests)
