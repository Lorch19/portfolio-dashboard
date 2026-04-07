# Story 5.1: Performance API Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns portfolio performance metrics, prediction accuracy, calibration scores, and arena comparison data,
So that the Performance tab can display credible analytics.

## Acceptance Criteria

1. **AC1 — Portfolio P&L and benchmark:** Given the API is running, when I call `GET /api/performance`, then I receive JSON with: portfolio P&L (absolute and %), CAGR calculation, SPY benchmark return over the same period, alpha (portfolio return - SPY return) from `sim_portfolio_snapshots`.

2. **AC2 — Prediction accuracy:** Given the response includes prediction data, when prediction accuracy is calculated, then it includes: total predictions, resolved count, hit rate by eval window (T+5, T+10, T+20), average Brier score, and calibration buckets from supervisor `predictions` and `eval_results` tables.

3. **AC3 — Calibration engine:** Given the response includes calibration data, when CalibrationEngine scores are included, then it includes: average Brier score, target Brier (0.25), beating-random flag, agreement rate, and sycophancy flag.

4. **AC4 — Arena comparison:** Given the response includes arena data, when arena comparison is included, then it includes per-model: model_id, total decisions, hit rate, average alpha, total cost, grouped by session for side-by-side comparison from `arena_decisions` and `arena_forward_returns`.

## Tasks / Subtasks

- [x] Task 1: Add portfolio performance query functions to `api/src/db/portfolio.py` (AC: 1)
  - [x] 1.1 `get_portfolio_performance(conn)` — query `sim_portfolio_snapshots` for portfolio P&L time series, compute absolute P&L, percentage return, CAGR, SPY return, and alpha
  - [x] 1.2 Compute CAGR from first and latest snapshot dates and portfolio values
  - [x] 1.3 Return SPY benchmark return from `sim_portfolio_snapshots` (spy columns) over the same date range
- [x] Task 2: Add prediction/calibration/arena query functions to `api/src/db/supervisor.py` (AC: 2, 3, 4)
  - [x] 2.1 `get_prediction_accuracy(conn)` — query `predictions` and `eval_results` for total predictions, resolved count, hit rate by window (T+5, T+10, T+20), average Brier score
  - [x] 2.2 `get_calibration_scores(conn)` — compute CalibrationEngine metrics: average Brier, beating-random flag (Brier < 0.25), agreement rate, sycophancy flag
  - [x] 2.3 `get_arena_comparison(conn)` — query `arena_decisions` JOIN `arena_forward_returns` for per-model stats grouped by session
- [x] Task 3: Create performance router `api/src/routers/performance.py` (AC: 1-4)
  - [x] 3.1 Create router following funnel/holdings pattern: independent section error handling, manual DB connection, connection closed in finally block
  - [x] 3.2 Query both portfolio.db and supervisor.db with separate error sections
  - [x] 3.3 Endpoint: `GET /api/performance` with no query params
- [x] Task 4: Register router in `api/src/main.py` (AC: 1-4)
  - [x] 4.1 Import and include `performance_router` following existing pattern
- [x] Task 5: Add test schema and data to `api/tests/conftest.py` (AC: 1-4)
  - [x] 5.1 Add `PORTFOLIO_PERFORMANCE_SCHEMA` with `sim_portfolio_snapshots` columns needed for performance (portfolio_value, spy_value, snapshot_date) — extend existing schema if needed
  - [x] 5.2 Add `SUPERVISOR_PERFORMANCE_SCHEMA` with `predictions`, `eval_results`, `arena_decisions`, `arena_forward_returns` tables
  - [x] 5.3 Add sample data for all performance-related tables
- [x] Task 6: Write endpoint tests in `api/tests/test_performance.py` (AC: 1-4)
  - [x] 6.1 Test: returns portfolio P&L, CAGR, SPY return, alpha when data exists
  - [x] 6.2 Test: returns prediction accuracy with hit rates per window
  - [x] 6.3 Test: returns calibration scores with beating_random and sycophancy flags
  - [x] 6.4 Test: returns arena comparison grouped by session/model
  - [x] 6.5 Test: returns section-level errors when portfolio.db unavailable
  - [x] 6.6 Test: returns section-level errors when supervisor.db unavailable
  - [x] 6.7 Test: returns empty/null sections gracefully when tables have no data

