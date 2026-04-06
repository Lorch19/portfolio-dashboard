# Story 4.2: Holdings Tab — Positions Table with P&L and Risk Status

Status: review

## Story

As Omri,
I want to see all open positions in a sortable table with unrealized P&L, sleeve allocation, and Guardian risk indicators,
So that I can monitor my portfolio health at a glance on any device.

## Acceptance Criteria

1. **AC1 — DataTable renders with required columns:** Given I am on the Holdings tab, when data loads from `GET /api/holdings`, then I see a DataTable with columns: ticker, sleeve, entry price, current price, unrealized P&L (% and $), days held, conviction, exit stage, stop loss.

2. **AC2 — Column sorting:** Given I am viewing the holdings table, when I click a column header, then the table sorts by that column (ascending/descending toggle).

3. **AC3 — P&L color coding:** Given I am viewing holdings, when a position's unrealized P&L is negative, then the P&L cell is styled with red (`--destructive`) + down arrow; positive P&L shows green (`--success`) + up arrow. Arrows are 12px, supplementing color for accessibility.

4. **AC4 — Sleeve allocation display:** Given I am viewing holdings, when data loads, then sleeve allocation is displayed per position as a badge (e.g., "Sleeve 1" / "Sleeve 2").

5. **AC5 — Risk status badges:** Given I am viewing holdings, when Guardian risk indicators are present, then I see risk status badges per position (near-stop = amber `--warning`, high heat = red `--destructive`, ok = green `--success`).

6. **AC6 — Stale data refetch:** Given I am on the Holdings tab, when 5 minutes have elapsed since last fetch, then TanStack Query marks data as stale and refetches on focus (`staleTime: 300_000`).

7. **AC7 — Mobile card layout:** Given I view the Holdings tab on mobile (<768px), when the table renders, then positions display as cards showing ticker, P&L, sleeve. Tap card to expand full detail. No horizontal scrolling.

## Tasks / Subtasks

- [x] Task 1: Create holdings types (AC: 1)
  - [x] 1.1 Create `frontend/src/types/holdings.ts` with `HoldingsPosition` and `HoldingsResponse` interfaces matching API response shape
- [x] Task 2: Create holdings API hook (AC: 1, 6)
  - [x] 2.1 Create `frontend/src/api/useHoldings.ts` with `useHoldings()` hook — `GET /api/holdings`, staleTime 300_000
  - [x] 2.2 Add `HOLDINGS_STALE_TIME = 300_000` to `frontend/src/lib/constants.ts`
- [x] Task 3: Build DataTable component (AC: 1, 2, 3, 7)
  - [x] 3.1 Create `frontend/src/components/HoldingsTable.tsx` — sortable table with all required columns
  - [x] 3.2 Implement sort state with ascending/descending toggle on column header click
  - [x] 3.3 P&L cells: green `text-success` + ArrowUp for positive, red `text-destructive` + ArrowDown for negative, muted dash for zero
  - [x] 3.4 Mobile (<768px): switch to card layout — each position is a card showing ticker, P&L, sleeve; tap to expand full detail
- [x] Task 4: Build supporting display components (AC: 4, 5)
  - [x] 4.1 Sleeve badge display (inline in table/card) — "Sleeve 1" / "Sleeve 2"
  - [x] 4.2 Risk status badges per position — near-stop (amber), high-heat (red), ok (green)
- [x] Task 5: Implement Holdings route (AC: 1-7)
  - [x] 5.1 Replace holdings.tsx stub with full implementation — loading skeleton, error handling, data display
  - [x] 5.2 Loading state: skeleton rows matching table dimensions
  - [x] 5.3 Error state: ErrorCard with retry for each error section (positions_error, risk_data_error)
  - [x] 5.4 Empty state: "No open positions" centered message
- [x] Task 6: Write tests (AC: 1-7)
  - [x] 6.1 `frontend/src/routes/holdings.test.tsx` — route renders, loading, error, empty states
  - [x] 6.2 `frontend/src/components/HoldingsTable.test.tsx` — sorting, P&L colors, mobile card view
