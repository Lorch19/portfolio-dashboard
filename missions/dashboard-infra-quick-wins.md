# Mission: Dashboard Infrastructure + Quick Wins

## Goal
Fix Health visibility, add strategy selector across Holdings/Performance, add cost date filtering, and add multi-portfolio comparison vs SPY/QQQ.

## Context
Dashboard is live at https://portfolio-dashboard-omri-lorchs-projects.vercel.app (Vercel) + https://omri-portfolio.duckdns.org (VPS API). First real use revealed missing strategy filtering, no date controls, and health components sorted alphabetically instead of by severity.

4 strategies exist in production:
- `live` (32 open, since 2026-03-25)
- `aggressive_growth` (42 open, since 2026-04-01)
- `concentrated` (15 open, since 2026-04-01)
- `conservative_value` (17 open, since 2026-04-01)

## Tasks

### 1. Health: Sort by Status Severity
- `api/src/db/supervisor.py` → `get_agent_statuses()`: ORDER BY status severity (down=0, degraded=1, healthy=2)
- Currently alphabetical — buries 4 DOWN + 4 DEGRADED components

### 2. Strategy Infrastructure
- New endpoint `GET /api/strategies` returning: strategy_id, start_date, latest_value, open_positions, latest_snapshot_date
- Add `strategy_id: Optional[str] = Query(None)` param to `/api/holdings` and `/api/performance`
- Update `get_open_positions()`, `get_portfolio_summary()`, `get_portfolio_snapshots()`, `get_portfolio_performance()` in `api/src/db/portfolio.py` — add WHERE strategy_id = ? when provided
- Default to showing ALL strategies combined when no filter (backward compatible)

### 3. Holdings: Strategy Selector + Start Dates
- Strategy dropdown at top of Holdings page
- Show strategy start_date next to each strategy name in the portfolio summary header
- When a strategy is selected, positions/summary/snapshots all filter to that strategy

### 4. Performance: Multi-Portfolio Comparison
- Comparison table at top: each strategy's return vs SPY vs QQQ for selected date range
- Date range picker (default: earliest portfolio start to today)
- Enforce earliest date = earliest portfolio start date
- When strategies have different start dates, show "(since {date})" under the strategy name
- SPY and QQQ returns should be computed for the same date range

### 5. Costs: Date Range Filter
- Add `start_date`/`end_date` query params to `/api/costs`
- Add WHERE clauses on `trade_events.timestamp` and `arena_decisions.created_at`
- Date range picker in frontend
- Default: all-time (backward compatible)

## Files to Modify
- `api/src/db/supervisor.py`
- `api/src/db/portfolio.py`
- `api/src/db/costs.py`
- `api/src/routers/holdings.py`
- `api/src/routers/performance.py`
- `api/src/routers/costs.py`
- New: `api/src/routers/strategies.py`
- `api/src/main.py` (register strategies router)
- `frontend/src/routes/holdings.tsx`
- `frontend/src/routes/performance.tsx`
- `frontend/src/routes/costs.tsx`
- `frontend/src/api/useHoldings.ts` / `usePerformance.ts` / `useCosts.ts`
- `frontend/src/types/` (add strategy types)

## Verification
- All existing tests pass
- New tests for strategy filtering + date filtering
- `preview_start` both servers, screenshot each tab
- Push and verify on Vercel

## Open Decisions
1. [OPEN] Should SPY/QQQ comparison data come from yfinance (live) or be pre-computed in a DB table? Pre-computed is simpler for the dashboard (read-only), but requires the pipeline to populate it.
2. [OPEN] Should the strategy dropdown default to "All" (combined view) or the `live` strategy?
3. [OPEN] Should date picker use calendar component or simple date inputs?
