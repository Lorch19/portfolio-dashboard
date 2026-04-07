# Deferred Work

## Deferred from: code review of story 1-1 (2026-04-04)

- Empty database paths silently accepted as defaults in `api/src/config.py` — empty string defaults will cause confusing errors when DB code is added. Validate on startup in Story 1.2.
- Health check at `GET /` returns "ok" unconditionally without checking dependencies — add DB connectivity check in Story 1.2.
- CI workflows only trigger on `api/**` or `frontend/**` paths — changes to root files or workflow definitions don't trigger CI. Consider adding root path triggers or a separate workflow.
- API CI pipeline has no linter or test step beyond `uv sync` — add `ruff check` and pytest once tests exist.
- Frontend ships full Vite starter template (App.tsx, App.css, assets) as dead code — will be replaced by app shell in Story 1.3.
- CORS middleware missing `allow_credentials=True` — not needed for current read-only GET-only API, but will need to be added if auth is introduced.

## Deferred from: code review of story 1-2 (2026-04-04)

- f-string in sqlite3 URI fragile with special path chars — `f"file:{db_path}?mode=ro"` in `connection.py` would break on paths containing `?`, `#`, `%`. Low risk since paths come from env vars.
- `get_recent_alerts` limit parameter unbounded — No upper-bound validation in `supervisor.py`. Not currently exposed to HTTP input but should be clamped if ever user-facing.
- File paths disclosed in error messages — Absolute filesystem paths leak in error strings to API consumers via `connection.py`. Acceptable for internal dashboard use.

## Deferred from: code review of story 1-3 (2026-04-04)

- `useIsMobile` returns false on first render — shadcn's `use-mobile.ts` initializes state as `undefined` (coerced to false), causing a brief desktop layout flash on mobile devices before the useEffect fires. This is a shadcn library behavior, not fixable without patching the library.
- `apiClient` doesn't catch network-level TypeError from fetch() — when offline or DNS fails, fetch() throws a TypeError that bypasses the res.ok guard. Will be addressed when real data fetching is built (Story 1.4+).
- `apiClient` doesn't check Content-Type before res.json() — non-JSON responses (502 HTML pages, 204 empty) would throw opaque parse errors. Same timeline as above.
- Sidebar cookie missing SameSite/Secure attributes — shadcn sidebar stores state in a cookie without SameSite=Lax or Secure flag. Low risk (UI preference only), shadcn library code.
- Sidebar keyboard shortcut (Ctrl/Cmd+B) fires inside inputs/textareas — no event.target check in shadcn's keydown handler. Will conflict with bold shortcuts in form fields. Shadcn library code.
- MobileHeader Sheet doesn't close on browser back — Sheet open state is pure React state, not tied to browser history. Pressing back navigates away instead of closing the drawer. Low priority UX polish.
- Tablet icon-only sidebar not automatic — shadcn sidebar's `collapsible="icon"` only collapses on user toggle, not on viewport width. Spec says 768-1024px should auto-collapse to icon-only (56px). Deferred as UX polish for a future story.

## Deferred from: code review of story 1-4 (2026-04-04)

- Health test doesn't test the composed HealthPage component — tests verify individual child components but never render HealthPage with mocked useHealth to test conditional rendering, loading/error paths, or green board effect as wired.
- `aria-live="polite"` on wrapper div removed during loading transition — when isLoading is true, the entire component returns HealthSkeleton, so the live region is destroyed and recreated rather than updated in-place. Screen readers won't announce the loading→loaded transition.
- Alert `data` field never rendered — AlertEvent has a `data: string | null` field but AlertsList only shows source and event_type. If data contains alert descriptions, they are hidden from the user. Future enhancement for expandable alert rows.

## Deferred from: code review of story 2-1 (2026-04-04)

- Hold-point state logic incomplete — `hold_point_triggered` events match the query but state derivation only checks for "pause"/"halt". Unknown real event semantics; revisit when wiring to production data.
- Hold point query doesn't check health_checks table — spec Task 2.2 says "also check health_checks for drawdown/pause indicators" but implementation only queries events table. Unclear if health_checks contains hold-point data in production.
- Shadow observer query missing strategy_id/timestamp columns — spec describes these columns but test schema from Story 1.2 doesn't include them. Production schema may differ. Verify against real supervisor DB.
- No authentication on /api/supervisor — architecture doc explicitly defers auth to post-MVP phase.
- Error messages leak filesystem paths to API consumers — pre-existing pattern from health.py, acceptable for internal dashboard.
- `data`/`details` columns returned as raw JSON strings not parsed objects — pre-existing pattern from health.py, frontend must JSON.parse().

## Deferred from: code review of story 2-2 (2026-04-05)

