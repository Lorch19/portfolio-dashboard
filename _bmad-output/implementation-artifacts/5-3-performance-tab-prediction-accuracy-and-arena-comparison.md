# Story 5.3: Performance Tab — Prediction Accuracy and Arena Comparison

Status: done

## Story

As Omri,
I want to see prediction accuracy metrics, calibration scores, and arena model comparison on the Performance tab,
So that I can evaluate whether Michael's predictions are improving and how models compare.

## Acceptance Criteria

1. **AC1 — Prediction accuracy display:** Given I am on the Performance tab, when prediction data loads, then I see prediction accuracy broken down by eval window (T+5, T+10, T+20) with hit rates and average returns. Display as KPI-style cards or a compact summary section.

2. **AC2 — Calibration metrics and chart:** Given I am viewing prediction accuracy, when calibration data is available, then I see CalibrationEngine metrics: Brier score vs target (0.25), calibration buckets chart (Recharts BarChart), agreement rate, and sycophancy flag indicator. The calibration chart replaces the "Coming in Story 5.3" placeholder in the existing `lg:grid-cols-2` chart grid.

3. **AC3 — Arena comparison table:** Given I am on the Performance tab, when arena data is available, then I see a model comparison table showing: model name, decision count, hit rate, average alpha, total cost — sortable by any column. Follow the HoldingsTable sorting pattern.

4. **AC4 — Arena session filtering:** Given arena data includes multiple sessions, when I want to compare models for a specific session, then I can filter by session or date range via TanStack Router search params.

5. **AC5 — Staleness:** Given the Performance tab data, when staleness exceeds 1 hour, then TanStack Query marks data as stale (staleTime: 60min). Already configured in `usePerformance.ts` — no changes needed.

## Tasks / Subtasks

- [x] Task 1: Build prediction accuracy section (AC: 1)
  - [x] 1.1 Create `PredictionAccuracySection` component inline in `performance.tsx` — displays total predictions, resolved count, overall hit rate, and per-window hit rates (T+5, T+10, T+20)
  - [x] 1.2 Use KPI-style card layout matching `PerformanceKpiCards` pattern: `Card` + `CardContent`, label in `text-sm font-medium text-muted-foreground`, value in `text-2xl font-bold`
  - [x] 1.3 Display average Brier score with color coding: `text-success` if < 0.25 (beating random), `text-destructive` if >= 0.25
  - [x] 1.4 Handle `prediction_accuracy_error` from API with inline `ErrorCard`
  - [x] 1.5 Handle null/empty prediction data with contextual empty state

- [x] Task 2: Build calibration chart and metrics (AC: 2)
  - [x] 2.1 Replace the "Coming in Story 5.3" placeholder `ChartCard` with a real calibration visualization
  - [x] 2.2 Create calibration metrics display showing: average Brier score, target Brier (0.25), beating-random indicator (green/red badge or icon), agreement rate (percentage), sycophancy flag (warning indicator if true)
  - [x] 2.3 Build calibration buckets bar chart using Recharts `BarChart` inside `ChartCard` + `ChartContainer` — reuse the existing shadcn chart components and tokens from Story 5.2
  - [x] 2.4 Note: The API does NOT currently return calibration bucket data (only aggregate metrics). Build the metrics card. For the buckets chart, show the metrics card with Brier score visualization only. If bucket data becomes available later, the chart can be extended.
  - [x] 2.5 Handle `calibration_error` with inline `ErrorCard`

