# Story 8.1: Debug API Endpoints

**Status:** done

As Omri,
I want API endpoints for raw event bus data, agent logs, and pipeline replay,
So that the Debug tab has access to low-level system data.

## Acceptance Criteria

**AC1:** `GET /api/debug/events?source=data_bridge&type=sync_complete&since=2026-04-01&limit=50`
Returns raw events from supervisor `events` table with: id, timestamp, source, event_type, strategy_id, payload (as JSON), processed flag — filtered by query params.

**AC2:** `GET /api/debug/logs?agent=scout&date=2026-04-04&severity=ERROR`
Returns log entries read from agent log files on disk, filtered by agent name, date, and severity level.

**AC3:** `GET /api/debug/replay?date=2026-04-04`
Returns a reconstructed pipeline cycle: Scout candidates scanned (count + top tickers), Guardian decisions made (approved/modified/rejected with reasons), trade events executed, regime state at the time — all ordered chronologically.

**AC4:** Log files don't exist for requested date → returns empty array with no error.

## Tasks

1. Add `LOG_DIR` config setting to `config.py`
2. Create `api/src/db/debug.py` with query functions: `get_raw_events()`, `get_pipeline_replay()`
3. Create `api/src/routers/debug.py` with three endpoints + log file reader
4. Register debug router in `main.py`
5. Create `api/tests/test_debug.py` with query-level and endpoint-level tests
