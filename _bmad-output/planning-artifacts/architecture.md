---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-04'
inputDocuments:
  - _bmad-output/PRD.md
workflowType: 'architecture'
project_name: 'portfolio-dashboard'
user_name: 'Omri'
date: '2026-04-04'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- 8 dashboard tabs covering: system health/heartbeat, supervisor events/hold points, decision funnel visualization, current holdings with P&L, performance vs SPY benchmark, per-ticker decision reasoning, cost tracking (brokerage + API + infra), and debug tooling
- Per-cycle funnel drill-down (Scout 1,520 → Radar → Guardian → Michael)
- Raw SQLite event bus viewer (supervisor DB events table)
- Agent log viewer with filtering by agent, date, severity
- Pipeline replay per cycle

**Non-Functional Requirements:**
- Read-only: zero write operations to pipeline databases
- Mobile responsive: full functionality on mobile (primary user monitors on-the-go)
- Investor-grade UI: credible, professional design — not a dev tool aesthetic
- 3-second load target on standard connection
- Extensible: new agents and data sources addable without dashboard restructuring
- Future: authentication layer for external viewer access

**Scale & Complexity:**
- Primary domain: Full-stack web (frontend dashboard + backend API)
- Complexity level: Medium
- Estimated architectural components: ~4 (frontend, API layer, DB access, deployment)

### Technical Constraints & Dependencies

- Data lives in two SQLite databases on a Hetzner VPS (file-based, no network protocol)
- portfolio.db: 28 tables, ~21 schema migrations, WAL mode
- michael_supervisor.db: 5 tables (events, predictions, eval_results, health_checks, sync_state)
- Existing ReportAssembler (src/export/assembler.py) already queries portfolio.db
- Existing CLI (michael-supervisor/cli.py) already queries supervisor DB with --json output
- Supervisor DataBridge reads portfolio.db in read-only mode (?mode=ro) — established pattern
- Both v1 (cron pipeline) and v2 (supervisor daemon) coexist (Strangler Fig migration)

### Cross-Cutting Concerns Identified

- Network access to VPS-hosted SQLite (core architectural decision)
- Data freshness: pipeline runs MWF, supervisor syncs every 30min, health checks every 5min
- Mobile responsiveness across all 8 tabs including data-heavy tables
- Extensibility pattern for adding new agents/tabs without restructuring
- Future authentication for external (investor) access

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web: React SPA (Vercel) + Python API (Hetzner VPS)

### Repository Structure: Monorepo

Single repository (`portfolio-dashboard`) with two subdirectories, independently deployed:

```
portfolio-dashboard/
├── frontend/          # React SPA → deployed to Vercel
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── api/               # FastAPI service → deployed to Hetzner VPS
│   ├── src/
│   ├── pyproject.toml
│   └── uv.lock
├── .github/           # Shared CI/CD (separate workflows per subdirectory)
├── .gitignore
└── README.md
```

Monorepo rationale: single PR for coordinated frontend+API changes, shared CI/CD config, unified versioning. No workspace tooling needed (pnpm workspaces / Turborepo) — the two projects have no shared dependencies across language boundaries.

### Frontend Starter: Vite + React + TypeScript

**Initialization:**
```bash
pnpm create vite@latest frontend --template react-ts
cd frontend
npx shadcn@latest init
```

**Stack Decisions:**
- React 19 + TypeScript (strict) via Vite 7+
- Tailwind CSS v4 + shadcn/ui (Radix primitives, investor-grade components)
- TanStack Router (type-safe routing, typed search params for filters)
- TanStack Query (server state, polling, cache invalidation for live data)
- Vitest + Testing Library (testing)
- pnpm (package manager)

**Rationale:** Official Vite template + shadcn/ui init is the documented, maintained path. No third-party boilerplate opinions to fight. TanStack Router chosen over React Router v7 for superior SPA type safety and search param handling — critical for filter-heavy dashboard tabs.

### Backend Starter: Minimal FastAPI

**Initialization:**
```bash
cd api
uv init
uv add fastapi uvicorn
```

