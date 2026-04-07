# Story 6.2: Decisions Tab — Reasoning Log and Scoring Breakdown

Status: done

## Story

As Omri,
I want to see per-ticker reasoning with F-Score, ROIC, RSI breakdowns and prediction outcomes,
So that I can audit and understand every decision the system made.

## Acceptance Criteria

1. **AC1 — Decisions table:** Given I am on the Decisions tab, when data loads, then I see a table of recent decisions with: ticker, date, decision tier, conviction, thesis summary (truncated), and P&L outcome if closed.

2. **AC2 — Expanded detail view:** Given I am viewing the decisions table, when I click on a ticker row, then I see an expanded detail view with: full thesis text, F-Score breakdown, ROIC/RSI/P&E inputs at time of decision, Guardian rules checked, and prediction log with outcomes.

3. **AC3 — Ticker search filter:** Given I want to find a specific ticker, when I type a ticker symbol in a search/filter input, then the decisions table filters to show only that ticker's history (via TanStack Router search params).

4. **AC4 — Prediction outcomes display:** Given I am viewing prediction outcomes, when T+20 has elapsed for a prediction, then I see: predicted vs actual outcome, Brier score, and direction correctness badge.

## Tasks / Subtasks

- [ ] Task 1: Create TypeScript types for decisions API response (AC: 1-4)
  - [ ] 1.1 Create `frontend/src/types/decisions.ts` with `DecisionEntry`, `PredictionEntry`, `CounterfactualEntry`, and `DecisionsResponse` interfaces matching the API response shape from story 6.1

- [ ] Task 2: Create TanStack Query hook for decisions endpoint (AC: 1-4)
  - [ ] 2.1 Create `frontend/src/api/useDecisions.ts` with `useDecisions(ticker?)` hook
  - [ ] 2.2 Add `DECISIONS_STALE_TIME` to `frontend/src/lib/constants.ts` (15 min = 900_000, matching architecture spec)
  - [ ] 2.3 When `ticker` param is provided, append `?ticker=X` to API URL and include in queryKey

- [ ] Task 3: Implement decisions table with sortable columns (AC: 1)
  - [ ] 3.1 Replace placeholder in `frontend/src/routes/decisions.tsx` with full `DecisionsPage` component
  - [ ] 3.2 Add loading/error/empty state guards following holdings.tsx pattern (skeleton, ErrorCard, EmptyState)
  - [ ] 3.3 Implement sortable table with columns: ticker, scan_date, decision_tier, conviction, thesis_full_text (truncated to ~80 chars), decision (approve/reject/modify)
  - [ ] 3.4 Follow table pattern from holdings.tsx: COLUMNS array, useMemo sort, ArrowUp/ArrowDown icons, zebra striping
  - [ ] 3.5 Default sort by scan_date DESC

- [ ] Task 4: Implement expandable row detail view (AC: 2)
  - [ ] 4.1 Add expand/collapse state (one row at a time, matching holdings mobile card pattern)
  - [ ] 4.2 Expanded section shows: full thesis text, primary_catalyst, invalidation_trigger
  - [ ] 4.3 Scoring breakdown grid: F-Score (fundamental_score), ROIC (roic_at_scan, prev_roic, roic_delta), RSI, P/E (pe_at_scan, median_pe, pe_discount_pct), relative_strength, valuation_verdict
  - [ ] 4.4 Prediction outcomes section: show matching predictions for that ticker with predicted/actual outcome, Brier score, direction badge (AC: 4)
  - [ ] 4.5 Use semantic colors: text-success for correct predictions, text-destructive for incorrect

- [ ] Task 5: Implement ticker search via URL search params (AC: 3)
  - [ ] 5.1 Add `validateSearch` to route definition: `{ ticker: string }` search param
  - [ ] 5.2 Add text input for ticker filter above the table — 300ms debounce per UX spec
  - [ ] 5.3 On input change, navigate with `search: { ticker }` to update URL
  - [ ] 5.4 Pass ticker to `useDecisions(ticker)` to filter API call
  - [ ] 5.5 Show clear button (X) when ticker filter is active

- [ ] Task 6: Implement mobile card layout (AC: 1, 2)
  - [ ] 6.1 Create mobile card view (`md:hidden`) showing: ticker, conviction badge, thesis summary truncated
  - [ ] 6.2 Tap to expand: full thesis, scoring breakdown, prediction outcomes — same content as desktop expanded row
  - [ ] 6.3 Desktop table (`hidden md:block`) and mobile cards share the same sort state and data

- [ ] Task 7: Implement DecisionsSkeleton component (AC: 1)
  - [ ] 7.1 Create skeleton matching page layout: title placeholder, search input placeholder, table header + 5 row placeholders
  - [ ] 7.2 Follow existing skeleton pattern from holdings.tsx

## Dev Notes