- [x] Task 3: Build arena comparison table (AC: 3)
  - [x] 3.1 Create `ArenaComparisonTable` component inline in `performance.tsx` following the `HoldingsTable` sorting pattern: `useState` for `sortKey`/`sortDirection`, `useMemo` for sorted data, clickable column headers with `ArrowUpDown`/`ChevronUp`/`ChevronDown` icons
  - [x] 3.2 Columns: Model Name (`model_id`), Session (`session`), Decisions (`total_decisions`), Hit Rate (`hit_rate`), Avg Alpha (`average_alpha`), Cost (`total_cost`)
  - [x] 3.3 Format hit rate as percentage, alpha as percentage with +/- sign, cost as dollar amount — reuse `formatPct` and `formatDollar` from performance.tsx
  - [x] 3.4 Use the same `<table>` element pattern as HoldingsTable (custom div-based table with Card wrapper, NOT shadcn Table component which is not installed)
  - [x] 3.5 Handle `arena_comparison_error` with inline `ErrorCard`
  - [x] 3.6 Handle empty arena data with contextual empty state (e.g., "No arena comparison data available")

- [x] Task 4: Add arena session filtering via search params (AC: 4)
  - [x] 4.1 Add `session` search param to the route's `validateSearch` (following funnel.tsx `scan_date` pattern with TanStack Router typed search params)
  - [x] 4.2 Add a session filter dropdown/select above the arena table — populate options from unique `session` values in `arena_comparison` data
  - [x] 4.3 Filter arena rows client-side by selected session (or show all if no filter)
  - [x] 4.4 Update URL search params when session filter changes

- [x] Task 5: Wire everything into the Performance page layout (AC: 1-5)
  - [x] 5.1 Add prediction accuracy section below the KPI cards row
  - [x] 5.2 Replace calibration placeholder in the chart grid with the real calibration card
  - [x] 5.3 Add arena comparison table below the chart grid
  - [x] 5.4 Overall page layout top-to-bottom: `h1` → KPI cards → Prediction accuracy → Charts grid (P&L + Calibration) → Arena table
  - [x] 5.5 Responsive: all sections stack vertically on mobile, prediction cards use same responsive grid as KPI cards

- [x] Task 6: Update skeleton loading state (AC: 1-5)
  - [x] 6.1 Extend `PerformanceSkeleton` with additional skeleton blocks for prediction accuracy, calibration chart, and arena table sections

### Review Findings

- [x] [Review][Patch] `formatCell` is dead code — removed [frontend/src/routes/performance.tsx]
- [x] [Review][Patch] `onRetry` prop accepted but never used in `PredictionAccuracySection` and `CalibrationCard` — removed dead parameter [frontend/src/routes/performance.tsx]
- [x] [Review][Patch] Arena table row key `${model_id}-${session}` not guaranteed unique — added index to key [frontend/src/routes/performance.tsx]
- [x] [Review][Patch] Calibration bar chart per-datum `fill` color ignored — added `<Cell>` components for per-bar coloring [frontend/src/routes/performance.tsx]
- [x] [Review][Defer] KPI card rendering logic duplicated between `PerformanceKpiCards` and `PredictionAccuracySection` — cosmetic DRY concern, not a bug
- [x] [Review][Defer] `beating_random: null` displays as destructive (red) styling — ambiguous for unknown state. Pre-existing type allows null but no distinct null UI
- [x] [Review][Defer] Session filter dropdown hidden when only one session exists but URL session param still filters silently — minor UX edge case

## Dev Notes

### API Data Already Available — No Backend Changes Needed

The `GET /api/performance` endpoint (Story 5.1) already returns ALL data needed:
- `prediction_accuracy`: total_predictions, resolved_count, hit_rate, hit_rate_by_window (t_5, t_10, t_20), average_brier_score
- `calibration`: average_brier_score, target_brier (0.25), beating_random, agreement_rate, sycophancy_flag
- `arena_comparison`: array of `{ model_id, session, total_decisions, hit_rate, average_alpha, total_cost }`
- Each section has a corresponding `_error` field for partial degradation

The `usePerformance` hook and `PerformanceResponse` TypeScript types already include all these fields. **No API or type changes needed.**

### Existing Code to Reuse (DO NOT recreate)