**Stack Decisions:**
- FastAPI + uvicorn (ASGI server)
- uv (package management)
- Raw sqlite3 (no ORM — consistent with portfolio-system codebase)
- Read-only DB connections (?mode=ro) matching existing DataBridge pattern
- CORS middleware for Vercel frontend

**Rationale:** Minimal setup keeps the API layer thin and consistent with the existing Python/SQLite/raw-SQL patterns in portfolio-system. No Docker initially — runs alongside the pipeline on the VPS.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data access pattern: Direct SQLite read on VPS
- API design: RESTful, all-GET, tab-oriented endpoints
- Monorepo structure: /frontend + /api
- Deployment split: Vercel (frontend) + Hetzner VPS (API)

**Important Decisions (Shape Architecture):**
- Caching/freshness strategy per tab via TanStack Query
- Component architecture: route-per-tab, query-hook-per-endpoint
- Charting: Recharts via shadcn/ui chart components
- nginx reverse proxy with Let's Encrypt

**Deferred Decisions (Post-MVP):**
- Authentication & authorization (deferred until investor access phase)
- Server-side caching (SQLite reads sufficient for single-user)
- Docker containerization
- Pagination (data volumes manageable)

### Data Architecture

**Database Access:** FastAPI reads both SQLite databases directly on the VPS using sqlite3 with `?mode=ro` (read-only). Matches the existing DataBridge pattern.
- `portfolio.db`: 28 tables (pipeline data, holdings, trades, funnel, costs)
- `michael_supervisor.db`: 5 tables (events, predictions, eval_results, health, sync)

**Caching Strategy (TanStack Query client-side):**

| Data type | Staleness | refetchInterval / staleTime |
|-----------|-----------|----------------------------|
| Health, Supervisor | ~30s | refetchInterval: 30s |
| Holdings/positions | ~5min | staleTime: 5min |
| Funnel/decisions | ~15min | staleTime: 15min |
| Performance/costs | ~1hr | staleTime: 60min |
| Debug/event bus | On-demand | Manual refresh only |

No server-side caching initially. Add in-memory TTL cache if needed.

### Authentication & Security

**MVP:** No authentication. API bound behind nginx, CORS restricted to Vercel frontend domain. All endpoints read-only — no mutations, no sensitive writes.

**Post-MVP:** API key or JWT middleware + Vercel password protection for investor access. Read-only API design makes auth a single middleware addition.

### API & Communication Patterns

**REST API — all GET, organized by dashboard tab:**

```
GET /api/health          → agent statuses, heartbeats, VPS metrics, alerts
GET /api/supervisor      → shadow observer feed, hold points, strangler fig status
GET /api/funnel          → per-cycle funnel data (params: date, cycle)
GET /api/holdings        → open positions, P&L, sleeve allocation
GET /api/performance     → portfolio P&L, CAGR, calibration, arena comparison
GET /api/decisions       → per-ticker reasoning, F-Score, predictions (params: ticker)
GET /api/costs           → brokerage, API costs, VPS costs, cost-per-trade
GET /api/debug/events    → raw event bus viewer (params: source, type, since, limit)
GET /api/debug/logs      → agent logs (params: agent, date, severity)
GET /api/debug/replay    → pipeline replay per cycle (param: date)
```

Standard error shape: `{ "error": string, "detail": string }`
OpenAPI docs auto-generated at `/docs`. No GraphQL.

### Frontend Architecture

**State Management:** TanStack Query for all server state (no Redux/Zustand). React useState/useContext for tab-local UI state only.

**Routing:** TanStack Router with file-based routes. One route per tab. Typed search params for filters, date pickers, drill-downs.

**Component Structure:**

```
frontend/src/
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx       # Shell layout (nav + tabs)
│   ├── health.tsx
│   ├── supervisor.tsx
│   ├── funnel.tsx
│   ├── holdings.tsx
│   ├── performance.tsx
│   ├── decisions.tsx
│   ├── costs.tsx
│   └── debug/
│       ├── events.tsx
│       ├── logs.tsx
│       └── replay.tsx
├── api/                 # TanStack Query hooks per endpoint
│   ├── useHealth.ts
│   ├── useSupervisor.ts
│   ├── useFunnel.ts
│   └── ...
├── components/          # Shared UI (charts, tables, status badges)
├── lib/                 # Utilities, formatters, constants
└── styles/              # Tailwind config, global styles
```

