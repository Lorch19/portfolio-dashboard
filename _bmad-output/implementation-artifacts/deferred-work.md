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