| Asset | Location | What to reuse |
|-------|----------|---------------|
| Performance page | `frontend/src/routes/performance.tsx` | Extend this file — add sections below existing KPI cards and chart grid |
| Types | `frontend/src/types/performance.ts` | `PredictionAccuracy`, `Calibration`, `ArenaEntry` already defined |
| Hook | `frontend/src/api/usePerformance.ts` | Already returns all data — no changes needed |
| ChartCard | `frontend/src/components/ChartCard.tsx` | Wrap calibration chart with this |
| shadcn chart | `frontend/src/components/ui/chart.tsx` | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` |
| Card | `frontend/src/components/ui/card.tsx` | Card, CardContent, CardHeader, CardTitle |
| Skeleton | `frontend/src/components/ui/skeleton.tsx` | Loading states |
| ErrorCard | `frontend/src/components/ErrorCard.tsx` | Error display with retry |
| Formatters | `performance.tsx` (inline) | `formatDollar`, `formatPct` functions at top of file |
| Sorting pattern | `frontend/src/components/HoldingsTable.tsx` | `useState` for sortKey/sortDirection, `useMemo` for sorted data, clickable headers |
| KPI card pattern | `performance.tsx` (inline) | `PerformanceKpiCards` component for styling reference |
| Funnel route search params | `frontend/src/routes/funnel.tsx` | `validateSearch` pattern for typed search params |

### Calibration Buckets Chart — Data Limitation

The current API returns aggregate calibration metrics (Brier score, beating_random, agreement_rate, sycophancy_flag) but does NOT return calibration bucket breakdown data (i.e., predicted probability buckets vs actual hit rates). The Story 5.1 review explicitly deferred calibration buckets: "[Review][Decision] AC2 missing calibration buckets — Deferred to Story 5.3".

**Approach:** Build a calibration metrics card with the available data. Visualize the Brier score vs target (0.25) using a simple bar or gauge. If calibration bucket data is added to the API later, the chart component can be extended. Do NOT add a backend change to return bucket data — that is out of scope for this story.

### Arena Table Sorting Pattern (from HoldingsTable)

```typescript
type SortKey = keyof ArenaEntry
type SortDirection = "asc" | "desc"

const [sortKey, setSortKey] = useState<SortKey>("hit_rate")
const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

const sorted = useMemo(() => {
  if (!data) return []
  return [...data].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return sortDirection === "asc" ? cmp : -cmp
  })
}, [data, sortKey, sortDirection])

function handleSort(key: SortKey) {
  if (sortKey === key) {
    setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
  } else {
    setSortKey(key)
    setSortDirection("desc")
  }
}
```

### Session Filter Search Params Pattern (from funnel.tsx)

```typescript
// In the Route definition:
export const Route = createFileRoute("/performance")({
  component: PerformancePage,
  validateSearch: (search: Record<string, unknown>) => ({
    session: (search.session as string) || "",
  }),
})

// In the component:
const { session } = Route.useSearch()
const navigate = Route.useNavigate()

// Filter:
const filteredArena = useMemo(() => {
  if (!arena || !session) return arena ?? []
  return arena.filter((e) => e.session === session)
}, [arena, session])

