# Story 8.2: Debug Tab — Raw Event Bus Viewer

**Status:** done

As Omri,
I want to browse raw events from the SQLite event bus with filtering,
So that I can inspect system behavior at the lowest level.

## Acceptance Criteria

**AC1:** Debug > Events sub-tab shows table with columns: timestamp, source, event_type, strategy_id, payload (expandable JSON), processed flag.

**AC2:** Filters for source, event type, and date range update via TanStack Router search params.

**AC3:** Clicking a row expands to show full JSON payload formatted in a monospace code block.

**AC4:** Manual refresh button (no auto-refetch — on-demand only).

## Tasks

1. Create `frontend/src/types/debug.ts` with all debug types
2. Create `frontend/src/api/useDebug.ts` with hooks for events/logs/replay
3. Build Events sub-tab section in `frontend/src/routes/debug.tsx`