- [x] Task 7: Add formatCurrency and formatPct utilities if missing
  - [x] 7.1 Check `frontend/src/lib/` for existing formatters; add `formatCurrency` and `formatPct` if not present (inlined in HoldingsTable.tsx)

## Dev Notes

### Existing Code to Reuse (DO NOT recreate)

- **Route stub:** `frontend/src/routes/holdings.tsx` exists — replace skeleton content, keep `createFileRoute("/holdings")` pattern
- **API client:** `frontend/src/api/client.ts` — `apiClient<T>(path)` generic fetch wrapper
- **QueryClient:** `frontend/src/api/queryClient.ts` — already configured
- **ErrorCard:** `frontend/src/components/ErrorCard.tsx` — inline error display with retry button
- **Skeleton:** `frontend/src/components/ui/skeleton.tsx` — shadcn skeleton for loading states
- **Card:** `frontend/src/components/ui/card.tsx` — shadcn card for mobile layout
- **StatusBadge:** `frontend/src/components/StatusBadge.tsx` — may be reusable for risk badges (check props)
- **Icons:** `lucide-react` — ArrowUp, ArrowDown, Minus for P&L direction
- **Constants:** `frontend/src/lib/constants.ts` — add HOLDINGS_STALE_TIME here
- **formatRelativeTime:** `frontend/src/lib/format-time.ts` — for timestamp display

### API Response Shape (from Story 4.1)

```json
{
  "positions": [
    {
      "ticker": "AAPL",
      "sector": "Technology",
      "entry_price": 175.50,
      "entry_date": "2026-03-15",
      "current_price": 185.50,
      "shares": 10,
      "unrealized_pnl": 100.00,
      "unrealized_pnl_pct": 5.70,
      "sleeve": 1,
      "stop_loss": 165.00,
      "target_1": 195.00,
      "target_2": 210.00,
      "conviction": "high",
      "days_held": 21,
      "current_stop_level": 170.00,
      "exit_stage": "breakeven",
      "portfolio_heat_contribution": 0.12,
      "sector_concentration_status": "ok"
    }
  ],
  "positions_error": null,
  "risk_data_error": null,
  "message": null
}
```

**Key:** All keys are `snake_case`. Access directly as `data.unrealized_pnl_pct` — NO camelCase transform.

### Architecture Compliance

**Stack:** React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, TanStack Router + Query, Vitest + Testing Library

**Patterns to follow exactly:**

1. **Route pattern** (match health.tsx / supervisor.tsx / funnel.tsx):
   ```tsx
   export const Route = createFileRoute("/holdings")({
     component: HoldingsPage,
   })
   function HoldingsPage() {
     const { data, isLoading, isError, refetch } = useHoldings()
     if (isLoading) return <HoldingsSkeleton />
     if (isError) return <ErrorCard error="Failed to load" onRetry={() => refetch()} />
     return <div className="space-y-6 p-6">...</div>
   }
   ```

2. **API hook pattern** (match useHealth.ts / useSupervisor.ts / useFunnel.ts):
   ```tsx
   export function useHoldings() {
     return useQuery({
       queryKey: ["holdings"],
       queryFn: () => apiClient<HoldingsResponse>("/api/holdings"),
       staleTime: HOLDINGS_STALE_TIME,
     })
   }
   ```

3. **Type pattern** (match types/health.ts / types/supervisor.ts / types/funnel.ts):
   ```tsx
   export interface HoldingsPosition {
     ticker: string
     sector: string | null
     entry_price: number
     // ... all fields snake_case matching API
   }
   export interface HoldingsResponse {
     positions: HoldingsPosition[] | null
     positions_error: string | null
     risk_data_error: string | null
     message: string | null
   }
   ```

4. **Error handling:** Per-section ErrorCard. If `positions_error` is set, show ErrorCard for positions. If `risk_data_error` is set, show warning but still render positions if available. Independent degradation.