// Update URL:
navigate({ search: { session: value } })
```

### Chart Styling Tokens (established in Story 5.2)

| Token | Value | Usage |
|-------|-------|-------|
| `--chart-grid` | `hsl(230, 14%, 14%)` | Gridlines (1px dashed) |
| `--chart-axis` | `hsl(215, 15%, 40%)` | Axis label text |
| `--chart-line-1` | `var(--primary)` | Primary data color |
| Tooltip bg | `--card` | Tooltip background |
| `--success` | `hsl(152, 60%, 48%)` | Positive values, beating random |
| `--destructive` | `hsl(0, 70%, 55%)` | Negative values, warnings |

For the calibration bar chart, use `--success` fill for Brier score below target and `--destructive` for above.

### Page Layout After Story 5.3

```
┌─────────────────────────────────────────────┐
│ Performance (h1)                             │
├─────────────────────────────────────────────┤
│ [P&L $] [CAGR] [SPY] [Alpha] [WinRate] [Trades]  ← KPI cards (existing)
├─────────────────────────────────────────────┤
│ [Total] [Resolved] [Hit Rate] [T+5] [T+10] [T+20] [Brier]  ← Prediction accuracy
├──────────────────────┬──────────────────────┤
│ Portfolio P&L vs SPY │ Prediction Calibration│  ← Charts grid (P&L existing, calibration new)
├──────────────────────┴──────────────────────┤
│ Arena Model Comparison                       │  ← Arena table (new section)
│ [Session filter]                             │
│ ┌─────────┬─────────┬───────┬───────┬──────┐│
│ │ Model   │ Session │ Hit%  │ Alpha │ Cost ││
│ ├─────────┼─────────┼───────┼───────┼──────┤│
│ │ claude  │ arena-1 │ 68%   │ +2.3% │ $15  ││
│ └─────────┴─────────┴───────┴───────┴──────┘│
└─────────────────────────────────────────────┘
```

### Architecture Compliance

- **Charting:** Recharts via shadcn/ui chart components (already installed in Story 5.2)
- **State:** TanStack Query for server state (via existing `usePerformance`), `useState` for local sort/filter state
- **Routing:** TanStack Router search params for session filter
- **Styling:** shadcn/ui components + Tailwind CSS, dark theme tokens
- **Data format:** Access API data as `snake_case` directly — no camelCase transform
- **Loading:** Skeleton components, never spinners
- **Errors:** Inline `ErrorCard` per section using `_error` fields
- **Accessibility:** `aria-label` on status indicators, table columns; color supplemented with icons

### What NOT To Do

- **Don't** modify the API endpoint or backend code — all data is already served
- **Don't** modify `usePerformance.ts` or `performance.ts` types — they already have everything
- **Don't** install new dependencies — Recharts and shadcn chart are already installed
- **Don't** install shadcn Table component — use the custom table pattern from HoldingsTable
- **Don't** use Redux/Zustand — TanStack Query handles server state
- **Don't** use loading spinners — use Skeleton components
- **Don't** build a separate calibration buckets API endpoint — use available aggregate data
- **Don't** create separate component files for prediction/calibration/arena sections — keep inline in `performance.tsx` matching the existing pattern where `PerformanceKpiCards` and `PnlChart` are defined inline
- **Don't** add drag/zoom to charts — not in MVP scope
- **Don't** create utility files for formatters — `formatDollar` and `formatPct` already exist inline in performance.tsx

### Previous Story Intelligence

**From Story 5.2 (in-progress):**
- Recharts + shadcn chart components installed and working
- `ChartCard` component created and proven with P&L chart
- `ChartContainer` + `ChartTooltip` + `ChartConfig` pattern established
- KPI cards pattern with color-coded positive/negative values and trend arrows
- Responsive grid: `grid-cols-1 lg:grid-cols-2` for charts, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` for KPI cards
- Calibration placeholder exists at `performance.tsx:294-302` — replace this
- `formatDollar`, `formatPct`, `formatShortDate` formatters defined inline
- Gradient defs pattern for area fills under chart lines

**From Story 5.1 (done):**
- All API query functions working: `get_prediction_accuracy()`, `get_calibration_scores()`, `get_arena_comparison()`
- Per-section `_error` fields enable partial degradation
- `beating_random = avg_brier < 0.25` (hardcoded threshold)
- `sycophancy_flag = agreement_rate > 0.95 AND brier_score > 0.25`
- Arena data: `arena_decisions` JOIN `arena_forward_returns`, grouped by model_id + session_id
- 121 API tests passing — no regressions allowed

**From Story 4.2 (done):**
- HoldingsTable sorting pattern: `useState` sortKey/direction + `useMemo` sorted data + clickable headers with sort icons
- Custom `<table>` element (not shadcn Table) with responsive design
- Mobile: cards layout instead of table rows (but arena table is simpler — just use horizontal scroll with `overflow-x-auto`)

### Testing Requirements