### Review Findings

- [x] [Review][Decision] AC2 missing calibration buckets — Deferred to Story 5.3 (Performance Tab UI) which explicitly builds calibration buckets chart
- [x] [Review][Patch] CAGR explodes on very short periods — Added minimum 7-day guard to _compute_cagr [api/src/db/portfolio.py]
- [x] [Review][Patch] _PORTFOLIO sentinel ticker filter — Added ticker='_PORTFOLIO' filter to all performance snapshot queries [api/src/db/portfolio.py]
- [x] [Review][Patch] Arena hit_rate diluted by unevaluated decisions — Added evaluated count column, hit_rate now uses evaluated denominator [api/src/db/supervisor.py]
- [x] [Review][Patch] Eval window normalization logging — Added logger.warning for unrecognized eval_window values [api/src/db/supervisor.py]
- [x] [Review][Patch] Bare except on trade_events count — Added logger.warning for trade_events query failures [api/src/db/portfolio.py]
- [x] [Review][Defer] Error messages leak internal filesystem paths [api/src/routers/performance.py:35] — deferred, pre-existing pattern across all routers (health, funnel, holdings)
- [x] [Review][Defer] No pagination or rate limiting on /api/performance — deferred, architecture explicitly defers pagination and caching

## Dev Notes

### Existing Code to Reuse (DO NOT recreate)

- **Router pattern:** `api/src/routers/funnel.py` and `api/src/routers/holdings.py` — follow exactly for independent section error handling
- **DB connection:** `api/src/db/connection.py` — `get_db_connection(path)` for read-only sqlite3
- **Config:** `api/src/config.py` — `settings.portfolio_db_path` and `settings.supervisor_db_path`
- **Portfolio queries:** `api/src/db/portfolio.py` — extend with performance functions
- **Supervisor queries:** `api/src/db/supervisor.py` — extend with prediction/arena functions
- **Test fixtures:** `api/tests/conftest.py` — `portfolio_db_path`, `supervisor_db_path`, `client` fixtures; extend schemas
- **Existing `sim_portfolio_snapshots` table** is already defined in conftest.py with columns: `id, snapshot_date, ticker, current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status` — the performance story needs **additional columns** on this table (portfolio_value, spy_value, total_pnl, total_pnl_pct) or a separate aggregation approach