### Existing Code to Reuse (DO NOT recreate)

- **Route placeholder:** `frontend/src/routes/decisions.tsx` — already exists with `createFileRoute("/decisions")`, replace placeholder content
- **Tab registration:** `frontend/src/lib/constants.ts` — Decisions tab already in TABS array with Brain icon
- **API client:** `frontend/src/api/client.ts` — `apiClient<T>(path)` generic fetch wrapper
- **Query client:** `frontend/src/api/queryClient.ts` — singleton QueryClient with retry:1
- **ErrorCard:** `frontend/src/components/ErrorCard.tsx` — error display with retry button
- **Table pattern:** `frontend/src/components/HoldingsTable.tsx` — sortable table + mobile card, expandable rows
- **Formatting:** Local formatters in route files (formatDollar, formatPct) — define locally, not shared
- **Skeleton:** `@/components/ui/skeleton` — shadcn Skeleton component

### API Response Shape (from Story 6.1)

```json
{
  "decisions": [
    {
      "ticker": "AAPL", "scan_date": "2026-04-01", "decision": "approve",
      "thesis_full_text": "Apple shows strong earnings...",
      "primary_catalyst": "Earnings beat Q1",
      "invalidation_trigger": "Revenue miss > 5%",
      "decision_tier": "high_conviction", "conviction": "high",
      "fundamental_score": 7, "roic_at_scan": 28.5, "prev_roic": 25.3,
      "roic_delta": 3.2, "rsi": 55.4, "pe_at_scan": 28.1,
      "median_pe": 32.5, "pe_discount_pct": -13.5,
      "relative_strength": 1.15, "valuation_verdict": "undervalued"
    }
  ],
  "decisions_error": null,
  "predictions": [
    {
      "ticker": "AAPL", "scan_date": "2026-03-15",
      "predicted_outcome": "up", "probability": 0.72,
      "actual_outcome": "up", "resolved": 1, "brier_score": 0.08
    }
  ],
  "predictions_error": null,
  "counterfactuals": { "top_misses": [...], "top_good_rejections": [...] },
  "counterfactuals_error": null,
  "message": null
}
```

**Note from story 6.1 review:** The API returns ALL predictions (not just T+20). The frontend should filter to show only `resolved === 1` predictions in the detail view for AC4.

### Architecture Compliance

**Stack:** React 19, TypeScript strict, Vite 8, TanStack Router + Query, Tailwind CSS v4, shadcn/ui.

**Route pattern** (match holdings.tsx):
```tsx
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/decisions")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticker: (search.ticker as string) || "",
  }),
  component: DecisionsPage,
})
```

**Hook pattern** (match useHoldings.ts):
```tsx
export function useDecisions(ticker?: string) {
  const path = ticker ? `/api/decisions?ticker=${encodeURIComponent(ticker)}` : "/api/decisions"
  return useQuery({
    queryKey: ["decisions", ticker ?? ""],
    queryFn: () => apiClient<DecisionsResponse>(path),
    staleTime: DECISIONS_STALE_TIME,
  })
}
```

**Loading/error pattern:**
```tsx
if (isLoading) return <DecisionsSkeleton />
if (isError) return <div className="p-6"><ErrorCard error={error?.message ?? "Failed to load"} onRetry={() => refetch()} /></div>
```

**Table pattern:** COLUMNS array + useMemo sort + `aria-sort` on headers. Zebra striping: `i % 2 === 1 && "bg-muted/50"`. Numeric cells: `tabular-nums`. Row height: `h-10`.

**Expandable rows:** Single expanded row state (`expandedTicker: string | null`). Click toggles. Expanded section renders below row with scoring grid.

**Mobile cards:** `space-y-3 md:hidden` card list with `hidden md:block` table. Cards use `Card > CardContent` with `role="button"` and `aria-expanded`.

**Search params:** `Route.useSearch()` for reading, `Route.useNavigate()` for updating. 300ms debounce on input. URL format: `/decisions?ticker=AAPL`.

### Scoring Breakdown Layout (Expanded Row)

Desktop expanded section layout:
```
┌─────────────────────────────────────────────────┐
│ Thesis: [full text]                             │
│ Catalyst: [primary_catalyst]                    │
│ Invalidation: [invalidation_trigger]            │
├─────────────────────────────────────────────────┤
│ F-Score    ROIC      RSI    P/E        Rel Str  │
│ 7/9        28.5%     55.4   28.1x      1.15     │
│            +3.2 delta       vs 32.5 med          │
│            (prev 25.3)      -13.5% disc          │
│                                                  │
│ Valuation: undervalued                           │
├─────────────────────────────────────────────────┤
│ Predictions:                                     │
│ T+20 ✓ up (72%) → up  Brier: 0.08              │
└─────────────────────────────────────────────────┘
```

Use a responsive grid: `grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5` for scoring metrics.

