# Story 7.1: Costs API Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns all system costs — brokerage, API, VPS — and ROI metrics,
So that the Costs tab can display total system economics.

## Acceptance Criteria

1. **AC1 — Costs response:** `GET /api/costs` returns JSON with: brokerage fees per trade and cumulative from `realized_gains` (transaction_costs) and `trade_events` (estimated_cost_dollars), API costs per model and cumulative from `arena_decisions` (cost_usd), VPS running cost from config constant, cost-per-trade metric (total costs / total trades), total system cost vs portfolio returns ratio.

2. **AC2 — Total system cost:** VPS cost is a config constant. Total system cost = cumulative brokerage fees + cumulative API costs + (VPS monthly cost x months running).

3. **AC3 — ROI:** When portfolio returns are available from `sim_portfolio_snapshots`, the endpoint returns total system cost, total portfolio return, and net return after costs.

## Tasks / Subtasks

- [x] Task 1: Add VPS_MONTHLY_COST config constant (AC: 2)
- [x] Task 2: Create costs DB query functions in `api/src/db/costs.py` (AC: 1,2,3)
  - [x] 2.1 `get_brokerage_costs()` — per-trade fees from trade_events + realized_gains
  - [x] 2.2 `get_total_portfolio_return()` — from sim_portfolio_snapshots for ROI calc
- [x] Task 3: Create costs router `api/src/routers/costs.py` (AC: 1,2,3)
  - [x] 3.1 `GET /api/costs` endpoint with dual-DB independent error handling
  - [x] 3.2 Compute API costs from arena_decisions (cost_usd) per model
  - [x] 3.3 Compute total system cost and ROI metrics
- [x] Task 4: Register router in main.py (AC: 1)
- [x] Task 5: Add test fixtures and tests (AC: 1,2,3)
  - [x] 5.1 Add realized_gains schema to conftest
  - [x] 5.2 Test brokerage costs query
  - [x] 5.3 Test API costs aggregation
  - [x] 5.4 Test total system cost calculation
  - [x] 5.5 Test ROI calculation
  - [x] 5.6 Test endpoint with missing DBs
  - [x] 5.7 Test endpoint with empty data

## Dev Notes

### Database Tables

**portfolio.db:**
- `trade_events` — has `estimated_cost_dollars` column (already in schema)
- `realized_gains` — has `transaction_costs` column (may not exist; handle gracefully)
- `sim_portfolio_snapshots` — portfolio_value for ROI calc (already in schema)

**supervisor.db:**
- `arena_decisions` — has `cost_usd` column (already in schema)

### Patterns to Follow

- Dual-DB independent error handling (same as performance.py)
- Per-section `_error` fields for partial degradation
- Read-only `?mode=ro` connections
- Config constants in `api/src/config.py`

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 7, Story 7.1]
- [Source: api/src/routers/performance.py — Dual-DB error handling pattern]
- [Source: api/src/config.py — Config constants pattern]