**Charting:** Recharts via shadcn/ui chart components. Full design control for investor-grade custom visualizations by Whiteport (UX designer).

### Infrastructure & Deployment

**Frontend → Vercel:**
- Auto-deploy from `frontend/` subdirectory on push to main
- Build: `pnpm build`
- Env: `VITE_API_URL` → VPS API endpoint (nginx HTTPS)

**Backend → Hetzner VPS:**
- FastAPI as systemd service
- uvicorn behind nginx reverse proxy
- nginx handles HTTPS via Let's Encrypt
- Deploy: GitHub Actions SSH → git pull → restart service
- Reads both `.db` files directly (colocated with pipeline)

**CI/CD (GitHub Actions):**
- `frontend.yml` — path-filtered on `frontend/**`, lint + type-check + test
- `api.yml` — path-filtered on `api/**`, lint + test, SSH deploy to VPS

**Monitoring:**
- API logs to stdout → systemd journal
- healthchecks.io ping from API (matching supervisor pattern)
- Vercel analytics (free tier) for frontend

### Decision Impact Analysis

**Implementation Sequence:**
1. API scaffolding (FastAPI + sqlite3 read-only connections to both DBs)
2. Frontend scaffolding (Vite + shadcn + TanStack Router shell with 8 tabs)
3. First endpoint + first tab (Health — fastest feedback loop)
4. Remaining tabs iteratively
5. nginx + HTTPS setup on VPS
6. CI/CD workflows
7. Polish + investor-grade styling with Whiteport

**Cross-Component Dependencies:**
- Frontend polling intervals depend on API response times (optimize if >1s)
- TanStack Router search params must match API query param contracts
- CORS config must be coordinated between nginx and FastAPI
- Vercel `VITE_API_URL` must point to nginx HTTPS endpoint

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database:** Read-only access to existing tables. All column names are `snake_case` (e.g., `scan_date`, `pnl_pct`, `strategy_id`). Match what exists — no renaming.

**API (Python/FastAPI):**
- Endpoints: lowercase, plural for collections — `/api/health`, `/api/debug/events`
- Query params: `snake_case` — `scan_date`, `event_type`, `since` (matches DB columns directly)
- Response JSON keys: `snake_case` — consistent with database and Python codebase

**Frontend (TypeScript/React):**
- Components: `PascalCase` files and exports — `HealthTab.tsx`, `FunnelChart.tsx`
- Hooks: `camelCase` with `use` prefix — `useHealth.ts`, `useFunnel.ts`
- Utilities: `camelCase` — `formatCurrency.ts`, `formatDate.ts`
- Variables/functions: `camelCase` in TypeScript code
- JSON from API arrives as `snake_case` — **no auto-transformation**. Access as `data.pnl_pct` in TypeScript. Keeps the contract transparent.

### Structure Patterns

**Tests:**
- Frontend: co-located — `HealthTab.test.tsx` next to `HealthTab.tsx`
- API: separate directory — `api/tests/test_health.py`, `api/tests/test_funnel.py` (matches Python conventions and existing portfolio-system structure)

**Component organization:** By feature (tab), not by type. Each tab is self-contained in its route file. Shared components (status badges, data tables, chart wrappers) go in `components/`. No type-based folders.

### Format Patterns

**API Response Format — direct response, no wrapper:**
```json
// Success: return the data directly
{ "agents": [...], "heartbeats": {...}, "vps_metrics": {...} }

// Error: standard shape
{ "error": "not_found", "detail": "No scan data for 2026-04-04" }
```
No `{ "data": ..., "success": true }` envelope. HTTP status codes carry the success/failure signal.

**Date/time format:** ISO 8601 strings everywhere (`2026-04-04T06:35:00Z`). Existing databases already use ISO text format. No Unix timestamps.

**Null handling:** Return `null` in JSON for missing values. Don't omit keys — the frontend should always see a predictable shape.

### Process Patterns