5. **Loading state:** Skeleton components matching final layout dimensions. No spinners.

6. **No modals, no toasts** — all feedback inline.

7. **Imports:** Use `@/` path aliases (`@/api/useHoldings`, `@/components/ErrorCard`, etc.)

### UX Specifications

**Desktop layout:**
- Full DataTable with all columns visible
- Column headers: `text-sm font-semibold`, sortable with discrete arrow icon
- Rows: 40px height, alternating `bg-muted/50` backgrounds
- P&L cells: green (`text-success`) or red (`text-destructive`) with direction arrows (12px)
- Expandable rows optional (chevron to show target_1, target_2, sector detail)

**Mobile layout (<768px):**
- Each position becomes a Card component
- Card shows: ticker (bold), unrealized P&L (colored), sleeve badge
- Tap card to expand: entry price, current price, days held, conviction, exit stage, stop loss, targets
- Cards stack vertically, no horizontal scrolling
- Touch targets: minimum 44x44px, card rows 48px

**Color system:**
- `--success` (`hsl(152, 60%, 48%)`) — positive P&L, healthy risk
- `--warning` (`hsl(38, 85%, 55%)`) — near-stop, attention needed
- `--destructive` (`hsl(0, 70%, 55%)`) — negative P&L, high heat
- Always supplement color with icon/text for color-blind accessibility

**Empty state:** Centered icon + "No open positions" title + subtitle in `text-muted-foreground`

**Skeleton:** Rows matching table dimensions, `bg-muted` with pulse animation. Instant swap to content (no fade).

### Formatting Utilities

Check if `frontend/src/lib/` already has formatters. If not, create in `frontend/src/lib/formatters.ts`:
- `formatCurrency(value: number): string` — e.g., `$1,234.56` or `-$45.20`
- `formatPct(value: number): string` — e.g., `5.70%` or `-2.30%`
- `formatDate(isoDate: string): string` — e.g., `Mar 15, 2026`

Keep them simple inline functions if only used in holdings. Do NOT create a separate file for one function — inline is fine.

### Testing Requirements

**Co-located tests** (match existing pattern):

`frontend/src/routes/holdings.test.tsx`:
- Renders loading skeleton initially
- Renders positions table when data loads
- Shows ErrorCard when API fails
- Shows "No open positions" when positions array is empty
- Handles partial degradation (risk_data_error with positions still showing)

`frontend/src/components/HoldingsTable.test.tsx`:
- Renders all required columns
- Sorts ascending/descending on column header click
- P&L cell shows green + up arrow for positive values
- P&L cell shows red + down arrow for negative values
- Renders sleeve badges
- Renders risk status badges
- Mobile view shows card layout (mock viewport or test card rendering)

**Test utilities:** Use `frontend/src/test-utils.tsx` for render wrapper if it exists. Use `vitest` + `@testing-library/react`.

### What NOT To Do

- Do NOT create a camelCase transform layer — access API data as `snake_case` directly
- Do NOT use Redux/Zustand — TanStack Query handles all server state
- Do NOT add global loading overlay — each section loads independently
- Do NOT use toast notifications — errors are inline ErrorCards
- Do NOT add horizontal scrolling on mobile — use card layout instead
- Do NOT create utility files with single functions — inline simple logic
- Do NOT modify the API endpoint — Story 4.1 handles the backend
- Do NOT add authentication — deferred per architecture
- Do NOT wrap response in `{ data, success }` envelope pattern on frontend
- Do NOT add features beyond the acceptance criteria (no search, no filtering beyond sort)

### Previous Story Intelligence

**From Story 4.1 (Holdings API):**
- API endpoint is `GET /api/holdings` with no query params
- Response has independent error sections: `positions_error` and `risk_data_error`
- Risk fields are merged flat into each position object (not nested)
- `unrealized_pnl` is float (2dp), `unrealized_pnl_pct` is float (2dp), `days_held` is integer
- `sleeve` is integer (1 or 2), `conviction` is string (high/medium/low)
- `exit_stage` is string (initial/breakeven/trailing) or null
- `sector_concentration_status` is string (ok/warning/critical) or null
- `portfolio_heat_contribution` is float (0.0-1.0) or null

