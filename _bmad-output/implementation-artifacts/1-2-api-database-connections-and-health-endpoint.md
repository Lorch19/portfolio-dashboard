# Story 1.2: API Database Connections and Health Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns the health status of all pipeline agents,
so that the dashboard has data to display on the Health tab.

## Acceptance Criteria

1. **Given** the API is running on the VPS, **When** I call `GET /api/health`, **Then** I receive a JSON response with: agent statuses (Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer), last successful run timestamp per agent, heartbeat status from `health_checks` table, VPS metrics (CPU, memory via psutil, disk from health_checks), and recent alert events from supervisor `events` table.

2. **Given** the API connects to both SQLite databases, **When** any database query executes, **Then** connections use `?mode=ro` (read-only) and no write operations are possible.

3. **Given** a database file is missing or inaccessible, **When** the health endpoint is called, **Then** it returns a degraded status with error detail rather than crashing.

4. **Given** the API is running, **When** I call `GET /api/health`, **Then** the response completes within 500ms.

## Tasks / Subtasks

- [x] Task 1: Create database connection layer (AC: #2)
  - [x] 1.1: Create `api/src/db/__init__.py`
  - [x] 1.2: Create `api/src/db/connection.py` with `get_portfolio_db()` and `get_supervisor_db()` FastAPI dependency functions that return read-only sqlite3 connections (`?mode=ro`)
  - [x] 1.3: Add DB connection initialization in `api/src/main.py` lifespan handler (validate paths, log connection status at startup)
  - [x] 1.4: Write tests for connection layer: verify `?mode=ro` enforced, verify graceful handling when DB file missing
- [x] Task 2: Create database query functions (AC: #1)
  - [x] 2.1: Create `api/src/db/supervisor.py` with queries: `get_agent_statuses()` (from health_checks), `get_recent_alerts()` (from events table), `get_heartbeat_status()` (from health_checks)
  - [x] 2.2: Create `api/src/db/portfolio.py` — placeholder module for future portfolio.db queries (empty for now, no queries needed in this story)
  - [x] 2.3: Write tests for supervisor queries using in-memory SQLite with test data fixtures
- [x] Task 3: Create health router with `/api/health` endpoint (AC: #1, #3, #4)
  - [x] 3.1: Create `api/src/routers/__init__.py`
  - [x] 3.2: Create `api/src/routers/health.py` with `GET /api/health` that aggregates: agent statuses, heartbeats, VPS metrics (via psutil), recent alerts
  - [x] 3.3: Register health router in `api/src/main.py`
  - [x] 3.4: Implement graceful degradation: if a DB is unavailable, return partial response with error detail per section rather than 500
  - [x] 3.5: Write tests for health endpoint: happy path, degraded (missing DB), response shape validation
- [x] Task 4: Add psutil for VPS metrics (AC: #1)
  - [x] 4.1: `uv add psutil`
  - [x] 4.2: Add VPS metrics collection (CPU %, memory %, disk %) in health router — supplement DB disk metrics with live system metrics
- [x] Task 5: Create test infrastructure (AC: #1, #2, #3, #4)
  - [x] 5.1: Create `api/tests/__init__.py`
  - [x] 5.2: Create `api/tests/conftest.py` with fixtures: in-memory SQLite databases with test schema and sample data, FastAPI TestClient
  - [x] 5.3: Add `pytest` and `httpx` as dev dependencies: `uv add --dev pytest httpx`
  - [x] 5.4: Run full test suite and verify all pass
- [x] Task 6: Update existing health check and verify (AC: #1, #3, #4)
  - [x] 6.1: Move or replace the root `/` health check — keep simple root ping at `/`, add full health at `/api/health`
  - [x] 6.2: Verify `GET /api/health` returns correct JSON shape with all required fields
  - [x] 6.3: Verify degraded response when DB files don't exist (dev environment without real DBs)
  - [x] 6.4: Verify response time is under 500ms

## Dev Notes

### Database Architecture

Two SQLite databases, both read-only:
- **portfolio.db**: 28 tables (pipeline data, holdings, trades, funnel, costs). Not queried in this story — just connection setup.
- **michael_supervisor.db**: 5 tables (events, predictions, eval_results, health_checks, sync_state). Health endpoint queries `health_checks` and `events`.

### DB Connection Pattern (MUST FOLLOW)

```python
import sqlite3

def get_db_connection(db_path: str) -> sqlite3.Connection:
    """Read-only connection. ?mode=ro enforced at sqlite3 level."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row  # Dict-like access
    return conn
```

- One read-only connection per request via FastAPI dependency injection
- `get_portfolio_db()` and `get_supervisor_db()` as FastAPI `Depends()` functions
- All queries use parameterized SQL — **never** string interpolation
- Connection opened with `?mode=ro` — no exceptions

### API Response Pattern (MUST FOLLOW)

```json
// Success — direct response, no wrapper envelope:
{
  "agents": [...],
  "heartbeats": {...},
  "vps_metrics": {...},
  "alerts": [...]
}

// Error — standard shape:
{ "error": "database_unavailable", "detail": "michael_supervisor.db not found" }
```

- No `{ "data": ..., "success": true }` envelope. HTTP status codes carry success/failure.
- ISO 8601 dates everywhere (`2026-04-04T06:35:00Z`). Existing DBs use ISO text format.
- Return `null` for missing values — don't omit keys. Frontend expects predictable shape.
- snake_case for all JSON keys.

### Graceful Degradation Pattern (AC #3)

When a DB is unavailable, don't return 500. Return 200 with partial data and error detail per section:

```json
{
  "agents": null,
  "agents_error": "michael_supervisor.db not accessible",
  "heartbeats": null,
  "heartbeats_error": "michael_supervisor.db not accessible",
  "vps_metrics": { "cpu_percent": 45.2, "memory_percent": 67.1, "disk_percent": 52.0 },
  "alerts": null,
  "alerts_error": "michael_supervisor.db not accessible"
}
```

VPS metrics via psutil are always available (no DB needed), so they should always return data.

### File Structure (MUST FOLLOW)

```
api/
├── src/
│   ├── __init__.py
│   ├── main.py              # Add lifespan handler, register health router
│   ├── config.py            # Already exists — has DB path settings
│   ├── db/
│   │   ├── __init__.py
│   │   ├── connection.py    # Read-only sqlite3 connections + FastAPI deps
│   │   ├── portfolio.py     # Empty placeholder for now
│   │   └── supervisor.py    # Queries: agent statuses, heartbeats, alerts
│   └── routers/
│       ├── __init__.py
│       └── health.py        # GET /api/health endpoint
└── tests/
    ├── __init__.py
    ├── conftest.py           # In-memory SQLite fixtures, TestClient
    └── test_health.py        # Health endpoint tests
```

**DB Access Boundary:** `api/src/db/` is the ONLY directory that contains SQL queries. Routers call db functions, never write SQL themselves.

### Existing Code to Modify

- `api/src/main.py` — Add lifespan handler for DB init, register health router, keep existing `/` ping endpoint
- `api/src/config.py` — Already has `portfolio_db_path` and `supervisor_db_path` from env vars. No changes needed.

### Settings Already Available (from Story 1.1)

```python
# api/src/config.py — already exists, DO NOT modify
class Settings:
    def __init__(self) -> None:
        self.cors_origins: list[str] = [...]
        self.portfolio_db_path: str = os.getenv("PORTFOLIO_DB_PATH", "")
        self.supervisor_db_path: str = os.getenv("SUPERVISOR_DB_PATH", "")

settings = Settings()
```

Empty DB paths are expected in dev — the health endpoint must handle this gracefully (AC #3).

### Testing Pattern

- **Framework:** pytest + httpx (for async FastAPI TestClient)
- **Fixtures in conftest.py:** In-memory SQLite with test schema and sample data
- **Test file location:** `api/tests/test_health.py` (Python convention, separate from src)
- **Test DB schema:** Create minimal tables matching `health_checks` and `events` structure
- **Coverage:** Happy path, degraded mode (missing DB), response shape, read-only enforcement

### Supervisor DB Schema (health_checks table — for test fixtures)

The `health_checks` table in `michael_supervisor.db` stores agent heartbeat data. Create test fixtures with this approximate schema:

```sql
CREATE TABLE health_checks (
    id INTEGER PRIMARY KEY,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL,
    last_run TEXT,  -- ISO 8601 timestamp
    details TEXT,   -- JSON string with additional info
    checked_at TEXT NOT NULL  -- ISO 8601 timestamp
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT,       -- JSON string
    created_at TEXT NOT NULL  -- ISO 8601 timestamp
);
```

**Agent names:** Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer (6 agents total).

### What NOT To Do

- Do NOT install SQLAlchemy, SQLModel, or any ORM — use raw sqlite3
- Do NOT use Pydantic BaseSettings or python-dotenv — Settings class already uses os.getenv
- Do NOT create frontend files — this is API-only
- Do NOT add authentication, rate limiting, or middleware beyond existing CORS
- Do NOT create routers for other endpoints (supervisor, funnel, etc.) — only health
- Do NOT write to databases — all connections MUST be read-only
- Do NOT use async sqlite3 — use sync sqlite3 with FastAPI sync endpoints
- Do NOT create `api/src/models/` or Pydantic response models — return dicts directly

### Previous Story Learnings (from Story 1.1)

- **Settings class uses `__init__`**: Environment variables are read at instantiation, not at class definition time
- **CORS whitespace handling**: Already fixed with strip/filter pattern
- **ESLint react-refresh rule**: Already relaxed with `allowConstantExport: true`
- **TanStack Router needs routes dir**: `src/routes/` and `__root.tsx` must exist
- **API runs with**: `uv run uvicorn src.main:app --reload` from `api/` directory
- **CI workflow pins Python**: Uses `python-version-file: api/.python-version`

### References

- [Source: architecture.md#Database Access] — Read-only sqlite3 connections, ?mode=ro
- [Source: architecture.md#REST API] — Endpoint specifications, response format
- [Source: architecture.md#Error handling] — Standard error shape, inline errors
- [Source: architecture.md#DB Access Boundary] — SQL only in api/src/db/
- [Source: architecture.md#Project Structure] — File layout for db/, routers/, tests/
- [Source: epics.md#Story 1.2] — Acceptance criteria, agent list
- [Source: architecture.md#Implementation Patterns] — snake_case, parameterized queries, no ORM

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
No issues encountered. All tests passed on first run.

### Completion Notes List
- Task 1: Created `api/src/db/` package with `connection.py` providing read-only sqlite3 connections via `?mode=ro`. FastAPI dependency generators `get_portfolio_db()` and `get_supervisor_db()` with graceful FileNotFoundError on missing paths. Added lifespan handler to `main.py` for startup DB path validation and logging. 9 unit tests covering read-only enforcement, missing DB handling, and generator lifecycle.
- Task 2: Created `api/src/db/supervisor.py` with `get_agent_statuses()`, `get_heartbeat_status()`, and `get_recent_alerts()` using parameterized SQL. Created `api/src/db/portfolio.py` placeholder. 8 unit tests using in-memory SQLite with test fixtures covering all query functions, ordering, and limits.
- Task 3: Created `api/src/routers/health.py` with `GET /api/health` endpoint aggregating agent statuses, heartbeats, VPS metrics (psutil), and recent alerts. Graceful degradation returns null sections with error details when supervisor DB is unavailable. Registered router in `main.py`. 10 tests covering happy path, degraded mode, response shape, and snake_case keys.
- Task 4: Added psutil dependency. VPS metrics (CPU %, memory %, disk %) collected via psutil in health router — always available regardless of DB status.
- Task 5: Created test infrastructure: `tests/__init__.py`, `tests/conftest.py` with supervisor DB schema/sample data fixtures, TestClient fixture. Added pytest and httpx as dev dependencies.
- Task 6: Kept root `/` as simple ping, added full health at `/api/health`. Verified response shape (all required fields), degraded mode, and response time under 500ms. 6 verification tests.

### Change Log
- 2026-04-04: Story 1.2 implementation complete — API database connections and health endpoint with 33 passing tests

### File List
- api/src/db/__init__.py (new)
- api/src/db/connection.py (new)
- api/src/db/supervisor.py (new)
- api/src/db/portfolio.py (new)
- api/src/routers/__init__.py (new)
- api/src/routers/health.py (new)
- api/src/main.py (modified — added lifespan handler, health router registration)
- api/pyproject.toml (modified — added psutil, pytest, httpx dependencies)
- api/uv.lock (modified — lockfile updated)
- api/tests/__init__.py (new)
- api/tests/conftest.py (new)
- api/tests/test_connection.py (new)
- api/tests/test_supervisor_queries.py (new)
- api/tests/test_health.py (new)
- api/tests/test_verification.py (new)

### Review Findings

- [x] [Review][Decision] Health router bypasses FastAPI DI for DB connections — Accepted: intentional bypass for graceful degradation. Spec deviation acknowledged.
- [x] [Review][Patch] AC1: field is `last_run` (most recent run), not "last successful run" — Docstring updated with AC interpretation note. [supervisor.py:5-16]
- [x] [Review][Decision] AC1: disk metric sourced from psutil only — Accepted: psutil provides real-time data; health_checks may not store disk metrics. Keep psutil-only.
- [x] [Review][Patch] Enforce all 6 named agents in response with null backfill — Added EXPECTED_AGENTS list and backfill logic in `get_agent_statuses`. [supervisor.py:5-16]
- [x] [Review][Patch] `psutil.cpu_percent(interval=0.1)` blocks threadpool 100ms per request — Changed to `interval=None`. [health.py:16]
- [x] [Review][Patch] `_collect_vps_metrics` has no error handling — Wrapped in try/except, returns `(metrics, error)` tuple with `vps_metrics_error` key. [health.py:14-26]
- [x] [Review][Patch] Successful response omits `_error` keys — Response now always includes all `_error` keys (null when no error). [health.py:53-64]
- [x] [Review][Patch] Generator type annotation `-> sqlite3.Connection` incorrect — Fixed to `-> Generator[sqlite3.Connection, None, None]`. [connection.py:16,30]
- [x] [Review][Patch] Error message format differs from spec — Aligned to `"michael_supervisor.db not accessible: ..."` pattern. [health.py:33,38,47]
- [x] [Review][Defer] f-string in sqlite3 URI fragile with special path chars — `f"file:{db_path}?mode=ro"` would break on paths with `?`, `#`, `%`. Low risk since paths come from env vars. [connection.py:9] — deferred, pre-existing config pattern
- [x] [Review][Defer] `get_recent_alerts` limit parameter unbounded — No upper-bound validation. Not currently exposed to HTTP input. [supervisor.py:35] — deferred, not exposed to user input
- [x] [Review][Defer] File paths disclosed in error messages — Absolute paths leak in error strings to API consumers. Acceptable for internal dashboard. [connection.py:18,31] — deferred, internal-only API