**Loading states:**
- TanStack Query provides `isLoading`, `isError`, `data` — use these directly
- Each tab handles its own loading/error states (no global loading overlay)
- Skeleton components from shadcn/ui for loading states (investor-grade, not spinners)
- Pattern: `if (isLoading) return <Skeleton />; if (isError) return <ErrorCard />;`

**Error handling:**
- API: FastAPI exception handlers return `{ "error", "detail" }` with appropriate HTTP codes (400, 404, 500)
- Frontend: `ErrorCard` component per tab showing error detail + retry button
- No toast notifications — errors are inline where the data would be
- API logs errors to stdout (systemd journal captures them)

**DB connection pattern (API):**
- One read-only connection per database, created at startup
- FastAPI dependency injection: `get_portfolio_db()` and `get_supervisor_db()`
- All queries use parameterized SQL — no string interpolation, ever
- Connection opened with `?mode=ro` — enforced at the sqlite3 level

### Enforcement Guidelines

**All AI agents MUST:**
1. Use `snake_case` for all API params, response keys, and DB column references
2. Use `PascalCase` for React components, `camelCase` for TS functions/variables
3. Co-locate frontend tests, separate API tests in `api/tests/`
4. Return raw JSON (no envelope wrapper) from all API endpoints
5. Use ISO 8601 for all dates in API responses
6. Use parameterized SQL queries — never interpolate values into SQL strings
7. Handle loading/error states inline per tab using TanStack Query states
8. Open SQLite connections with `?mode=ro` — no exceptions

### Anti-Patterns to Avoid

- **Don't** create a camelCase ↔ snake_case transform layer
- **Don't** wrap API responses in `{ data, success, message }` envelopes
- **Don't** create a shared DB connection pool or ORM abstraction
- **Don't** use global state management (Redux, Zustand, context providers for server data)
- **Don't** add loading spinners — use shadcn skeleton components
- **Don't** create utility files with single functions — inline simple logic

## Project Structure & Boundaries

### Complete Project Directory Structure

