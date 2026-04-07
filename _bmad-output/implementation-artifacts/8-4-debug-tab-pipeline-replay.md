# Story 8.4: Debug Tab — Pipeline Replay

**Status:** done

As Omri,
I want to step through what happened in a specific pipeline cycle,
So that I can understand the complete flow of decisions for any given day.

## Acceptance Criteria

**AC1:** Debug > Replay sub-tab: select a date, see chronological timeline of the pipeline cycle.

**AC2:** Steps: Regime state -> Scout scan (count + top tickers) -> Guardian decisions (per ticker with reasons) -> Trade events -> Portfolio snapshot.

**AC3:** Click a step to expand detail (full candidate list, per-ticker rule checks).

**AC4:** No pipeline run for date -> "No pipeline run found for this date".

**AC5:** Mobile: vertical timeline with expandable steps.

## Tasks

1. Build Replay sub-tab section in `frontend/src/routes/debug.tsx`
2. Create `frontend/src/routes/debug.test.tsx` with tests for all sub-tabs
3. Add `DEBUG_STALE_TIME` constant
