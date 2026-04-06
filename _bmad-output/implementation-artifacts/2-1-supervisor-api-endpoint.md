# Story 2.1: Supervisor API Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns supervisor data — Shadow Observer events, hold points, Strangler Fig status, and daemon status,
so that the Supervisor tab has data to display.

## Acceptance Criteria

1. **Given** the API is running **When** I call `GET /api/supervisor` **Then** I receive JSON with: recent Shadow Observer events from supervisor `events` table (source filters), hold point status from supervisor `events` table (hold-point-related events and drawdown state), Strangler Fig migration status from static config mapping, and active daemon status from latest `health_checks`.

2. **Given** the Strangler Fig status is configured in `api/src/config.py` **When** the endpoint returns migration status **Then** each pipeline component shows its current mode (v1-cron / v2-supervisor / dual) with a progress summary.

3. **Given** the supervisor database is unavailable **When** I call `GET /api/supervisor` **Then** I receive a degraded response with error detail, not a 500 crash.

## Tasks / Subtasks

- [x] Task 1: Add Strangler Fig migration config to `api/src/config.py` (AC: #2)
  - [x] 1.1: Add `STRANGLER_FIG_STATUS` dict to `api/src/config.py` — static mapping of pipeline components to their current migration state. Each entry: `component_name: { "mode": "v1-cron" | "v2-supervisor" | "dual", "description": "..." }`. Components: Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer, DataBridge, Health Monitor.
  - [x] 1.2: Add `get_strangler_fig_status()` function that returns the config dict plus a computed `progress_summary` (e.g., "3/8 components migrated to v2").

- [x] Task 2: Add supervisor DB query functions to `api/src/db/supervisor.py` (AC: #1)
  - [x] 2.1: Add `get_shadow_observer_events(conn, limit=50)` — query `events` table filtered by `source = 'shadow_observer'` OR events where source indicates supervisor-initiated activity. Return: id, timestamp, source, event_type, strategy_id, data, created_at. Order by `created_at DESC`.
  - [x] 2.2: Add `get_hold_point_status(conn)` — query `events` table for hold-point-related events (e.g., `event_type LIKE '%hold%'` or `event_type LIKE '%drawdown%'` or `event_type LIKE '%pause%'`). Also check `health_checks` for any drawdown/pause indicators. Return: current drawdown state (paused/active), trigger events, recent hold point decisions.
  - [x] 2.3: Add `get_daemon_status(conn)` — query `health_checks` table for the most recent check per unique component/daemon. Return: component name, status, last check timestamp, details. Reuse the pattern from `get_agent_statuses()` but return ALL health check entries (not just the 6 pipeline agents).

- [x] Task 3: Create supervisor router `api/src/routers/supervisor.py` (AC: #1, #2, #3)
  - [x] 3.1: Create `api/src/routers/supervisor.py` with `router = APIRouter()` and `@router.get("/api/supervisor")` endpoint.
  - [x] 3.2: Follow the health.py pattern exactly — each data section has a companion `_error` field (null when OK, string when failed). Response shape:
    ```json
    {
      "shadow_observer_events": [...],
      "shadow_observer_events_error": null,
      "hold_points": { "state": "active", "events": [...] },
      "hold_points_error": null,
      "strangler_fig": { "components": {...}, "progress_summary": "..." },
      "strangler_fig_error": null,
      "daemons": [...],
      "daemons_error": null
    }
    ```
  - [x] 3.3: Each section wrapped in try/except — DB failures produce `_error` string, not 500 crash. Strangler Fig section reads from config (no DB call, so only fails if config is malformed).

- [x] Task 4: Register supervisor router in `api/src/main.py` (AC: #1)
  - [x] 4.1: Import `supervisor_router` from `src.routers.supervisor` and add `app.include_router(supervisor_router)` following the existing `health_router` pattern.

- [x] Task 5: Write tests (AC: #1, #2, #3)
  - [x] 5.1: Update `api/tests/conftest.py` — add supervisor events sample data to the existing `SUPERVISOR_SAMPLE_DATA`: shadow observer events, hold-point-related events, additional health_checks for daemon status.
  - [x] 5.2: Create `api/tests/test_supervisor.py` — tests:
    - GET /api/supervisor returns 200 with all 4 sections
    - shadow_observer_events contains only shadow observer source events
    - hold_points returns current state (active/paused)
    - strangler_fig includes all components and progress_summary
    - daemons returns latest health check per component
    - When supervisor DB is unavailable, returns degraded response (not 500)
    - Each section independently degrades (shadow_observer_events_error populated but daemons still works)

### Review Findings

- [x] [Review][Defer] Hold-point state logic incomplete — `hold_point_triggered` events match the query but state derivation only checks for "pause"/"halt", so a triggered hold point reports as "active". Deferred: unknown real event semantics; revisit when wiring to production data.
- [x] [Review][Patch] LIKE patterns in hold point query overly broad — replaced with exact `IN (...)` list of known event types. [api/src/db/supervisor.py] (blind+edge)
- [x] [Review][Patch] No test for independent section degradation — added test with DB missing events table but health_checks intact. [api/tests/test_supervisor.py] (auditor)
- [x] [Review][Patch] STRANGLER_FIG_STATUS is a mutable module-level dict returned by reference — now returns shallow copy. [api/src/config.py] (blind)
- [x] [Review][Defer] Hold point query doesn't check health_checks table — spec Task 2.2 says "also check health_checks for drawdown/pause indicators" but implementation only queries events table. Deferred: unclear if health_checks contains hold-point data in production.
- [x] [Review][Defer] Shadow observer query missing strategy_id/timestamp columns — spec describes these columns but test schema from Story 1.2 doesn't include them. Production schema may differ. Verify against real supervisor DB.
- [x] [Review][Defer] No authentication on /api/supervisor — architecture doc explicitly defers auth to post-MVP phase.
- [x] [Review][Defer] Error messages leak filesystem paths to API consumers — pre-existing pattern from health.py, acceptable for internal dashboard.
- [x] [Review][Defer] `data`/`details` columns returned as raw JSON strings not parsed objects — pre-existing pattern from health.py, frontend must JSON.parse().

## Dev Notes

### Existing Code to Reuse (DO NOT recreate)

| Module | Location | Reuse |
|--------|----------|-------|
| `get_supervisor_db()` | `api/src/db/connection.py` | FastAPI dependency for supervisor DB connection |
| `get_agent_statuses()` | `api/src/db/supervisor.py` | Pattern reference for health_checks queries |
| `get_heartbeat_status()` | `api/src/db/supervisor.py` | Pattern reference for health_checks dict output |
| `get_recent_alerts()` | `api/src/db/supervisor.py` | Pattern reference for events table queries |
| `health_router` | `api/src/routers/health.py` | Pattern reference for router structure, error handling, response shape |
| `Settings` | `api/src/config.py` | Add Strangler Fig config here |
| `SUPERVISOR_SCHEMA` | `api/tests/conftest.py` | Existing test schema — extend with more sample data |

### Supervisor Database Schema (michael_supervisor.db)

5 tables: `events`, `predictions`, `eval_results`, `health_checks`, `sync_state`

**`events` table** (primary source for shadow observer + hold points):
```sql
-- Columns: id, timestamp, source, event_type, strategy_id, data (JSON text), processed, created_at
-- source values include: shadow_observer, data_bridge, guardian, michael, etc.
-- event_type values include: sync_complete, alert, hold_point_triggered, drawdown_pause, etc.
```

**`health_checks` table** (daemon status):
```sql
-- Columns: id, agent_name, status, details, checked_at
-- Used by existing get_agent_statuses() for the 6 pipeline agents
-- May contain additional daemon/component entries beyond the 6 agents
```

**IMPORTANT: There is NO `drawdown_state` table.** The epics mention "drawdown_state table" but the supervisor DB does not have this table. Hold point / drawdown data must be sourced from:
1. The `events` table — filter for hold-point and drawdown event types
2. The `health_checks` table — check for any pause/drawdown status indicators

The dev agent MUST handle this gracefully: query what exists, return empty arrays if no hold-point events are found. Do NOT create new tables or attempt writes.

### Strangler Fig Config Structure

Add to `api/src/config.py` as a module-level constant (not a Settings field — this is static config, not environment-dependent):

```python
STRANGLER_FIG_STATUS: dict[str, dict] = {
    "Scout": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Radar": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Guardian": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Chronicler": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Michael": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Shadow Observer": {"mode": "v2-supervisor", "description": "Supervisor daemon"},
    "DataBridge": {"mode": "v2-supervisor", "description": "Supervisor sync service"},
    "Health Monitor": {"mode": "v2-supervisor", "description": "Supervisor health checks"},
}
```

This is a best-guess default. Omri can update the actual values later. The key contract is the shape.

### Response Shape (exact contract)

```json
{
  "shadow_observer_events": [
    {
      "id": 1,
      "source": "shadow_observer",
      "event_type": "sync_complete",
      "strategy_id": null,
      "data": "{...}",
      "created_at": "2026-04-04T06:30:00"
    }
  ],
  "shadow_observer_events_error": null,
  "hold_points": {
    "state": "active",
    "trigger_pct": null,
    "events": [
      {
        "id": 5,
        "event_type": "drawdown_pause",
        "data": "{...}",
        "created_at": "2026-04-03T14:00:00"
      }
    ]
  },
  "hold_points_error": null,
  "strangler_fig": {
    "components": {
      "Scout": {"mode": "v1-cron", "description": "Runs via cron schedule"},
      "Shadow Observer": {"mode": "v2-supervisor", "description": "Supervisor daemon"}
    },
    "progress_summary": "3/8 components on v2-supervisor"
  },
  "strangler_fig_error": null,
  "daemons": [
    {
      "component": "shadow_observer",
      "status": "healthy",
      "details": "...",
      "checked_at": "2026-04-04T06:40:00"
    }
  ],
  "daemons_error": null
}
```

**Key patterns (match health.py exactly):**
- Each section has a companion `_error` field (null when OK, string when failed)
- All timestamps are ISO 8601 strings
- Keys are `snake_case`
- No envelope wrapper — return the dict directly
- `hold_points.state` is "active" (normal) or "paused" (drawdown triggered)
- `hold_points.events` may be empty array if no hold point events exist
- `strangler_fig` never fails (static config) — `strangler_fig_error` is always null unless config is malformed

### Router Pattern (follow health.py exactly)

```python
# api/src/routers/supervisor.py
from fastapi import APIRouter, Depends
import sqlite3
from src.db.connection import get_supervisor_db
from src.config import STRANGLER_FIG_STATUS

router = APIRouter()

@router.get("/api/supervisor")
def get_supervisor(conn: sqlite3.Connection = Depends(get_supervisor_db)):
    result = {}

    # Shadow Observer events
    try:
        result["shadow_observer_events"] = get_shadow_observer_events(conn)
        result["shadow_observer_events_error"] = None
    except Exception as e:
        result["shadow_observer_events"] = None
        result["shadow_observer_events_error"] = str(e)

    # ... same pattern for each section

    return result
```

### Test Pattern (follow test_health.py)

```python
# api/tests/test_supervisor.py
def test_supervisor_returns_all_sections(client):
    response = client.get("/api/supervisor")
    assert response.status_code == 200
    data = response.json()
    assert "shadow_observer_events" in data
    assert "hold_points" in data
    assert "strangler_fig" in data
    assert "daemons" in data
    # All error fields null when DB is available
    assert data["shadow_observer_events_error"] is None
    assert data["strangler_fig_error"] is None
```

### New Files to Create

| File | Purpose |
|------|---------|
| `api/src/routers/supervisor.py` | GET /api/supervisor endpoint |
| `api/tests/test_supervisor.py` | Endpoint and query tests |

### Files to Modify

| File | Change |
|------|--------|
| `api/src/config.py` | Add `STRANGLER_FIG_STATUS` dict |
| `api/src/db/supervisor.py` | Add 3 new query functions |
| `api/src/main.py` | Register supervisor_router |
| `api/tests/conftest.py` | Add supervisor events sample data |

### What NOT To Do

- Do NOT create a `drawdown_state` table or any new DB tables — read-only, always
- Do NOT use an ORM — raw sqlite3 with parameterized queries only
- Do NOT add any write operations — all connections are `?mode=ro`
- Do NOT create frontend files — this is an API-only story
- Do NOT install new Python packages — use what's already in pyproject.toml
- Do NOT create a camelCase response — all keys `snake_case`
- Do NOT wrap response in `{ "data": ..., "success": true }` envelope
- Do NOT add authentication — deferred per architecture doc
- Do NOT modify the health router — it's done and reviewed
- Do NOT create a separate supervisor DB connection function — reuse `get_supervisor_db()`

### Previous Story Intelligence

**From Story 1.2 (API database connections and health endpoint):**
- DB connections use `get_db_connection(path)` with `f"file:{db_path}?mode=ro"` URI
- FastAPI dependencies yield connections via `get_supervisor_db()` / `get_portfolio_db()`
- Router pattern: single GET endpoint, try/except per section, companion `_error` fields
- Test fixtures create in-memory SQLite DBs with schema + sample data in conftest.py
- `sqlite3.Row` factory enables dict-like row access (`row["column_name"]`)

**From Story 1.3 (Frontend app shell):**
- All 8 route files exist as skeleton placeholders — supervisor.tsx already exists
- apiClient at `frontend/src/api/client.ts` with base URL for `localhost:8000`

**From Story 1.4 (Health tab — in progress):**
- Health response shape with `_error` pattern is the established standard
- `useHealth.ts` hook pattern with refetchInterval for polling tabs

**From deferred work (code reviews):**
- f-string in sqlite3 URI fragile with special path chars — low risk, env var paths
- File paths disclosed in error messages — acceptable for internal dashboard
- `apiClient` doesn't catch network-level TypeError — will be addressed later

### Architecture Compliance

- **Endpoint path**: `GET /api/supervisor` (matches architecture API design)
- **Response format**: Direct JSON, no envelope wrapper
- **Error shape**: `{ "error": string, "detail": string }` for HTTP errors; section-level `_error` fields for partial degradation
- **DB access**: Read-only via `get_supervisor_db()` dependency
- **SQL**: Parameterized queries only — no string interpolation
- **Tests**: `api/tests/test_supervisor.py` (separate directory per Python convention)
- **No new dependencies**: Uses existing fastapi, sqlite3, psutil stack

### References

- [Source: epics.md#Story 2.1] — Acceptance criteria, user story
- [Source: architecture.md#API Patterns] — REST API design, all-GET, tab-oriented endpoints
- [Source: architecture.md#Data Architecture] — Supervisor DB tables, caching strategy
- [Source: architecture.md#Implementation Patterns] — Naming, structure, process patterns
- [Source: architecture.md#Anti-Patterns] — No envelope, no ORM, no camelCase transform
- [Source: ux-design-specification.md#Supervisor] — Side-by-side sections, 30s refetch, mobile stacked
- [Source: api/src/routers/health.py] — Router pattern reference
- [Source: api/src/db/supervisor.py] — Existing query functions and patterns
- [Source: api/src/config.py] — Settings class, where Strangler Fig config goes
- [Source: api/tests/conftest.py] — Test fixture patterns, supervisor schema
- [Source: 1-4-health-tab-agent-status-and-vps-metrics-display.md] — Previous story, API response shape

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

All 54 tests pass (21 new + 33 existing, 0 regressions) in 0.12s.

### Completion Notes List

- Implemented `GET /api/supervisor` endpoint with 4 independently error-handled sections
- Added `STRANGLER_FIG_STATUS` static config (8 components, 3 on v2-supervisor) with `get_strangler_fig_status()` helper
- Added 3 new query functions to `supervisor.py`: `get_shadow_observer_events`, `get_hold_point_status`, `get_daemon_status`
- Followed health.py pattern exactly: section-level `_error` fields, manual connection management, no envelope wrapper
- Hold point status derived from events table (no `drawdown_state` table exists) — state inferred from most recent hold-point event type
- Daemon status returns ALL health_checks entries (not limited to 6 pipeline agents), using `agent_name AS component` alias for clear contract
- Extended conftest.py with shadow_observer and hold-point sample events
- 21 new tests: 4 shadow observer query, 4 hold point query, 2 daemon query, 3 strangler fig config, 8 endpoint-level

### Change Log

- 2026-04-04: Story 2.1 implementation complete — supervisor API endpoint with all 4 data sections

### File List

- api/src/config.py (modified — added STRANGLER_FIG_STATUS + get_strangler_fig_status)
- api/src/db/supervisor.py (modified — added 3 query functions)
- api/src/routers/supervisor.py (new — supervisor endpoint)
- api/src/main.py (modified — registered supervisor_router)
- api/tests/conftest.py (modified — added shadow observer + hold point sample data)
- api/tests/test_supervisor.py (new — 21 tests)