### API Response Shape

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

  "prediction_accuracy": {
    "total_predictions": 150,
    "resolved_count": 120,
    "hit_rate": 0.65,
    "hit_rate_by_window": {
      "t_5": 0.58,
      "t_10": 0.62,
      "t_20": 0.65
    },
    "average_brier_score": 0.22
  },
  "prediction_accuracy_error": null,

  "calibration": {
    "average_brier_score": 0.22,
    "target_brier": 0.25,
    "beating_random": true,
    "agreement_rate": 0.78,
    "sycophancy_flag": false
  },
  "calibration_error": null,

  "arena_comparison": [
    {
      "model_id": "claude-sonnet",
      "session": "2026-03-arena-1",
      "total_decisions": 25,
      "hit_rate": 0.68,
      "average_alpha": 2.3,
      "total_cost": 15.50
    }
  ],
  "arena_comparison_error": null,

  "message": null
}
```

**Key:** All keys are `snake_case`. No response envelope. Each section has independent `_error` field. HTTP status codes carry success/failure signal.

### Architecture Compliance

**Stack:** FastAPI, raw sqlite3 with `?mode=ro`, parameterized SQL queries.

**Patterns to follow exactly:**

1. **Router pattern** (match funnel.py / holdings.py):
   ```python
   import logging
   from fastapi import APIRouter
   from src.config import settings
   from src.db.connection import get_db_connection

   router = APIRouter()
   logger = logging.getLogger(__name__)

   def _query_performance() -> dict:
       # Check portfolio DB path
       # Check supervisor DB path
       # Query each section independently with try/except
       # Close connections in finally blocks
       ...

   @router.get("/api/performance")
   def performance():
       return _query_performance()
   ```

2. **Multi-DB pattern** (this endpoint queries BOTH databases):
   - Open portfolio.db connection for portfolio_summary section
   - Open supervisor.db connection for prediction, calibration, arena sections
   - Each connection opened/closed independently
   - If one DB is unavailable, the other sections still return data

3. **Query function pattern** (match existing `get_open_positions`, `get_funnel_counts`):
   ```python
   def get_portfolio_performance(conn: sqlite3.Connection) -> dict:
       """Docstring explaining what is queried and computed."""
       rows = conn.execute("SELECT ... FROM ... WHERE ...", (param,)).fetchall()
       # Compute derived values in Python
       return { ... }
   ```

4. **Error handling:** Per-section `_error` fields. Never crash with 500. If a DB path is not configured, return all sections as null with error strings.

5. **Registration in main.py:**
   ```python
   from src.routers.performance import router as performance_router
   app.include_router(performance_router)
   ```

### Database Tables and Queries

**From portfolio.db:**

- `sim_portfolio_snapshots` — Already exists with per-ticker risk data. For performance, you need **aggregate portfolio-level** data. Check if this table has `portfolio_value` and `spy_value` columns. If not, compute portfolio P&L from `sim_positions` (sum of realized + unrealized gains). The exact schema must be verified against the actual database — the conftest schema may not have all production columns.

  Likely approach for portfolio P&L:
  - Sum unrealized P&L across all open positions from `sim_positions`
  - Sum realized P&L from `realized_gains` table (if it exists)
  - Total P&L = realized + unrealized
  - CAGR = ((end_value / start_value) ^ (365 / days)) - 1
  - SPY benchmark: check if stored in a column or a separate table

  **IMPORTANT:** The exact table/column names for portfolio-level P&L and SPY benchmark data must be inferred from the AC and PRD. The AC says "from `sim_portfolio_snapshots`" — check if this table has aggregate portfolio value columns or if you need to query `sim_positions` + `realized_gains`.

- `trade_events` — Already exists. Use `COUNT(DISTINCT id)` for total_trades.

**From supervisor.db (michael_supervisor.db):**

- `predictions` table — Expected columns: `id, ticker, scan_date, predicted_outcome, probability, eval_window (T+5/T+10/T+20), resolved, actual_outcome, brier_score, created_at`
- `eval_results` table — Expected columns: `id, prediction_id, eval_window, hit, forward_return, evaluated_at`
- `arena_decisions` table — Expected columns: `id, session_id, model_id, ticker, scan_date, decision, cost_usd, created_at`
- `arena_forward_returns` table — Expected columns: `id, arena_decision_id, forward_return, evaluated_at`

**NOTE:** These supervisor table schemas are inferred from the epics/PRD. The actual production tables may differ. Write queries defensively — handle missing columns or tables gracefully.

### CAGR Calculation

```python
import math
from datetime import date

def compute_cagr(start_value: float, end_value: float, start_date: str, end_date: str) -> float | None:
    """CAGR = (end/start)^(365/days) - 1, returned as percentage."""
    if start_value <= 0 or end_value <= 0:
        return None
    try:
        d1 = date.fromisoformat(start_date)
        d2 = date.fromisoformat(end_date)
        days = (d2 - d1).days
        if days <= 0:
            return None
        cagr = (math.pow(end_value / start_value, 365 / days) - 1) * 100
        return round(cagr, 2)
    except (ValueError, TypeError):
        return None
```

### Testing Requirements

**Test file:** `api/tests/test_performance.py`

**Schema additions to conftest.py:**

The `sim_portfolio_snapshots` table already exists but may need additional columns for portfolio-level metrics. Add new tables for supervisor performance data:

```sql
-- Add to supervisor schema (conftest.py)
CREATE TABLE predictions (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    scan_date TEXT NOT NULL,
    predicted_outcome TEXT,
    probability REAL,
    eval_window TEXT,
    resolved INTEGER DEFAULT 0,
    actual_outcome TEXT,
    brier_score REAL,
    created_at TEXT
);

