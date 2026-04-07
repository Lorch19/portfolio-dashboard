# Story 7.2: Costs Tab — Fee Breakdown and ROI Display

Status: done

## Story

As Omri,
I want to see a breakdown of all system costs and whether my returns justify the expenses,
So that I can make informed decisions about the system's economic viability.

## Acceptance Criteria

1. **AC1 — Cost breakdown:** Given I am on the Costs tab, when data loads from `GET /api/costs`, then I see cost breakdown sections: Brokerage Fees (per-trade table + cumulative total), API Costs (per-model bar chart + cumulative), VPS Cost (monthly + cumulative).

2. **AC2 — KPI cards:** Given I am viewing costs, when summary metrics load, then I see KPI cards: total system cost, cost-per-trade, total portfolio return, net return after costs, cost-as-%-of-returns.

3. **AC3 — API cost chart:** Given I am on the Costs tab, when cost data includes API costs by model, then I see a Recharts bar chart showing cost distribution across models.

4. **AC4 — Brokerage table:** Given I am viewing the brokerage fees section, when individual trade costs are listed, then I see a sortable table with: ticker, trade date, entry/exit, estimated cost ($).

5. **AC5 — Staleness:** Given the Costs tab data, when staleness exceeds 1 hour, then TanStack Query marks data as stale (staleTime: 60min).

6. **AC6 — Responsive:** Given I view the Costs tab on mobile, when the layout renders, then KPI cards stack vertically, charts adapt to full width, and tables are scrollable.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Completion Notes

- Created CostsResponse types matching full API response shape
- Created useCosts hook with 60-min staleTime
- Built 6 KPI cards with color-coded values and trend arrows
- Built sortable BrokerageTable with buy/sell action badges
- Built ApiCostChart using Recharts BarChart with per-model colored bars
- Built VpsCostCard with monthly and cumulative display
- Full loading/error/empty state handling with per-section error support
- 11 frontend tests pass, 139 total frontend tests pass — zero regressions
- 141 API tests pass — zero regressions

### File List

New files:
- frontend/src/types/costs.ts
- frontend/src/api/useCosts.ts
- frontend/src/routes/costs.test.tsx

Modified files:
- frontend/src/routes/costs.tsx (replaced skeleton with full implementation)
- frontend/src/lib/constants.ts (added COSTS_STALE_TIME)
