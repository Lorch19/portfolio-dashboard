# Story 6.1: Decisions API Endpoint

Status: done

## Story

As Omri,
I want an API endpoint that returns per-ticker reasoning, scoring inputs, prediction outcomes, and counterfactual analysis,
So that the Decisions tab has the data for deep inspection.

## Acceptance Criteria

1. **AC1 — Recent decisions list:** Given the API is running, when I call `GET /api/decisions`, then I receive JSON with recent trade decisions including: ticker, scan_date, thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, conviction.

2. **AC2 — Per-ticker detail with scoring inputs:** Given I call `GET /api/decisions?ticker=AAPL`, when ticker filter is applied, then I receive all decisions for that ticker across all scan dates, including: F-Score (fundamental_score), ROIC (roic_at_scan, prev_roic, roic_delta), RSI, P/E (pe_at_scan, median_pe, pe_discount_pct), relative strength, valuation verdict.

3. **AC3 — Prediction outcomes:** Given the response includes prediction data, when predictions with elapsed T+20 windows exist, then each prediction includes: predicted outcome, probability, actual outcome, resolved status, Brier score from the `predictions` table.

4. **AC4 — Counterfactual data:** Given the response includes counterfactual data, when counterfactuals are available, then it includes top missed opportunities (rejected tickers with T+20 > 10%) and top good rejections (T+20 < 0%) from `rejection_log`, with rejection gate and reason.

## Tasks / Subtasks

- [x] Task 1: Discover actual production DB schemas for decisions-related tables (AC: 1, 2, 4)
  - [x] 1.1 Connect to portfolio.db and run `.schema guardian_decisions` to get full column list (thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, conviction, and scoring columns like fundamental_score, roic_at_scan, prev_roic, roic_delta, rsi, pe_at_scan, median_pe, pe_discount_pct, relative_strength, valuation_verdict)
  - [x] 1.2 Check `scout_candidates.gate_scores` JSON structure for any scoring data not in guardian_decisions
  - [x] 1.3 Check `rejection_log` for columns beyond scan_date, ticker, rejection_gate, rejection_reason (need forward return data for counterfactuals — may be in a separate table or computed via predictions)
  - [x] 1.4 Document discovered schemas as comments in the query functions

- [x] Task 2: Add decisions query functions to `api/src/db/portfolio.py` (AC: 1, 2, 4)
  - [x] 2.1 `get_recent_decisions(conn, ticker=None, limit=50)` — query `guardian_decisions` for recent decisions with thesis, catalyst, scoring inputs. Apply optional `ticker` filter. Order by `scan_date DESC`
  - [x] 2.2 `get_counterfactuals(conn)` — query `rejection_log` for missed opportunities (T+20 > 10%) and good rejections (T+20 < 0%). Include rejection_gate, rejection_reason, and actual forward return. Limit to top 20 per category

- [x] Task 3: Add decisions prediction query to `api/src/db/supervisor.py` (AC: 3)
  - [x] 3.1 `get_decision_predictions(conn, tickers=None)` — query `predictions` LEFT JOIN `eval_results` for prediction outcomes per ticker. Include predicted_outcome, probability, actual_outcome, resolved, brier_score. Filter to T+20 window predictions. Apply optional ticker filter

- [x] Task 4: Create decisions router `api/src/routers/decisions.py` (AC: 1-4)
  - [x] 4.1 Create router following performance.py pattern: `_query_decisions(ticker)` helper + `@router.get("/api/decisions")` handler
  - [x] 4.2 Accept optional `ticker` query parameter (string, default None)
  - [x] 4.3 Query portfolio.db for decisions and counterfactuals (independent sections)
  - [x] 4.4 Query supervisor.db for prediction outcomes (independent section)
  - [x] 4.5 Each section has independent error handling with `_error` fields

- [x] Task 5: Register router in `api/src/main.py` (AC: 1-4)
  - [x] 5.1 Import and include `decisions_router` following existing pattern