CREATE TABLE eval_results (
    id INTEGER PRIMARY KEY,
    prediction_id INTEGER,
    eval_window TEXT NOT NULL,
    hit INTEGER NOT NULL DEFAULT 0,
    forward_return REAL,
    evaluated_at TEXT
);

CREATE TABLE arena_decisions (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    scan_date TEXT NOT NULL,
    decision TEXT NOT NULL,
    cost_usd REAL DEFAULT 0.0,
    created_at TEXT
);

CREATE TABLE arena_forward_returns (
    id INTEGER PRIMARY KEY,
    arena_decision_id INTEGER NOT NULL,
    forward_return REAL,
    evaluated_at TEXT
);
```

**Test cases (match existing test pattern using `client` and DB path fixtures):**

1. `test_performance_returns_portfolio_summary` — Verify P&L, CAGR, SPY return, alpha present
2. `test_performance_returns_prediction_accuracy` — Verify hit rates per window, Brier score
3. `test_performance_returns_calibration` — Verify beating_random, sycophancy_flag, agreement_rate
4. `test_performance_returns_arena_comparison` — Verify per-model stats grouped by session
5. `test_performance_portfolio_db_unavailable` — portfolio_summary_error set, other sections may still work
6. `test_performance_supervisor_db_unavailable` — prediction/calibration/arena errors set, portfolio summary still works
7. `test_performance_empty_tables` — All sections return null/empty gracefully with no errors
8. `test_performance_partial_data` — Some tables have data, others empty

**Test pattern** (match `test_funnel.py` / `test_holdings.py`):
```python
def test_performance_returns_portfolio_summary(client, portfolio_db_path, supervisor_db_path, monkeypatch):
    monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
    resp = client.get("/api/performance")
    assert resp.status_code == 200
    data = resp.json()
    assert data["portfolio_summary"] is not None
    assert data["portfolio_summary_error"] is None
    # ... check specific fields