**From Story 3.2 (Funnel Tab UI) — latest frontend story patterns:**
- Route file uses `createFileRoute` with optional `validateSearch` for query params
- Uses `useQuery` hook from dedicated API file
- Skeleton component for loading
- ErrorCard for errors with refetch callback
- Content wrapped in `<div className="space-y-6 p-6">`
- Page title: `<h1 className="text-xl font-semibold">Holdings</h1>`

**From Story 2.2 (Supervisor Tab UI):**
- Complex tab with multiple sections — each section handles its own error state
- Uses section-level ErrorCard pattern
- Components receive data + error + onRetry as props

### Project Structure Notes

All files go in existing directories — no new directories needed:

| New File | Location |
|----------|----------|
| Holdings types | `frontend/src/types/holdings.ts` |
| Holdings hook | `frontend/src/api/useHoldings.ts` |
| Holdings table | `frontend/src/components/HoldingsTable.tsx` |
| Holdings route test | `frontend/src/routes/holdings.test.tsx` |
| Holdings table test | `frontend/src/components/HoldingsTable.test.tsx` |

| Modified File | Change |
|---------------|--------|
| `frontend/src/routes/holdings.tsx` | Replace stub with full implementation |
| `frontend/src/lib/constants.ts` | Add `HOLDINGS_STALE_TIME` |

### References

- [Source: epics.md#Epic 4, Story 4.2] — User story, acceptance criteria
- [Source: architecture.md#Frontend] — React 19, TanStack Router/Query, shadcn/ui patterns
- [Source: architecture.md#API Patterns] — GET /api/holdings, snake_case, no envelope
- [Source: architecture.md#Data Architecture] — Holdings staleTime 5min
- [Source: ux-design-specification.md#Holdings Tab] — Desktop DataTable, mobile card layout, P&L colors
- [Source: ux-design-specification.md#DataTable Component] — Sort, expand, mobile card fallback
- [Source: ux-design-specification.md#Color System] — success/warning/destructive tokens
- [Source: 4-1-holdings-api-endpoint.md] — API response shape, field types, error sections
- [Source: frontend/src/routes/supervisor.tsx] — Route pattern reference
- [Source: frontend/src/api/useFunnel.ts] — API hook pattern reference
- [Source: frontend/src/types/funnel.ts] — Type definition pattern reference

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Created HoldingsPosition and HoldingsResponse TypeScript interfaces matching API snake_case contract
- Created useHoldings() TanStack Query hook with 5-min staleTime, following useFunnel pattern
- Built HoldingsTable component with: sortable columns (asc/desc toggle), P&L color coding (green/red/muted with direction arrows), sleeve badges, risk status badges (OK/Near Stop/High Heat/Sector Warning/Critical), mobile card layout with tap-to-expand
- Replaced holdings.tsx route stub with full implementation: loading skeleton, per-section error handling (positions_error, risk_data_error independent), empty state with icon
- Format utilities (formatCurrency, formatPct) inlined in HoldingsTable to avoid single-function utility files
- 19 new tests across 2 test files covering: column rendering, sorting, P&L colors, risk badges, sleeve badges, mobile cards, expand/collapse, empty state, error states, partial degradation
- All 106 tests pass (15 test files), zero regressions

### Change Log

- 2026-04-06: Story 4.2 implementation complete — Holdings tab with sortable positions table, P&L visualization, risk badges, mobile card layout

### File List

New files:
- frontend/src/types/holdings.ts
- frontend/src/api/useHoldings.ts
- frontend/src/components/HoldingsTable.tsx
- frontend/src/components/HoldingsTable.test.tsx
- frontend/src/routes/holdings.test.tsx

Modified files:
- frontend/src/routes/holdings.tsx (replaced stub with full implementation)
- frontend/src/lib/constants.ts (added HOLDINGS_STALE_TIME)
