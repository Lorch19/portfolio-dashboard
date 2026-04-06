# Story 3.1: Funnel API Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns funnel data showing how candidates were filtered at each pipeline stage,
so that the Funnel tab can visualize the decision drop-off.

## Acceptance Criteria

1. **Given** the API is running **When** I call `GET /api/funnel?scan_date=2026-04-04` **Then** I receive JSON with counts at each stage: Scout universe size, Scout candidates (passed gates), Guardian approved, Guardian modified, Guardian rejected, and Michael acted (traded).

2. **Given** I call `GET /api/funnel?scan_date=2026-04-04` **When** the response includes drill-down data **Then** each stage includes a list of tickers with: ticker symbol, the stage where it was filtered, and the reason (rejection_reason from `rejection_log`, decision from `guardian_decisions`, or trade action from `trade_events`).

3. **Given** I call `GET /api/funnel` without a scan_date **When** the endpoint processes the request **Then** it defaults to the most recent scan date available in `scout_candidates`.

4. **Given** I call `GET /api/funnel?scan_date=2026-04-04` and no data exists for that date **When** the endpoint processes the request **Then** it returns an empty funnel with zero counts and a clear message.

## Tasks / Subtasks

- [x] Task 1: Add portfolio DB query functions to `api/src/db/portfolio.py` (AC: #1, #2, #3, #4)
  - [x] 1.1: Add `get_latest_scan_date(conn)` — query `scout_candidates` for `MAX(scan_date)`. Return the date string or None if table is empty.
  - [x] 1.2: Add `get_funnel_counts(conn, scan_date)` — query counts at each stage for the given scan_date. Return dict with: `scout_universe` (total rows in scout_candidates for date), `scout_passed` (rows where `passed_gates = 1`), `guardian_approved` (rows in guardian_decisions where `decision = 'approve'`), `guardian_modified` (decision = 'modify'), `guardian_rejected` (decision = 'reject'), `michael_traded` (count of distinct tickers in trade_events for date).
  - [x] 1.3: Add `get_funnel_drilldown(conn, scan_date)` — query per-ticker details at each stage. Return list of dicts, each with: `ticker`, `stage` (scout_rejected / guardian_approved / guardian_modified / guardian_rejected / traded), `reason` (from rejection_log.rejection_reason, guardian_decisions.decision, or trade_events action). Combine data from `scout_candidates`, `rejection_log`, `guardian_decisions`, and `trade_events`.

- [x] Task 2: Create funnel router `api/src/routers/funnel.py` (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `api/src/routers/funnel.py` with `router = APIRouter()` and `@router.get("/api/funnel")` endpoint. Accept optional `scan_date: str | None = None` query parameter.
  - [x] 2.2: Follow the supervisor.py pattern — manual connection via `get_db_connection(settings.portfolio_db_path)` with error handling for missing/inaccessible DB. Section-level `_error` fields for partial degradation.
  - [x] 2.3: Response shape:
    ```json
    {
      "scan_date": "2026-04-04",
      "stages": {
        "scout_universe": 1520,
        "scout_passed": 45,
        "guardian_approved": 12,
        "guardian_modified": 3,
        "guardian_rejected": 30,
        "michael_traded": 8
      },
      "stages_error": null,
      "drilldown": [
        { "ticker": "AAPL", "stage": "guardian_approved", "reason": "approve" },
        { "ticker": "MSFT", "stage": "guardian_rejected", "reason": "sector_concentration" }
      ],
      "drilldown_error": null,
      "message": null
    }
    ```
  - [x] 2.4: When no scan_date param provided, call `get_latest_scan_date()` and use that. When no data exists for the date, return zero counts and `message: "No funnel data for {scan_date}"`.

- [x] Task 3: Register funnel router in `api/src/main.py` (AC: #1)
  - [x] 3.1: Import `funnel_router` from `src.routers.funnel` and add `app.include_router(funnel_router)` following the existing pattern.

- [x] Task 4: Write tests (AC: #1, #2, #3, #4)
  - [x] 4.1: Update `api/tests/conftest.py` — add portfolio DB schema and sample data: `scout_candidates`, `rejection_log`, `guardian_decisions`, `trade_events` tables with representative test rows for a specific scan_date. Update `portfolio_db_path` fixture to create real schema instead of placeholder.
  - [x] 4.2: Create `api/tests/test_funnel.py` — tests:
    - GET /api/funnel?scan_date=2026-04-04 returns 200 with correct stage counts
    - Stage counts match expected totals from test data
    - Drilldown includes per-ticker stage and reason
    - GET /api/funnel (no date) defaults to latest scan_date
    - GET /api/funnel?scan_date=2099-01-01 (no data) returns zero counts + message
    - When portfolio DB is unavailable, returns degraded response (not 500)
    - Each section independently degrades (stages_error vs drilldown_error)

### Review Findings

- [x] [Review][Decision] Drilldown returns duplicate tickers — intentional: shows full pipeline history per ticker. Documented in docstring.
- [x] [Review][Decision] Scout rejected count source mismatch — accepted: counts are authoritative, drilldown is best-effort. Documented in docstring.
- [x] [Review][Patch] `get_funnel_counts` and drilldown inconsistent for unknown `decision` values — added `logger.warning` for unknown guardian decision values.
- [x] [Review][Patch] `get_latest_scan_date` dead guard — fixed: `return row["latest"]` (removed unreachable `if row` guard).
- [x] [Review][Patch] `SELECT DISTINCT ticker, action` can return multiple rows per ticker — fixed: changed to `GROUP BY ticker` for one entry per ticker.
- [x] [Review][Patch] `stage_map.get(decision, f"guardian_{decision}")` silently accepts unknown decisions — fixed: added warning log before fallback.
- [x] [Review][Defer] No input validation on `scan_date` format — accepts any string, returns zero counts instead of 400. [api/src/routers/funnel.py:108] — deferred, not in AC scope
- [x] [Review][Defer] No test for whitespace-only `scan_date` parameter — cosmetic message issue. [api/tests/test_funnel.py] — deferred, low-priority edge case

## Dev Notes

### Existing Code to Reuse (DO NOT recreate)

| Module | Location | Reuse |
|--------|----------|-------|
| `get_portfolio_db()` | `api/src/db/connection.py` | FastAPI dependency for portfolio DB connection |
| `get_db_connection()` | `api/src/db/connection.py` | Direct connection function used in routers |
| `settings.portfolio_db_path` | `api/src/config.py` | Portfolio DB path from env |
| Supervisor router pattern | `api/src/routers/supervisor.py` | **Primary pattern reference** — manual connection, section-level try/except, `_error` fields |
| Health router pattern | `api/src/routers/health.py` | Alternative reference for router structure |
| Test fixtures | `api/tests/conftest.py` | Extend for portfolio DB schema — currently placeholder |

### Portfolio Database Schema (portfolio.db) — Relevant Tables

The portfolio.db has 28 tables. The funnel endpoint needs these 4:

**`scout_candidates` table** (scout scan results per date):
```sql
-- Expected columns: id, scan_date, ticker, sector, passed_gates (0/1), gate_scores (JSON), created_at
-- scan_date is the key filter. passed_gates=1 means ticker passed Scout screening.
-- Universe size = all rows for date. Passed = rows where passed_gates=1.
```

**`rejection_log` table** (tickers rejected at various pipeline stages):
```sql
-- Expected columns: id, scan_date, ticker, rejection_gate, rejection_reason, created_at
-- rejection_gate indicates which stage rejected: 'scout', 'guardian', etc.
-- rejection_reason is the human-readable reason string
```

**`guardian_decisions` table** (Guardian approve/modify/reject per ticker):
```sql
-- Expected columns: id, scan_date, ticker, decision (approve/modify/reject), conviction, thesis, created_at
-- decision values: 'approve', 'modify', 'reject'
-- This is the authoritative source for Guardian-stage outcomes
```

**`trade_events` table** (actual trades executed by Michael):
```sql
-- Expected columns: id, scan_date, ticker, action (buy/sell), shares, price, estimated_cost_dollars, created_at
-- Trades here represent Michael's actual executions
```

**IMPORTANT:** These schema definitions are inferred from the PRD and epics. The actual column names in production may differ slightly. The dev agent MUST:
1. Create test tables with these schemas in conftest.py
2. Write queries using these column names
3. Handle gracefully if a table or column doesn't exist in production (return error, not crash)

### Router Pattern (follow supervisor.py exactly)

The funnel router should follow the supervisor.py pattern, NOT the health.py pattern:
- Manual connection via `get_db_connection(settings.portfolio_db_path)` (not Depends)
- Path/connection error handling at the top (return all-null response with errors)
- Section-level try/except inside the connection block
- Each section has `_error` companion field
- Close connection in finally block

```python
# Pattern reference from supervisor.py:
def _query_funnel_sections(scan_date: str) -> dict:
    path = settings.portfolio_db_path
    if not path:
        db_error = "portfolio.db not accessible: path not configured"
        return {
            "stages": None, "stages_error": db_error,
            "drilldown": None, "drilldown_error": db_error,
        }
    try:
        conn = get_db_connection(path)
    except Exception as exc:
        db_error = f"portfolio.db not accessible: {exc}"
        return {
            "stages": None, "stages_error": db_error,
            "drilldown": None, "drilldown_error": db_error,
        }
    result: dict = {}
    try:
        # stages section
        try:
            result["stages"] = get_funnel_counts(conn, scan_date)
            result["stages_error"] = None
        except Exception as exc:
            result["stages"] = None
            result["stages_error"] = str(exc)
        # drilldown section
        try:
            result["drilldown"] = get_funnel_drilldown(conn, scan_date)
            result["drilldown_error"] = None
        except Exception as exc:
            result["drilldown"] = None
            result["drilldown_error"] = str(exc)
    finally:
        conn.close()
    return result
```

### Test Pattern (follow test_supervisor.py)

- Extend conftest.py `portfolio_db_path` fixture: replace placeholder with real portfolio tables
- Add `PORTFOLIO_FUNNEL_SCHEMA` and `PORTFOLIO_FUNNEL_SAMPLE_DATA` SQL blocks
- Sample data should include a specific scan_date (e.g., "2026-04-04") with:
  - ~10 scout_candidates rows (some passed_gates=1, some passed_gates=0)
  - ~3 rejection_log rows for rejected tickers
  - ~5 guardian_decisions rows (mix of approve/modify/reject)
  - ~2 trade_events rows for traded tickers
- Test monkeypatch pattern: `monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)`

### Response Shape (exact contract)

```json
{
  "scan_date": "2026-04-04",
  "stages": {
    "scout_universe": 1520,
    "scout_passed": 45,
    "guardian_approved": 12,
    "guardian_modified": 3,
    "guardian_rejected": 30,
    "michael_traded": 8
  },
  "stages_error": null,
  "drilldown": [
    {
      "ticker": "AAPL",
      "stage": "guardian_approved",
      "reason": "approve"
    },
    {
      "ticker": "TSLA",
      "stage": "guardian_rejected",
      "reason": "sector_concentration"
    },
    {
      "ticker": "NVDA",
      "stage": "traded",
      "reason": "buy"
    }
  ],
  "drilldown_error": null,
  "message": null
}
```

**Key patterns (match existing endpoints):**
- Each section has `_error` companion field (null when OK, string when failed)
- All timestamps/dates are ISO 8601 strings
- Keys are `snake_case`
- No envelope wrapper — return the dict directly
- `scan_date` at top level for clarity on which date was queried
- `message` is null normally, or "No funnel data for {date}" when empty
- Drilldown `stage` values: "scout_rejected", "guardian_approved", "guardian_modified", "guardian_rejected", "traded"

### New Files to Create

| File | Purpose |
|------|---------|
| `api/src/routers/funnel.py` | GET /api/funnel endpoint |
| `api/tests/test_funnel.py` | Endpoint and query tests |

### Files to Modify

| File | Change |
|------|--------|
| `api/src/db/portfolio.py` | Add 3 funnel query functions (replace placeholder) |
| `api/src/main.py` | Register funnel_router |
| `api/tests/conftest.py` | Add portfolio funnel schema + sample data, update portfolio_db_path fixture |

### What NOT To Do

- Do NOT create any frontend files — this is an API-only story (Story 3.2 handles the UI)
- Do NOT create new DB tables or write to any database — read-only, always
- Do NOT use an ORM — raw sqlite3 with parameterized queries only
- Do NOT install new Python packages — use what's already in pyproject.toml
- Do NOT create a camelCase response — all keys `snake_case`
- Do NOT wrap response in `{ "data": ..., "success": true }` envelope
- Do NOT add authentication — deferred per architecture doc
- Do NOT modify the health or supervisor routers — they're done
- Do NOT create frontend types, hooks, or route files — Story 3.2 scope
- Do NOT use `Depends(get_portfolio_db)` — follow supervisor.py pattern with manual connection

### Previous Story Intelligence

**From Story 2.1 (Supervisor API endpoint):**
- Established pattern: manual connection in helper function, not FastAPI Depends
- Section-level try/except with `_error` companion fields
- DB connection opened with `get_db_connection(settings.{db}_path)`
- Connection closed in `finally` block
- Router registered in main.py with `app.include_router()`
- 21 tests covering: all sections, individual section content, degraded response, independent degradation

**From Story 2.1 Review Findings:**
- Use exact `IN (...)` lists for event type filters instead of `LIKE` patterns
- Test independent section degradation (one section fails, others succeed)
- Return shallow copies of mutable config dicts
- `data`/`details` columns returned as raw strings — frontend parses JSON

**From Story 1.2 (API database connections):**
- `get_db_connection(path)` uses `f"file:{db_path}?mode=ro"` URI
- `sqlite3.Row` factory enables `row["column_name"]` dict-like access
- `dict(row)` to convert Row to plain dict for JSON serialization
- Test fixtures use in-memory SQLite with schema + sample data

**From conftest.py current state:**
- `portfolio_db_path` fixture creates an empty DB with `_placeholder` table — MUST be replaced with real funnel tables
- `supervisor_db_path` fixture pattern is the reference for creating test DBs with schema + data
- `client` fixture creates TestClient from `src.main.app`

### Architecture Compliance

- **Endpoint path**: `GET /api/funnel` (matches architecture API design)
- **Query params**: `scan_date` in `snake_case` (matches architecture naming)
- **Response format**: Direct JSON, no envelope wrapper
- **Error shape**: Section-level `_error` fields for partial degradation
- **DB access**: Read-only via `get_db_connection()` to portfolio.db
- **SQL**: Parameterized queries only — no string interpolation
- **Tests**: `api/tests/test_funnel.py` (separate directory per Python convention)
- **No new dependencies**: Uses existing fastapi, sqlite3 stack
- **Caching**: Funnel data staleTime 15min (frontend concern, Story 3.2)
- **Tab mapping**: Funnel → `funnel.py` router → `portfolio.py` DB module (per architecture doc)

### References

- [Source: epics.md#Story 3.1] — Acceptance criteria, user story
- [Source: architecture.md#API Patterns] — REST API design, `GET /api/funnel` with params
- [Source: architecture.md#Data Architecture] — portfolio.db tables, caching strategy
- [Source: architecture.md#Implementation Patterns] — Naming, structure, process patterns
- [Source: architecture.md#PRD Tab Mapping] — Funnel → funnel.py → portfolio.py
- [Source: api/src/routers/supervisor.py] — Primary router pattern reference
- [Source: api/src/db/connection.py] — DB connection functions
- [Source: api/tests/conftest.py] — Test fixture patterns
- [Source: 2-1-supervisor-api-endpoint.md] — Previous story learnings and patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation, no debug issues.

### Completion Notes List

- Implemented 3 portfolio DB query functions: `get_latest_scan_date`, `get_funnel_counts`, `get_funnel_drilldown`
- Created funnel router following supervisor.py pattern: manual connection, section-level try/except, `_error` companion fields
- Response shape matches exact contract from story spec: `scan_date`, `stages`, `stages_error`, `drilldown`, `drilldown_error`, `message`
- Default scan_date resolution when no param provided (uses latest from scout_candidates)
- Zero-count response with message when no data exists for requested date
- Graceful degradation: DB unavailable returns 200 with error strings, sections degrade independently
- 17 new tests covering: query functions (counts, drilldown, latest date), endpoint (happy path, defaults, no-data, degraded, independent degradation)
- 72 total tests pass with zero regressions
- Extended conftest.py with real portfolio funnel schema (4 tables) and representative sample data

### Change Log

- 2026-04-05: Implemented Story 3.1 — Funnel API endpoint with query functions, router, tests

### File List

New files:
- api/src/routers/funnel.py
- api/tests/test_funnel.py

Modified files:
- api/src/db/portfolio.py
- api/src/main.py
- api/tests/conftest.py