**File:** Co-locate tests in `frontend/src/routes/performance.test.tsx` (or extend existing if created by Story 5.2)

Test cases:
1. Prediction accuracy section renders hit rates per window when data present
2. Calibration metrics display Brier score with correct color (green < 0.25, red >= 0.25)
3. Sycophancy flag shows warning indicator when true
4. Arena table renders with correct columns and data
5. Arena table sorts by column when header clicked
6. Session filter filters arena rows
7. Loading state shows skeleton for all new sections
8. Per-section error (`prediction_accuracy_error`, `calibration_error`, `arena_comparison_error`) shows inline ErrorCard
9. Empty data shows contextual empty state per section

### Project Structure Notes

Files to modify:
- `frontend/src/routes/performance.tsx` — Add prediction accuracy section, replace calibration placeholder, add arena table, add search params, extend skeleton

No new files needed. All components are inline in performance.tsx.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5, Story 5.3]
- [Source: _bmad-output/planning-artifacts/architecture.md — Frontend Stack, Charting, Caching, API Patterns, Anti-Patterns, Naming]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Performance Tab layout, ChartCard spec, KPI Card spec, Chart styling tokens, Responsive breakpoints]
- [Source: _bmad-output/implementation-artifacts/5-1-performance-api-endpoint.md — API response shape, DB queries, calibration buckets deferral]
- [Source: _bmad-output/implementation-artifacts/5-2-performance-tab-portfolio-pnl-and-benchmark-charts.md — Recharts installation, ChartCard, KPI pattern, existing page structure]
- [Source: frontend/src/routes/performance.tsx — Current page implementation with placeholder at line 294-302]
- [Source: frontend/src/types/performance.ts — PredictionAccuracy, Calibration, ArenaEntry types]
- [Source: frontend/src/api/usePerformance.ts — Hook already returns all data]
- [Source: frontend/src/components/HoldingsTable.tsx — Sortable table pattern]
- [Source: frontend/src/components/ChartCard.tsx — Chart wrapper component]
- [Source: frontend/src/routes/funnel.tsx — Search params pattern for filtering]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Built `PredictionAccuracySection` with 7 KPI cards: total predictions, resolved count, overall hit rate, T+5/T+10/T+20 hit rates, and average Brier score. Color-coded by performance (> 50% hit rate = green, Brier < 0.25 = green).
- Built `CalibrationCard` replacing the "Coming in Story 5.3" placeholder. Includes horizontal Recharts BarChart comparing actual Brier score vs target (0.25), plus metrics grid showing Brier score, target, agreement rate, and sycophancy flag warning indicator.
- Built `ArenaComparisonTable` with sortable columns (model, session, decisions, hit rate, avg alpha, cost) following the HoldingsTable sorting pattern. Includes empty state and session-filtered empty state messages.
- Added session filtering via TanStack Router `validateSearch` search params with a `<select>` dropdown populated from unique sessions. URL updates on filter change.
- Updated `PerformanceSkeleton` with skeleton blocks for all new sections (prediction accuracy cards, calibration chart, arena table).
- All new sections handle per-section errors via `_error` fields from the API with inline `ErrorCard` + retry, and show contextual empty states when data is null.
- Extended test file from 6 to 19 tests covering prediction accuracy rendering, calibration metrics, sycophancy warning, arena table columns/data, arena sorting, session filtering, per-section errors, and empty states.
- All 127 frontend tests pass (19 in performance.test.tsx), all 149 API tests pass. Zero regressions. TypeScript compiles clean.

### Change Log

- 2026-04-07: Story 5.3 implementation complete — Prediction accuracy section, calibration card with Brier score chart, arena comparison table with sorting and session filtering

### File List

Modified files:
- frontend/src/routes/performance.tsx (added PredictionAccuracySection, CalibrationCard, ArenaComparisonTable, session search params, updated skeleton)
- frontend/src/routes/performance.test.tsx (extended from 6 to 19 tests, added TanStack Router mock, tests for all new sections)