```
portfolio-dashboard/
├── .github/
│   └── workflows/
│       ├── frontend.yml          # Lint + type-check + test on frontend/** changes
│       └── api.yml               # Lint + test + SSH deploy on api/** changes
├── .gitignore
├── README.md
│
├── frontend/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tailwind.config.ts
│   ├── components.json           # shadcn/ui config
│   ├── .env.example              # VITE_API_URL=https://api.example.com
│   ├── index.html
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.tsx              # App entry point
│       ├── app.css               # Global styles / Tailwind imports
│       ├── routeTree.gen.ts      # TanStack Router auto-generated
│       │
│       ├── routes/               # File-based routes (one per tab)
│       │   ├── __root.tsx        # Shell layout: sidebar nav + tab container
│       │   ├── index.tsx         # Redirect to /health (default tab)
│       │   ├── health.tsx        # System & Health tab
│       │   ├── supervisor.tsx    # Supervisor tab
│       │   ├── funnel.tsx        # Funnel tab
│       │   ├── holdings.tsx      # Holdings tab
│       │   ├── performance.tsx   # Performance tab
│       │   ├── decisions.tsx     # Decisions tab
│       │   ├── costs.tsx         # Costs tab
│       │   └── debug/
│       │       ├── route.tsx     # Debug layout (sub-nav: events/logs/replay)
│       │       ├── events.tsx    # Raw event bus viewer
│       │       ├── logs.tsx      # Agent log viewer
│       │       └── replay.tsx    # Pipeline replay
│       │
│       ├── api/                  # TanStack Query hooks (one per endpoint)
│       │   ├── client.ts         # Shared fetch wrapper (base URL, error handling)
│       │   ├── useHealth.ts
│       │   ├── useSupervisor.ts
│       │   ├── useFunnel.ts
│       │   ├── useHoldings.ts
│       │   ├── usePerformance.ts
│       │   ├── useDecisions.ts
│       │   ├── useCosts.ts
│       │   ├── useDebugEvents.ts
│       │   ├── useDebugLogs.ts
│       │   └── useDebugReplay.ts
│       │
│       ├── components/           # Shared UI components
│       │   ├── ui/               # shadcn/ui generated components
│       │   ├── Shell.tsx         # App shell (sidebar + content area)
│       │   ├── StatusBadge.tsx   # Agent status indicator (healthy/degraded/down)
│       │   ├── DataTable.tsx     # Reusable table with sorting/filtering
│       │   ├── ErrorCard.tsx     # Inline error display with retry
│       │   ├── ChartCard.tsx     # Chart container with title + loading state
│       │   └── DateRangePicker.tsx
│       │
│       ├── lib/                  # Utilities
│       │   ├── formatters.ts     # formatCurrency, formatPct, formatDate
│       │   └── constants.ts      # Refetch intervals, route paths
│       │
│       └── types/                # TypeScript types matching API response shapes
│           ├── health.ts
│           ├── supervisor.ts
│           ├── funnel.ts
│           ├── holdings.ts
│           ├── performance.ts
│           ├── decisions.ts
│           ├── costs.ts
│           └── debug.ts
│
└── api/
    ├── pyproject.toml
    ├── uv.lock
    ├── .env.example              # PORTFOLIO_DB_PATH, SUPERVISOR_DB_PATH, CORS_ORIGINS
    │
    ├── src/
    │   ├── __init__.py
    │   ├── main.py               # FastAPI app, CORS, lifespan (DB init)
    │   ├── config.py             # Settings from env vars
    │   │
    │   ├── db/                   # Database access layer
    │   │   ├── __init__.py
    │   │   ├── connection.py     # Read-only sqlite3 connections + FastAPI deps
    │   │   ├── portfolio.py      # Queries against portfolio.db
    │   │   └── supervisor.py     # Queries against michael_supervisor.db
    │   │
    │   └── routers/              # One router per tab/endpoint group
    │       ├── __init__.py
    │       ├── health.py         # GET /api/health
    │       ├── supervisor.py     # GET /api/supervisor
    │       ├── funnel.py         # GET /api/funnel
    │       ├── holdings.py       # GET /api/holdings
    │       ├── performance.py    # GET /api/performance
    │       ├── decisions.py      # GET /api/decisions
    │       ├── costs.py          # GET /api/costs
    │       └── debug.py          # GET /api/debug/events, /logs, /replay
    │
    └── tests/
        ├── __init__.py
        ├── conftest.py           # Test fixtures (in-memory SQLite with test data)
        ├── test_health.py
        ├── test_supervisor.py
        ├── test_funnel.py
        ├── test_holdings.py
        ├── test_performance.py
        ├── test_decisions.py
        ├── test_costs.py
        └── test_debug.py
```

### Architectural Boundaries

**API Boundary:** The FastAPI app is the only process that touches the SQLite databases. The frontend never accesses databases directly — all data flows through the REST API.

**DB Access Boundary:** `api/src/db/` is the only directory that contains SQL queries.
- `connection.py` — creates and provides read-only connections
- `portfolio.py` — all queries against `portfolio.db` (28 tables)
- `supervisor.py` — all queries against `michael_supervisor.db` (5 tables)
- Routers call db functions, never write SQL themselves

**Frontend Data Boundary:** `frontend/src/api/` is the only directory that makes HTTP requests. Route components consume data via hooks, never call `fetch` directly.

### PRD Tab → File Mapping

| PRD Tab | Frontend Route | API Router | DB Module |
|---------|---------------|------------|-----------|
| System & Health | `health.tsx` | `health.py` | `portfolio.py` + `supervisor.py` |
| Supervisor | `supervisor.tsx` | `supervisor.py` | `supervisor.py` |
| Funnel | `funnel.tsx` | `funnel.py` | `portfolio.py` |
| Holdings | `holdings.tsx` | `holdings.py` | `portfolio.py` |
| Performance | `performance.tsx` | `performance.py` | `portfolio.py` + `supervisor.py` |
| Decisions | `decisions.tsx` | `decisions.py` | `portfolio.py` |
| Costs | `costs.tsx` | `costs.py` | `portfolio.py` + `supervisor.py` |
| Debug | `debug/*.tsx` | `debug.py` | `portfolio.py` + `supervisor.py` |

### Data Flow

