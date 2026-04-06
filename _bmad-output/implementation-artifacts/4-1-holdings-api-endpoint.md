# Story 4.1: Holdings API Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns all current open positions with P&L and risk data,
so that the Holdings tab can display my portfolio.

## Acceptance Criteria

1. **Given** the API is running **When** I call `GET /api/holdings` **Then** I receive JSON with all open positions from `sim_positions WHERE status='open'` including: ticker, sector, entry_price, entry_date, current_price, shares, unrealized P&L (absolute and %), sleeve allocation, stop_loss, target_1, target_2, conviction, days_held.

2. **Given** the response includes position data **When** Guardian risk rule status is requested **Then** each position includes: current stop level, exit stage (initial/breakeven/trailing), portfolio heat contribution, and sector concentration status from the latest `sim_portfolio_snapshots`.

3. **Given** the API queries open positions **When** the query executes **Then** all reads use `?mode=ro` and complete within 500ms.

## Tasks / Subtasks

- [x] Task 1: Add holdings DB query functions to `api/src/db/portfolio.py` (AC: #1, #2, #3)
  - [x] 1.1: Add `get_open_positions(conn)` — query `sim_positions WHERE status='open'`. Return list of dicts with: ticker, sector, entry_price, entry_date, current_price, shares, unrealized_pnl (current_price - entry_price) * shares, unrealized_pnl_pct ((current_price - entry_price) / entry_price * 100), sleeve, stop_loss, target_1, target_2, conviction, days_held (computed from entry_date to today).
  - [x] 1.2: Add `get_portfolio_risk_data(conn)` — query latest `sim_portfolio_snapshots` for risk data. Return dict keyed by ticker with: current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status. If no snapshot data exists, return empty dict (positions still display without risk overlay).

- [x] Task 2: Create holdings router `api/src/routers/holdings.py` (AC: #1, #2, #3)
  - [x] 2.1: Create `api/src/routers/holdings.py` with `router = APIRouter()` and `@router.get("/api/holdings")` endpoint.
  - [x] 2.2: Follow the funnel.py pattern — manual connection via `get_db_connection(settings.portfolio_db_path)` with error handling for missing/inaccessible DB. Two sections: `positions` and `risk_data`, each with `_error` companion field.
  - [x] 2.3: Response shape:
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
  - [x] 2.4: Merge risk data into positions — after querying both, iterate positions and attach matching risk fields from risk_data dict (keyed by ticker). If no risk data for a ticker, set risk fields to null.
  - [x] 2.5: When no open positions exist, return empty array with `message: "No open positions"`.

- [x] Task 3: Register holdings router in `api/src/main.py` (AC: #1)
  - [x] 3.1: Import `holdings_router` from `src.routers.holdings` and add `app.include_router(holdings_router)`.

- [x] Task 4: Write tests (AC: #1, #2, #3)
  - [x] 4.1: Update `api/tests/conftest.py` — add `PORTFOLIO_HOLDINGS_SCHEMA` and `PORTFOLIO_HOLDINGS_SAMPLE_DATA` with `sim_positions` and `sim_portfolio_snapshots` tables. Add `holdings_db_path` fixture OR extend `portfolio_db_path` with holdings tables.
  - [x] 4.2: Create `api/tests/test_holdings.py` — tests:
    - GET /api/holdings returns 200 with positions array
    - Positions include all required fields (ticker, sector, entry_price, etc.)
    - Unrealized P&L calculated correctly (absolute and %)
    - days_held computed from entry_date
    - Risk data merged into positions (exit_stage, heat contribution, etc.)
    - Positions without risk data have null risk fields
    - No open positions returns empty array with message
    - When portfolio DB unavailable, returns degraded response (not 500)
    - Independent section degradation (positions_error vs risk_data_error)
    - Only open positions returned (closed positions excluded)

### Review Findings

- [x] [Review][Patch] Risk query uses global MAX(snapshot_date) instead of per-ticker MAX — fixed: uses INNER JOIN with per-ticker GROUP BY for latest snapshot. [api/src/db/portfolio.py:204-215] (edge+auditor)
- [x] [Review][Patch] NULL numeric columns (entry_price, current_price, shares) cause unhandled TypeError in P&L arithmetic — fixed: added None guards, returns null P&L fields. [api/src/db/portfolio.py:162-167] (edge)
- [x] [Review][Patch] No test for per-ticker risk date resolution — fixed: added test_per_ticker_latest_date with tickers on different snapshot dates. [api/tests/test_holdings.py] (edge+auditor)
- [x] [Review][Patch] No test for NULL price/shares values from DB — fixed: added test_null_numeric_columns_handled_gracefully. [api/tests/test_holdings.py] (edge)
- [x] [Review][Defer] `date.today()` in get_open_positions is non-deterministic — makes days_held assertions date-dependent. Could freeze time in tests. [api/src/db/portfolio.py:154] — deferred, test computes expected value dynamically so assertions are correct
- [x] [Review][Defer] No pagination or row limit on positions query — `.fetchall()` with no LIMIT. [api/src/db/portfolio.py:146] — deferred, single-user dashboard unlikely to have large position counts
- [x] [Review][Defer] Exception detail leaks filesystem paths to API consumers — pre-existing pattern from health.py and all other routers. [api/src/routers/holdings.py:41,60,69] — deferred, acceptable for internal dashboard
- [x] [Review][Defer] No authentication on /api/holdings — architecture doc explicitly defers auth to post-MVP. [api/src/routers/holdings.py:85] — deferred per architecture decision
- [x] [Review][Defer] Floating-point P&L arithmetic instead of Decimal — `round(..., 2)` on float multiplication may have sub-cent artifacts. [api/src/db/portfolio.py:162] — deferred, acceptable precision for dashboard display

## Dev Notes

### Existing Code to Reuse (DO NOT recreate)

| Module | Location | Reuse |
|--------|----------|-------|
| `get_db_connection()` | `api/src/db/connection.py` | Read-only sqlite3 connection with `?mode=ro` and `Row` factory |
| `settings.portfolio_db_path` | `api/src/config.py` | Portfolio DB path from env |
| Funnel router pattern | `api/src/routers/funnel.py` | **Primary pattern reference** — manual connection, section-level try/except, `_error` fields, connection closed in finally |
| `get_latest_scan_date()` | `api/src/db/portfolio.py` | NOT needed for holdings (no date filter) but same query pattern |
| Test fixtures | `api/tests/conftest.py` | Extend for holdings tables — follow existing `PORTFOLIO_FUNNEL_SCHEMA` pattern |

### Portfolio Database Schema — Relevant Tables

**`sim_positions` table** (simulated trading positions):
```sql
-- Expected columns: id, ticker, sector, entry_price, entry_date, current_price, shares,
--   status (open/closed), sleeve (1 or 2), stop_loss, target_1, target_2,
--   conviction (high/medium/low), created_at, updated_at
-- Filter: WHERE status = 'open' for current holdings
-- days_held: compute as julianday('now') - julianday(entry_date) or compute in Python
-- unrealized_pnl: compute as (current_price - entry_price) * shares
-- unrealized_pnl_pct: compute as (current_price - entry_price) / entry_price * 100
```

**`sim_portfolio_snapshots` table** (Guardian risk snapshots):
```sql
-- Expected columns: id, snapshot_date, ticker, current_stop_level, exit_stage,
--   portfolio_heat_contribution, sector_concentration_status, created_at
-- exit_stage values: 'initial', 'breakeven', 'trailing'
-- sector_concentration_status values: 'ok', 'warning', 'critical'
-- Use the LATEST snapshot per ticker (MAX snapshot_date or most recent created_at)
```

**IMPORTANT:** These schema definitions are inferred from the epics and PRD. The actual column names in production may differ. The dev agent MUST:
1. Create test tables with these schemas in conftest.py
2. Write queries using these column names
3. Handle gracefully if a table or column doesn't exist in production (return error string, not crash)

### Router Pattern (follow funnel.py exactly)

The holdings router MUST follow the funnel.py pattern:
- Manual connection via `get_db_connection(settings.portfolio_db_path)` (NOT FastAPI `Depends()`)
- Path/connection error handling at the top (return all-null response with errors)
- Section-level try/except inside the connection block
- Each section has `_error` companion field (null when OK, string when failed)
- Close connection in `finally` block

```python
# Pattern reference:
def _query_holdings(self) -> dict:
    path = settings.portfolio_db_path
    if not path:
        db_error = "portfolio.db not accessible: path not configured"
        return {
            "positions": None, "positions_error": db_error,
            "risk_data_error": db_error, "message": None,
        }
    try:
        conn = get_db_connection(path)
    except Exception as exc:
        db_error = f"portfolio.db not accessible: {exc}"
        return {
            "positions": None, "positions_error": db_error,
            "risk_data_error": db_error, "message": None,
        }

    result: dict = {"message": None}
    try:
        # Positions section
        try:
            positions = get_open_positions(conn)
            # ... merge risk data ...
            result["positions"] = positions
            result["positions_error"] = None
        except Exception as exc:
            result["positions"] = None
            result["positions_error"] = str(exc)

        # Risk data section
        try:
            risk_data = get_portfolio_risk_data(conn)
            result["risk_data_error"] = None
            # merge into positions if both available
        except Exception as exc:
            result["risk_data_error"] = str(exc)
    finally:
        conn.close()
    return result
```

### P&L Computation

Compute in Python (not SQL) for clarity and testability:
- `unrealized_pnl = (current_price - entry_price) * shares` — absolute dollar P&L
- `unrealized_pnl_pct = ((current_price - entry_price) / entry_price) * 100` — percentage
- `days_held = (date.today() - date.fromisoformat(entry_date)).days` — integer days
- Round `unrealized_pnl` to 2 decimal places, `unrealized_pnl_pct` to 2 decimal places
- Handle edge case: `entry_price == 0` → set `unrealized_pnl_pct` to null (avoid division by zero)

### Risk Data Merge Strategy

1. Query positions and risk data as two independent sections
2. Build `risk_dict: dict[str, dict]` keyed by ticker from `get_portfolio_risk_data()`
3. Iterate positions and merge: `position.update(risk_dict.get(ticker, default_risk_nulls))`
4. Default risk fields when no data: `current_stop_level: null, exit_stage: null, portfolio_heat_contribution: null, sector_concentration_status: null`
5. If risk query fails but positions succeed → positions returned with null risk fields + `risk_data_error` populated

### Test Fixture Strategy

Extend `api/tests/conftest.py` with:

```python
PORTFOLIO_HOLDINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS sim_positions (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    sector TEXT,
    entry_price REAL NOT NULL,
    entry_date TEXT NOT NULL,
    current_price REAL NOT NULL,
    shares REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    sleeve INTEGER DEFAULT 1,
    stop_loss REAL,
    target_1 REAL,
    target_2 REAL,
    conviction TEXT DEFAULT 'medium',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sim_portfolio_snapshots (
    id INTEGER PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    current_stop_level REAL,
    exit_stage TEXT DEFAULT 'initial',
    portfolio_heat_contribution REAL DEFAULT 0.0,
    sector_concentration_status TEXT DEFAULT 'ok',
    created_at TEXT
);
"""
```

Use `CREATE TABLE IF NOT EXISTS` since the portfolio_db_path fixture may already have funnel tables. Sample data should include:
- 3-4 open positions with varied P&L (positive, negative, near zero)
- 1 closed position (to verify filtering)
- Risk snapshot data for 2-3 tickers (leave one without to test null risk fields)
- Different sleeves, convictions, exit stages

### Response Shape (exact contract)

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

**Key patterns (match existing endpoints):**
- Each section has `_error` companion field (null when OK, string when failed)
- Risk fields merged directly into position objects (flat structure, no nesting)
- All keys `snake_case`
- No envelope wrapper — return the dict directly
- `message` is null normally, or "No open positions" when positions array is empty
- Numeric fields: `unrealized_pnl` and `unrealized_pnl_pct` are floats rounded to 2dp
- `days_held` is integer
- `sleeve` is integer (1 or 2)
- `portfolio_heat_contribution` is float (0.0-1.0 range)

### New Files to Create

| File | Purpose |
|------|---------|
| `api/src/routers/holdings.py` | GET /api/holdings endpoint |
| `api/tests/test_holdings.py` | Endpoint and query tests |

### Files to Modify

| File | Change |
|------|--------|
| `api/src/db/portfolio.py` | Add `get_open_positions()` and `get_portfolio_risk_data()` functions |
| `api/src/main.py` | Register holdings_router |
| `api/tests/conftest.py` | Add `PORTFOLIO_HOLDINGS_SCHEMA`, `PORTFOLIO_HOLDINGS_SAMPLE_DATA`, extend portfolio_db_path fixture |

### What NOT To Do

- Do NOT create any frontend files — this is an API-only story (Story 4.2 handles the UI)
- Do NOT create new DB tables or write to any database — read-only, always
- Do NOT use an ORM — raw sqlite3 with parameterized queries only
- Do NOT install new Python packages — use what's already in pyproject.toml
- Do NOT create a camelCase response — all keys `snake_case`
- Do NOT wrap response in `{ "data": ..., "success": true }` envelope
- Do NOT add authentication — deferred per architecture doc
- Do NOT modify the health, supervisor, or funnel routers — they're done
- Do NOT create frontend types, hooks, or route files — Story 4.2 scope
- Do NOT use `Depends(get_portfolio_db)` — follow funnel.py pattern with manual connection
- Do NOT nest risk data as a sub-object — merge flat into each position dict
- Do NOT parse JSON columns (data/details) — return as raw strings (pre-existing pattern)

### Previous Story Intelligence

**From Story 3.1 (Funnel API endpoint) — most recent API story:**
- Manual connection via `get_db_connection(settings.portfolio_db_path)` (not Depends)
- Section-level try/except with `_error` companion fields
- `get_latest_scan_date()` pattern for date resolution (not needed here — holdings has no date filter)
- Test fixtures: `PORTFOLIO_FUNNEL_SCHEMA` + `PORTFOLIO_FUNNEL_SAMPLE_DATA` in conftest.py
- Test monkeypatch: `monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)`
- 17 tests covering: query functions, endpoint happy path, defaults, no-data, degraded, independent degradation
- Review findings: added `logger.warning` for unknown enum values, used `GROUP BY` for dedup

**From Story 3.1 Review Findings:**
- Handle unknown enum values with `logger.warning` before fallback
- Use `GROUP BY` instead of `SELECT DISTINCT` when dedup matters
- Document data source limitations in docstrings
- Accept "no input validation on params" as deferred for MVP

**From Story 2.1 (Supervisor API endpoint):**
- Return shallow copies of mutable dicts
- Use exact `IN (...)` lists instead of `LIKE` patterns for filters
- Test independent section degradation (one section fails, others succeed)
- `data`/`details` columns returned as raw strings — frontend parses JSON

**From conftest.py current state:**
- `portfolio_db_path` fixture creates DB with funnel tables (scout_candidates, rejection_log, guardian_decisions, trade_events)
- Holdings tables (sim_positions, sim_portfolio_snapshots) must be ADDED to this fixture using `CREATE TABLE IF NOT EXISTS`
- `client` fixture creates TestClient from `src.main.app`
- Monkeypatch pattern: `monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)`

### Architecture Compliance

- **Endpoint path**: `GET /api/holdings` (matches architecture API design)
- **Query params**: None required (returns all open positions)
- **Response format**: Direct JSON, no envelope wrapper
- **Error shape**: Section-level `_error` fields for partial degradation
- **DB access**: Read-only via `get_db_connection()` to portfolio.db
- **SQL**: Parameterized queries only — no string interpolation
- **Tests**: `api/tests/test_holdings.py` (separate directory per Python convention)
- **No new dependencies**: Uses existing fastapi, sqlite3 stack
- **Caching**: Holdings staleTime 5min (frontend concern, Story 4.2)
- **Tab mapping**: Holdings → `holdings.py` router → `portfolio.py` DB module (per architecture doc)
- **Performance**: Query must complete within 500ms (AC #3)

### Project Structure Notes

Alignment with established project structure:
- `api/src/routers/holdings.py` follows `api/src/routers/{funnel,supervisor,health}.py` naming
- `api/src/db/portfolio.py` is the correct module for portfolio.db queries (funnel queries already here)
- `api/tests/test_holdings.py` follows `api/tests/test_{funnel,supervisor,health}.py` naming
- No new directories needed — all files go in existing locations

### References

- [Source: epics.md#Story 4.1] — Acceptance criteria, user story, field list
- [Source: architecture.md#API Patterns] — REST API design, `GET /api/holdings`
- [Source: architecture.md#Data Architecture] — portfolio.db tables, caching strategy (5min staleTime)
- [Source: architecture.md#Implementation Patterns] — Naming, structure, snake_case everywhere
- [Source: ux-design-specification.md#Holdings] — P&L color coding, data density, "What's my P&L?" question
- [Source: api/src/routers/funnel.py] — Primary router pattern reference
- [Source: api/src/db/portfolio.py] — Existing portfolio DB query functions
- [Source: api/src/db/connection.py] — DB connection functions
- [Source: api/tests/conftest.py] — Test fixture patterns
- [Source: 3-1-funnel-api-endpoint.md] — Previous story learnings and patterns
- [Source: 2-1-supervisor-api-endpoint.md] — Earlier API story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debug issues.

### Completion Notes List

- Implemented 2 portfolio DB query functions: `get_open_positions` (filters open positions, computes P&L and days_held), `get_portfolio_risk_data` (latest snapshot per ticker)
- Created holdings router following funnel.py pattern: manual connection, section-level try/except, `_error` companion fields
- Response shape matches exact contract: positions with flat risk fields merged in, `positions_error`, `risk_data_error`, `message`
- P&L computed in Python: unrealized_pnl (absolute $), unrealized_pnl_pct (%), both rounded to 2dp
- days_held computed from entry_date to today, handles invalid dates gracefully
- Entry price zero edge case: unrealized_pnl_pct set to null (avoids division by zero)
- Risk data merge: positions without risk snapshots get null risk fields
- Independent section degradation: risk query can fail while positions still return
- Graceful degradation: DB unavailable returns 200 with error strings, not 500
- 22 new tests: 8 query-level (open positions, P&L math, risk data), 11 endpoint-level (happy path, merged fields, null risk, empty, degraded, independent degradation, rounding), 3 edge cases
- 94 total tests pass with zero regressions in 0.30s
- Extended conftest.py with holdings schema (sim_positions, sim_portfolio_snapshots) and representative sample data (4 open positions, 1 closed, risk snapshots with date variation)

### Change Log

- 2026-04-05: Implemented Story 4.1 — Holdings API endpoint with query functions, router, tests

### File List

New files:
- api/src/routers/holdings.py
- api/tests/test_holdings.py

Modified files:
- api/src/db/portfolio.py
- api/src/main.py
- api/tests/conftest.py