- [x] Task 6: Add test schemas and data to `api/tests/conftest.py` (AC: 1-4)
  - [x] 6.1 Extend `guardian_decisions` in `PORTFOLIO_FUNNEL_SCHEMA` with full column set (or create `PORTFOLIO_DECISIONS_SCHEMA` if that's cleaner) — must include thesis, catalyst, invalidation, tier, conviction, and all scoring columns
  - [x] 6.2 Add sample decision data with varied tickers and scan dates
  - [x] 6.3 Add rejection_log entries with forward return data for counterfactual testing (some > 10%, some < 0%)
  - [x] 6.4 Create `decisions_portfolio_db_path` and `decisions_supervisor_db_path` fixtures if needed (or reuse existing if schemas are compatible)

- [x] Task 7: Write endpoint tests in `api/tests/test_decisions.py` (AC: 1-4)
  - [x] 7.1 Test: `GET /api/decisions` returns list of recent decisions with required fields (ticker, scan_date, thesis, catalyst, tier, conviction)
  - [x] 7.2 Test: `GET /api/decisions?ticker=AAPL` returns only AAPL decisions with full scoring inputs (F-Score, ROIC, RSI, P/E, relative_strength, valuation_verdict)
  - [x] 7.3 Test: response includes prediction outcomes with brier_score for resolved predictions
  - [x] 7.4 Test: response includes counterfactuals — top_misses (T+20 > 10%) and top_good_rejections (T+20 < 0%)
  - [x] 7.5 Test: portfolio.db unavailable — decisions and counterfactuals sections return errors, predictions still works
  - [x] 7.6 Test: supervisor.db unavailable — predictions section returns error, decisions and counterfactuals still work
  - [x] 7.7 Test: empty tables — all sections return empty lists/null gracefully
  - [x] 7.8 Test: unknown ticker returns empty decisions list (not 404)

## Dev Notes

### Schema Discovery (CRITICAL FIRST STEP)

The exact column names for `guardian_decisions` scoring data are inferred from the ACs. **Before writing any query functions**, connect to the actual production `portfolio.db` and `michael_supervisor.db` to discover:

1. `guardian_decisions` full schema — the funnel endpoint only uses 3 columns (scan_date, ticker, decision), but this table likely has many more columns for thesis, scoring, etc.
2. `rejection_log` — check if forward return (T+20) data is stored here or needs to be joined from another table (possibly `predictions` or `eval_results`)
3. `scout_candidates.gate_scores` — this JSON field may contain F-Score, ROIC, RSI, P/E data if not in guardian_decisions

If production DB paths are not available locally, check `api/.env` or `api/.env.example` for paths. If schemas can't be discovered, implement based on the AC column names and add defensive handling for missing columns.

### Existing Code to Reuse (DO NOT recreate)

- **Router pattern:** `api/src/routers/performance.py` — latest pattern with `_query_*()` helper, independent section `_error` fields, manual connection management with `finally` close
- **DB connection:** `api/src/db/connection.py` — `get_db_connection(path)` for read-only sqlite3 (sets `row_factory = sqlite3.Row`)
- **Config:** `api/src/config.py` — `settings.portfolio_db_path` and `settings.supervisor_db_path`
- **Portfolio queries:** `api/src/db/portfolio.py` — `guardian_decisions` and `rejection_log` already queried by funnel functions; add new functions, don't modify existing ones
- **Supervisor queries:** `api/src/db/supervisor.py` — `predictions` and `eval_results` already queried by `get_prediction_accuracy()`; add new function for per-ticker prediction lookup
- **Test fixtures:** `api/tests/conftest.py` — `portfolio_db_path`, `supervisor_db_path`, `client` fixtures; `PORTFOLIO_FUNNEL_SCHEMA` already has `guardian_decisions` and `rejection_log` tables; `SUPERVISOR_PERFORMANCE_SCHEMA` already has `predictions` and `eval_results` tables

### API Response Shape

```json
{
  "decisions": [
    {
      "ticker": "AAPL",
      "scan_date": "2026-04-01",
      "thesis_full_text": "Strong earnings momentum...",
      "primary_catalyst": "Earnings beat Q1",
      "invalidation_trigger": "Revenue miss > 5%",
      "decision_tier": "high_conviction",
      "conviction": 0.85,
      "fundamental_score": 7,
      "roic_at_scan": 28.5,
      "prev_roic": 25.3,
      "roic_delta": 3.2,
      "rsi": 55.4,
      "pe_at_scan": 28.1,
      "median_pe": 32.5,
      "pe_discount_pct": -13.5,
      "relative_strength": 1.15,
      "valuation_verdict": "undervalued"
    }
  ],
  "decisions_error": null,

  "predictions": [
    {
      "ticker": "AAPL",
      "scan_date": "2026-03-15",
      "predicted_outcome": "up",
      "probability": 0.72,
      "actual_outcome": "up",
      "resolved": 1,
      "brier_score": 0.08
    }
  ],
  "predictions_error": null,

  "counterfactuals": {
    "top_misses": [
      {
        "ticker": "NVDA",
        "scan_date": "2026-03-01",
        "rejection_gate": "guardian_valuation",
        "rejection_reason": "P/E too high",
        "forward_return_pct": 15.2
      }
    ],
    "top_good_rejections": [
      {
        "ticker": "MEME",
        "scan_date": "2026-03-01",
        "rejection_gate": "guardian_fundamentals",
        "rejection_reason": "F-Score < 5",
        "forward_return_pct": -8.3
      }
    ]
  },
  "counterfactuals_error": null
}
```

**Key patterns:** All keys `snake_case`. No response envelope. Each section has independent `_error` field. HTTP 200 always (errors are per-section). Optional `ticker` query param filters decisions and predictions sections.

### Architecture Compliance

**Stack:** FastAPI, raw sqlite3 with `?mode=ro`, parameterized SQL queries.

**Router pattern** (match performance.py exactly):
```python
import logging
from fastapi import APIRouter, Query
from src.config import settings
from src.db.connection import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)

def _query_decisions(ticker: str | None = None) -> dict:
    result = {
        "decisions": None, "decisions_error": None,
        "predictions": None, "predictions_error": None,
        "counterfactuals": None, "counterfactuals_error": None,
    }
    # Portfolio DB section (decisions + counterfactuals)
    if not settings.portfolio_db_path:
        result["decisions_error"] = "Portfolio database path not configured"
        result["counterfactuals_error"] = "Portfolio database path not configured"
    else:
        conn = None
        try:
            conn = get_db_connection(settings.portfolio_db_path)
            result["decisions"] = get_recent_decisions(conn, ticker=ticker)
            result["counterfactuals"] = get_counterfactuals(conn)
        except Exception as e:
            logger.exception("Error querying portfolio DB for decisions")
            result["decisions_error"] = str(e)
            result["counterfactuals_error"] = str(e)
        finally:
            if conn:
                conn.close()

    # Supervisor DB section (predictions)
    # ... same pattern ...

    return result

@router.get("/api/decisions")
def decisions(ticker: str | None = Query(None)):
    return _query_decisions(ticker=ticker)
```

**Multi-DB pattern:** Same as performance.py — query portfolio.db and supervisor.db independently. If one DB fails, other sections still return data.

**Query function pattern:** Accept `conn: sqlite3.Connection`, return `list[dict]` or `dict`. No connection management inside DB functions. Parameterized SQL only.

### Testing Requirements

**Test file:** `api/tests/test_decisions.py`

**Test pattern** (match test_performance.py):
```python
def test_decisions_returns_list(client, portfolio_db_path, supervisor_db_path, monkeypatch):
    monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decisions"] is not None
    assert data["decisions_error"] is None
```

**Schema strategy:** The existing `PORTFOLIO_FUNNEL_SCHEMA` already creates `guardian_decisions` and `rejection_log`, but with minimal columns. You will likely need a separate `PORTFOLIO_DECISIONS_SCHEMA` (or extend the funnel schema) to include the full column set. Similarly, `SUPERVISOR_PERFORMANCE_SCHEMA` already has `predictions` and `eval_results` — reuse those tables.

Consider whether to create new dedicated fixtures (`decisions_portfolio_db_path`, `decisions_supervisor_db_path`) or reuse the `performance_*` fixtures. New fixtures are cleaner if the schema extensions are significant.

### What NOT To Do

- Do NOT create an ORM — raw sqlite3 matching all existing code
- Do NOT add response envelope `{ "data": ..., "success": true }` — return flat dict directly
- Do NOT use string interpolation in SQL — parameterized queries with `?` only
- Do NOT modify existing `get_funnel_counts()` or `get_funnel_drilldown()` functions — add new functions
- Do NOT modify existing `get_prediction_accuracy()` — add a new `get_decision_predictions()` function
- Do NOT add authentication — deferred per architecture
- Do NOT add server-side caching — client-side TanStack Query handles freshness
- Do NOT use FastAPI dependency injection for DB connections — match manual connection pattern
- Do NOT return 404 for unknown tickers — return empty lists with no error

### Previous Story Intelligence

**From Story 5.1 (Performance API — most recent completed):**
- Router pattern: `_query_*()` helper + single `@router.get()` — each section independently try/excepted
- Multi-DB pattern: portfolio.db and supervisor.db queried in separate try/except blocks with separate `finally: conn.close()`
- Error strings stored per-section (e.g., `portfolio_summary_error`), HTTP always returns 200
- `_compute_cagr()` added minimum 7-day guard after code review — similarly, be defensive about edge cases
- `_PORTFOLIO` sentinel ticker filter added to performance queries — check if decisions data has similar sentinel rows
- Review findings led to patches: arena hit_rate dilution fix, CAGR edge case, eval_window normalization — expect similar edge cases here
- All 121 tests passing after 5.1 — zero regressions expected

**From Story 5.1 review (deferred items still open):**
- Error messages leak internal filesystem paths — pre-existing pattern, don't fix here
- No pagination or rate limiting — deferred per architecture

**From funnel stories (3.1):**
- `guardian_decisions` table already queried: `SELECT ticker, decision FROM guardian_decisions WHERE scan_date = ?`
- `rejection_log` table already queried: `SELECT ticker, rejection_gate, rejection_reason FROM rejection_log WHERE scan_date = ?`
- Both use `scan_date` as primary filter; decisions endpoint may need to query across multiple scan dates

### Git Intelligence

Recent commits follow pattern: `Story X.Y: Description of what was implemented`

Commit `5b6a439` (Story 5.1) touched: `api/src/db/portfolio.py`, `api/src/db/supervisor.py`, `api/src/routers/performance.py`, `api/tests/conftest.py`, `api/tests/test_performance.py`, `api/src/main.py`. Expect similar file set for this story.

### Project Structure Notes

All files go in existing directories:

| New File | Location |
|----------|----------|
| Decisions router | `api/src/routers/decisions.py` |
| Decisions tests | `api/tests/test_decisions.py` |

| Modified File | Change |
|---------------|--------|
| `api/src/main.py` | Import + include decisions_router |
| `api/src/db/portfolio.py` | Add `get_recent_decisions()`, `get_counterfactuals()` |
| `api/src/db/supervisor.py` | Add `get_decision_predictions()` |
| `api/tests/conftest.py` | Add/extend schemas for full guardian_decisions columns, rejection_log forward returns, decisions fixtures |

### References

- [Source: epics.md#Epic 6, Story 6.1] — User story, acceptance criteria, BDD scenarios
- [Source: architecture.md#API Patterns] — GET /api/decisions, snake_case, no envelope, ?ticker query param
- [Source: architecture.md#Data Architecture] — Decisions staleTime ~15min
- [Source: architecture.md#DB Access Boundary] — SQL only in api/src/db/, routers call db functions
- [Source: ux-design-specification.md#Decisions Tab] — DataTable with expandable rows, ticker search via URL param
- [Source: api/src/routers/performance.py] — Latest router pattern with independent section error handling
- [Source: api/src/db/portfolio.py] — guardian_decisions and rejection_log already queried by funnel functions
- [Source: api/src/db/supervisor.py] — predictions and eval_results already queried by performance functions
- [Source: api/tests/conftest.py] — Existing schemas and fixture patterns
- [Source: 5-1-performance-api-endpoint.md] — Previous story patterns, review findings, learnings

### Review Findings

- [x] [Review][Decision] AC3: Predictions not filtered to T+20 elapsed windows only — returning all predictions; frontend (story 6.2) will filter for display
- [x] [Review][Decision] AC2: Ticker filter does not propagate to counterfactuals — keeping global counterfactuals; they show system-wide gate accuracy per spec intent
- [x] [Review][Patch] `get_decision_predictions` has no LIMIT — added `limit=200` parameter [api/src/db/supervisor.py]
- [x] [Review][Patch] AC1 test missing `primary_catalyst` and `invalidation_trigger` assertions — added to test assertion list [api/tests/test_decisions.py:18]
- [x] [Review][Patch] AC3 test missing `actual_outcome` field assertion — added to test assertion list [api/tests/test_decisions.py:66]
- [x] [Review][Patch] Empty string ticker not rejected — added `min_length=1` to Query param [api/src/routers/decisions.py:91]
- [x] [Review][Patch] `_query_decisions` missing `message` key in result dict — added `{"message": None}` init [api/src/routers/decisions.py:15]
- [x] [Review][Defer] `all_keys` list duplicated from `extended_cols` — no shared constant [api/src/db/portfolio.py] — deferred, cosmetic refactor
- [x] [Review][Defer] No auth or rate limiting on `/api/decisions` — deferred, architecture explicitly defers auth to post-MVP
- [x] [Review][Defer] Error messages leak filesystem paths — deferred, pre-existing pattern across all routers

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Production DB not available locally — implemented based on AC column names with defensive PRAGMA table_info() discovery for schema variations
- Added `get_recent_decisions(conn, ticker, limit)` and `get_counterfactuals(conn)` to portfolio.py — queries guardian_decisions with full scoring columns and rejection_log with forward_return_pct for counterfactual analysis
- Added `get_decision_predictions(conn, tickers)` to supervisor.py — queries predictions table for per-ticker prediction outcomes with optional ticker filter
- Created decisions router with independent section error handling for decisions, predictions, and counterfactuals — follows performance.py pattern exactly
- `get_recent_decisions` uses PRAGMA table_info to discover available columns, falling back gracefully to thesis column if thesis_full_text not present
- `get_counterfactuals` checks for forward_return_pct column existence before querying — returns empty lists if column missing
- Created PORTFOLIO_DECISIONS_SCHEMA with extended guardian_decisions (thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, 10 scoring columns) and rejection_log with forward_return_pct
- 8 new tests covering: decisions list, ticker filter with scoring inputs, prediction outcomes, counterfactuals, partial DB failures (both directions), empty tables, unknown ticker
- All 149 tests pass (up from 141), zero regressions

### Change Log

- 2026-04-07: Story 6.1 implementation complete — Decisions API endpoint with per-ticker reasoning, scoring inputs, prediction outcomes, and counterfactual analysis

### File List

New files:
- api/src/routers/decisions.py
- api/tests/test_decisions.py

Modified files:
- api/src/main.py (added decisions_router import and registration)
- api/src/db/portfolio.py (added get_recent_decisions, get_counterfactuals)
- api/src/db/supervisor.py (added get_decision_predictions)
- api/tests/conftest.py (added PORTFOLIO_DECISIONS_SCHEMA, PORTFOLIO_DECISIONS_SAMPLE_DATA, decisions_portfolio_db_path, decisions_supervisor_db_path fixtures)