```
SQLite DBs (VPS)  →  api/src/db/  →  api/src/routers/  →  nginx (HTTPS)
                                                              ↓
frontend/src/types/  ←  frontend/src/api/  ←  TanStack Query  ←  Vercel CDN
       ↓
frontend/src/routes/  →  frontend/src/components/  →  Browser
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:** All technology choices are compatible — React 19 + Vite 7 + TanStack Router/Query, FastAPI + raw sqlite3 + uvicorn, shadcn/ui + Tailwind v4 + Recharts. No version conflicts.

**Pattern Consistency:** `snake_case` flows unbroken from SQLite → FastAPI → JSON → TypeScript. File-based routing aligns with one-route-per-tab. One-hook-per-endpoint mirrors one-router-per-tab. No contradictions.

**Structure Alignment:** Boundaries are clean — SQL only in `api/src/db/`, HTTP only in `frontend/src/api/`, routers never touch SQL, routes never call fetch.

### Requirements Coverage ✅

**All 8 PRD tabs mapped** to frontend routes, API routers, and DB modules. Every functional requirement has a clear implementation path.

**Non-Functional Requirements:**
- Read-only: enforced at sqlite3 level (`?mode=ro`) + all-GET API
- Mobile responsive: Tailwind + shadcn responsive components
- Investor-grade UI: shadcn/ui + Recharts + Whiteport designer
- 3s load target: Vercel CDN + lightweight queries + TanStack Query caching
- Extensible: new tab = new route + hook + router (repeatable pattern)
- Future auth: deferred, single middleware addition when needed

### Gap Resolutions

Four gaps identified and resolved:

1. **VPS metrics (CPU/memory/disk):** `psutil` in the health endpoint for live CPU/memory. Existing `health_checks` table data for disk space.
2. **Agent logs:** Read from log files on disk via the API (colocated on VPS). Filterable by agent, date, severity.
3. **Strangler Fig migration status:** Static config mapping in `api/src/config.py` tracking which components are v1 (cron) vs v2 (supervisor). Updated manually on graduation.
4. **VPS running cost:** Config constant in `api/src/config.py` — fixed monthly cost. Updated manually.

**Minor note:** Telegram messages aren't fully persisted in the DB. The "recent N alerts" display will source from supervisor `events` table (alert-type events), which captures system events but not verbatim Telegram message text.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (medium)
- [x] Technical constraints identified (2 SQLite DBs on VPS, read-only)
- [x] Cross-cutting concerns mapped (data freshness, mobile, extensibility, future auth)

**✅ Architectural Decisions**
- [x] Critical decisions documented (direct DB read, REST all-GET, monorepo, split deploy)
- [x] Technology stack fully specified with versions
- [x] Caching strategy defined per tab
- [x] Auth deferred with clear future path

**✅ Implementation Patterns**
- [x] Naming conventions established (snake_case through, PascalCase components)
- [x] Structure patterns defined (co-located frontend tests, separate API tests)
- [x] Format patterns specified (no envelope, ISO 8601, null not omit)
- [x] Process patterns documented (skeleton loading, inline errors, parameterized SQL)
- [x] Anti-patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined for both frontend/ and api/
- [x] Component boundaries established (DB layer → Routers → nginx → Query hooks → Routes)
- [x] PRD tabs mapped to specific files
- [x] Data flow documented

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Minimal moving parts — thin API, no ORM, no state management library, no auth layer
- Proven patterns reused from portfolio-system (read-only sqlite3, DataBridge pattern)
- Clean tab-per-route architecture makes each feature independently implementable
- Strong consistency rules prevent AI agent drift

**Areas for Future Enhancement:**
- Server-side caching if API response times exceed 1s
- Authentication when investor access phase begins
- Docker containerization for reproducible deploys
- Pagination if data volumes grow significantly

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries (SQL in db/, fetch in api/, routes in routes/)
- Refer to this document for all architectural questions

**First Implementation Priority:**
1. Scaffold monorepo: `frontend/` (Vite + shadcn) and `api/` (FastAPI + uvicorn)
2. Implement `api/src/db/connection.py` with read-only connections to both DBs
3. Build Health tab end-to-end (fastest feedback loop — API + frontend)
4. Iterate remaining tabs