```

### What NOT To Do

- Do NOT create an ORM model — use raw sqlite3 queries matching all existing code
- Do NOT add a response envelope `{ "data": ..., "success": true }` — return data directly
- Do NOT use string interpolation in SQL — always parameterized queries with `?`
- Do NOT add authentication — deferred per architecture
- Do NOT add server-side caching — client-side TanStack Query handles freshness
- Do NOT create separate files for CAGR calculation — inline in the query function
- Do NOT modify existing `sim_portfolio_snapshots` queries in portfolio.py — add new functions
- Do NOT add query params to the endpoint — AC specifies no params for `GET /api/performance`
- Do NOT use FastAPI dependency injection for DB connections — match the manual connection pattern used by funnel.py and holdings.py

### Previous Story Intelligence

**From Story 4.2 (Holdings Tab — most recent story in review):**
- Router pattern is well-established: `_query_*()` helper function + single `@router.get()` function
- Independent `_error` fields per section for partial degradation
- Connection closed in `finally` block
- `monkeypatch.setattr` used in tests to set DB paths
- All 106 tests passing across 15 test files — zero regressions expected

**From Story 4.1 (Holdings API):**
- `sim_portfolio_snapshots` table confirmed with columns: snapshot_date, ticker, current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status
- Per-ticker data uses `MAX(snapshot_date)` subquery for latest
- portfolio.py functions return `list[dict]` or `dict[str, dict]`

**From Story 3.1 (Funnel API):**
- When DB path is empty, return all sections as null with error strings
- When connection fails, same pattern
- `get_latest_scan_date()` pattern for finding most recent data

**Cross-epic note:** This is the first story that requires data from BOTH databases simultaneously (portfolio.db for P&L, supervisor.db for predictions/arena). The health endpoint also queries both, but via separate routes. Model the dual-DB pattern on how the health router handles both DBs — open and close each independently.

### Git Intelligence

Recent commits show a batch implementation approach (Stories 1.3 through 4.2 in one commit). The codebase is stable with all tests passing. No breaking changes or migrations in progress.

Commit pattern: `Story X.Y: Description of what was implemented`

### Project Structure Notes

All files go in existing directories — no new directories needed:

| New File | Location |
|----------|----------|
| Performance router | `api/src/routers/performance.py` |
| Performance tests | `api/tests/test_performance.py` |

| Modified File | Change |
|---------------|--------|
| `api/src/main.py` | Import + include performance_router |
| `api/src/db/portfolio.py` | Add `get_portfolio_performance()` function |
| `api/src/db/supervisor.py` | Add `get_prediction_accuracy()`, `get_calibration_scores()`, `get_arena_comparison()` |
| `api/tests/conftest.py` | Add predictions, eval_results, arena_decisions, arena_forward_returns schemas + sample data; potentially extend sim_portfolio_snapshots |

### References

- [Source: epics.md#Epic 5, Story 5.1] — User story, acceptance criteria
- [Source: architecture.md#API Patterns] — GET /api/performance, snake_case, no envelope
- [Source: architecture.md#Data Architecture] — Performance staleTime 60min
- [Source: architecture.md#DB Access Boundary] — SQL only in api/src/db/, routers call db functions
- [Source: architecture.md#Decision Priority] — Direct SQLite read, REST all-GET
- [Source: ux-design-specification.md#Performance Tab] — Charts side-by-side desktop, stacked mobile, KPI row
- [Source: api/src/routers/funnel.py] — Router pattern with independent section error handling
- [Source: api/src/routers/holdings.py] — Multi-section query + data merge pattern
- [Source: api/src/db/portfolio.py] — Query function patterns, sim_portfolio_snapshots usage
- [Source: api/src/db/supervisor.py] — Supervisor DB query patterns
- [Source: api/src/db/connection.py] — get_db_connection() read-only pattern
- [Source: api/src/config.py] — Settings with portfolio_db_path and supervisor_db_path
- [Source: api/tests/conftest.py] — Test fixture patterns, existing schemas
- [Source: 4-2-holdings-tab-positions-table-with-pnl-and-risk-status.md] — Latest story patterns and learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Added `get_portfolio_performance()` and `_compute_cagr()` to portfolio.py — queries sim_portfolio_snapshots for aggregate portfolio_value/spy_value, computes P&L, CAGR, SPY return, alpha, total_trades
- Added `get_prediction_accuracy()`, `get_calibration_scores()`, `get_arena_comparison()` to supervisor.py — queries predictions, eval_results, arena_decisions, arena_forward_returns tables
- Created performance router querying BOTH portfolio.db and supervisor.db with independent section error handling — each DB connection opened/closed independently, partial failures return _error per section
- Extended sim_portfolio_snapshots schema with portfolio_value and spy_value columns; added 4 new supervisor tables (predictions, eval_results, arena_decisions, arena_forward_returns) with sample data
- 25 new tests across query-level and endpoint-level covering: P&L/CAGR/SPY/alpha, prediction accuracy with per-window hit rates, calibration with beating_random/sycophancy flags, arena comparison grouped by session/model, section-level degradation for each DB, empty tables graceful handling
- All 121 tests pass (up from 106), zero regressions

### Change Log

- 2026-04-06: Story 5.1 implementation complete — Performance API endpoint with portfolio P&L, prediction accuracy, calibration scores, arena comparison

### File List

New files:
- api/src/routers/performance.py
- api/tests/test_performance.py

Modified files:
- api/src/main.py (added performance_router import and registration)
- api/src/db/portfolio.py (added get_portfolio_performance, _compute_cagr)
- api/src/db/supervisor.py (added get_prediction_accuracy, get_calibration_scores, get_arena_comparison)
- api/tests/conftest.py (extended sim_portfolio_snapshots schema, added performance schemas/fixtures/sample data)