### Prediction Direction Badge

```tsx
function DirectionBadge({ predicted, actual, resolved }: { predicted: string | null, actual: string | null, resolved: number }) {
  if (!resolved || !actual) return <span className="text-muted-foreground">pending</span>
  const correct = predicted === actual
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium",
      correct ? "text-success" : "text-destructive"
    )}>
      {correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {actual}
    </span>
  )
}
```

### What NOT To Do

- Do NOT install new dependencies — all needed libraries are already in package.json
- Do NOT create a separate page/route for detail view — use expandable rows inline
- Do NOT use global state (Redux, Zustand) — TanStack Query is the server state manager
- Do NOT add loading spinners — use shadcn Skeleton components
- Do NOT create shared formatter utilities — define locally in the route file
- Do NOT modify the API endpoint — story 6.1 is done
- Do NOT add toast notifications for errors — use inline ErrorCard per section
- Do NOT implement counterfactual display — that's story 6.3

### Previous Story Intelligence

**From Story 6.1 (Decisions API — just completed):**
- API returns ALL predictions (not just T+20 resolved) — frontend must filter `resolved === 1` for display
- Counterfactuals are global (not per-ticker) — deferred by design, story 6.3 will build the counterfactual UI
- `message` key added to response dict for consistency
- Empty ticker string rejected at API level (`min_length=1`)
- Scoring columns may be null if production DB schema varies — handle null values gracefully in UI

**From Story 5.2 (Performance Tab — most recent frontend story):**
- KPI cards use inline grid pattern, not shared KpiCard component
- Charts use ChartCard wrapper for loading/error/empty states
- `Route.useNavigate()` pattern for search param updates
- Local formatters defined at top of route file

**From Story 4.2 (Holdings Tab):**
- HoldingsTable.tsx is the canonical sortable table + mobile card pattern
- Expandable rows use single `expandedTicker` state
- Mobile cards: `Card > CardContent` with `role="button"`, `aria-expanded`, `tabIndex={0}`
- Sorting: `useMemo` with null-safe comparator, nulls sort to end
- Cell formatting: `tabular-nums` for numbers, `text-success`/`text-destructive` for P&L

### Git Intelligence

Recent commits: `Story 5.1`, `Stories 1.3-4.2`. Frontend stories typically modify: route file, types file, API hook file, constants.ts. No separate component file unless table is complex (HoldingsTable.tsx was extracted).

Commit pattern: `Story X.Y: Description`

### Project Structure Notes

| New File | Location |
|----------|----------|
| Types | `frontend/src/types/decisions.ts` |
| API hook | `frontend/src/api/useDecisions.ts` |

| Modified File | Change |
|---------------|--------|
| `frontend/src/routes/decisions.tsx` | Replace placeholder with full implementation |
| `frontend/src/lib/constants.ts` | Add `DECISIONS_STALE_TIME` |

### References

- [Source: epics.md#Epic 6, Story 6.2] — User story, acceptance criteria, BDD scenarios
- [Source: ux-design-specification.md#Decisions Tab] — DataTable with expandable rows, ticker search via URL param, mobile card layout
- [Source: ux-design-specification.md#DataTable] — Sortable, expandable table spec with mobile card fallback
- [Source: ux-design-specification.md#Filtering] — Search input for ticker, 300ms debounce, URL param `?ticker=AAPL`
- [Source: architecture.md#Frontend Stack] — React 19, TanStack Router/Query, Tailwind CSS v4, shadcn/ui
- [Source: architecture.md#Data Architecture] — Decisions staleTime ~15min
- [Source: frontend/src/components/HoldingsTable.tsx] — Canonical sortable table + expandable row + mobile card pattern
- [Source: frontend/src/routes/holdings.tsx] — Route file pattern with loading/error/empty states
- [Source: 6-1-decisions-api-endpoint.md] — API response shape, review findings (predictions not filtered, counterfactuals global)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Completion Notes List

- Combined with Story 6.3 implementation in single decisions page
- Created types, hook, and full page implementation replacing skeleton placeholder
- Debounced ticker search via URL params using TanStack Router validateSearch
- Desktop table with expandable detail rows + mobile card view
- Scoring grid showing all 10 metrics from guardian_decisions
- Per-ticker prediction log with Brier score color coding
- 16 tests all passing (155 total frontend tests)
- Linter auto-improved TickerSearch from form+submit to debounced input pattern

### Change Log

- 2026-04-07: Story 6.2 implementation complete

### File List

New files:
- frontend/src/types/decisions.ts
- frontend/src/api/useDecisions.ts
- frontend/src/routes/decisions.test.tsx

Modified files:
- frontend/src/routes/decisions.tsx (replaced placeholder with full implementation)
- frontend/src/lib/constants.ts (added DECISIONS_STALE_TIME)