- Naive timestamps (no `Z` suffix) from DB parsed as local time by JS `Date()` — can skew relative time display by the user's UTC offset. Pre-existing in format-time.ts, affects all tabs. Normalise timestamps at the API boundary or in formatRelativeTime.
- `apiClient` doesn't catch network-level TypeError from fetch() — raw "Failed to fetch" shown to user when server unreachable. Already noted in story 1-3 deferred work.
- Test schema in conftest.py events table omits `strategy_id`, `timestamp`, `processed` columns that exist in the documented production schema. Already noted in story 2-1 deferred work.

## Deferred from: code review of story 3-1 (2026-04-05)

- No input validation on `scan_date` format — accepts any string (e.g. "not-a-date"), returns zero counts instead of 400. Not in AC scope; consider adding validation when frontend sends dates.
- No test for whitespace-only `scan_date` parameter — `scan_date= ` passes through as truthy string, produces "No funnel data for  " message with trailing space. Low-priority cosmetic edge case.

## Deferred from: code review of story 3-2 (2026-04-06)

- `validateSearch` has no date format validation — low risk with native date input enforcing format, but non-standard URL manipulation could pass invalid strings. Pre-existing pattern from TanStack Router usage.
- DrilldownTable row key uses index (`${entry.ticker}-${i}`) — minor React reconciliation concern if entries reorder. Low priority.

## Deferred from: code review of story 4-1 (2026-04-06)

- `date.today()` in get_open_positions is non-deterministic — makes days_held assertions date-dependent. Test computes expected value dynamically so assertions are correct, but freezing time would be more robust.
- No pagination or row limit on positions query — `.fetchall()` with no LIMIT in get_open_positions. Single-user dashboard unlikely to have large position counts.
- Exception detail leaks filesystem paths to API consumers — pre-existing pattern from health.py and all other routers. Acceptable for internal dashboard.
- No authentication on /api/holdings — architecture doc explicitly defers auth to post-MVP phase.
- Floating-point P&L arithmetic instead of Decimal — `round(..., 2)` on float multiplication may have sub-cent artifacts. Acceptable precision for dashboard display.
- FunnelChart hardcodes `scout_universe` as max bar denominator — bars could overflow 100% if backend ever returns a stage count exceeding scout_universe. Unlikely edge case.
- `aria-live="polite"` wraps skeleton render — screen readers may announce skeleton nodes before real data. Matches pre-existing pattern from health tab (story 1-4 deferred).
- All-zero stages render 1% minimum-width bars — confusing visual for empty data. Backend message field partially addresses this. Cosmetic polish.
- No `max` attribute on date input — users can select future dates with no data. Cosmetic UX guard.

## Deferred from: code review of story 5-1 (2026-04-06)

- Error messages leak internal filesystem paths in performance endpoint — pre-existing pattern across all routers (health, funnel, holdings). Acceptable for internal dashboard.
- No pagination or rate limiting on /api/performance — architecture explicitly defers pagination and caching. Single-user dashboard.

## Deferred from: code review of story 4-2 (2026-04-07)

- No runtime validation of API data (zod/etc) between API response and component rendering — project-wide pattern, not specific to this story. Malformed API data (e.g., missing fields) would cause runtime errors in formatCurrency, RiskBadge division, etc.
- Mobile card touch target min-height not explicitly enforced — AC7 specifies 44x44px minimum touch targets. CardContent has p-3 (12px padding) but no explicit min-h constraint. Touch targets likely sufficient due to text content height but not guaranteed.

## Deferred from: code review of story 5-2 (2026-04-07)

- Exception messages leaked to client via _error fields (snapshots_error, portfolio_summary_error) — pre-existing pattern across all endpoints. Internal paths/details exposed. Acceptable for internal dashboard.
- No pagination/LIMIT on get_portfolio_snapshots query — pre-existing architectural choice (no pagination on any endpoint). Daily snapshots bounded to ~thousands of rows.
- Win Rate KPI always shows dash — deferred to Story 5.3 (prediction accuracy data not in portfolio_summary).

## Deferred from: code review of story 6-1 (2026-04-07)

- `all_keys` list duplicated from `extended_cols` in `get_recent_decisions` — cosmetic refactor, no shared constant [api/src/db/portfolio.py]
- No auth or rate limiting on `/api/decisions` — architecture explicitly defers auth to post-MVP
- Error messages leak filesystem paths in `_error` fields — pre-existing pattern across all routers, acceptable for internal dashboard

## Deferred from: code review of story 5-3 (2026-04-07)

- KPI card rendering logic duplicated between `PerformanceKpiCards` and `PredictionAccuracySection` — cosmetic DRY concern, extract shared `KpiCard` component in future refactor
- `beating_random: null` displays as destructive (red) styling — type allows null but no distinct null UI state. Ambiguous for unknown calibration state.
- Session filter dropdown hidden when only one session exists but URL session param still filters silently — edge case where manually-crafted URL could show empty table with no filter to clear
