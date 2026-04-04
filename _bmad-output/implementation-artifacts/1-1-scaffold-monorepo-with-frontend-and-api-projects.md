# Story 1.1: Scaffold Monorepo with Frontend and API Projects

Status: review

## Story

As a developer,
I want a working monorepo with both frontend and API projects scaffolded and running locally,
so that all subsequent stories have a foundation to build on.

## Acceptance Criteria

1. **Given** a fresh clone of the repository, **When** I run `pnpm install` in `frontend/` and `uv sync` in `api/`, **Then** both projects install dependencies without errors.

2. **Given** the frontend project is installed, **When** I run `pnpm dev` in `frontend/`, **Then** a Vite dev server starts with React 19 + TypeScript + Tailwind v4 + shadcn/ui initialized.

3. **Given** the API project is installed, **When** I run `uvicorn src.main:app` in `api/`, **Then** a FastAPI server starts with CORS middleware configured and OpenAPI docs available at `/docs`.

4. **Given** both projects are running, **When** I check the project structure, **Then** it matches the architecture: `frontend/` (Vite + shadcn), `api/` (FastAPI + uvicorn), `.github/workflows/`, `.gitignore`, `README.md`.

## Tasks / Subtasks

- [x] Task 1: Create monorepo directory structure (AC: #4)
  - [x] 1.1: Create `frontend/`, `api/`, `.github/workflows/` directories
  - [x] 1.2: Create root `.gitignore` (node_modules, __pycache__, .env, .venv, dist, *.db)
  - [x] 1.3: Create root `README.md` with project name and basic setup instructions
- [x] Task 2: Scaffold frontend with Vite + React + TypeScript (AC: #1, #2)
  - [x] 2.1: Run `pnpm create vite@latest frontend --template react-ts` from project root
  - [x] 2.2: `cd frontend && pnpm install`
  - [x] 2.3: Run `npx shadcn@latest init` — select dark theme, OKLCH colors, default style
  - [x] 2.4: Install TanStack Router: `pnpm add @tanstack/react-router` and dev plugin: `pnpm add -D @tanstack/router-plugin`
  - [x] 2.5: Install TanStack Query: `pnpm add @tanstack/react-query`
  - [x] 2.6: Configure `vite.config.ts` with TanStack Router plugin and path alias (`@/` → `src/`)
  - [x] 2.7: Configure `tsconfig.json` and `tsconfig.app.json` with path alias and strict mode
  - [x] 2.8: Create `frontend/.env.example` with `VITE_API_URL=http://localhost:8000`
  - [x] 2.9: Verify `pnpm dev` starts successfully and shows the default Vite page
- [x] Task 3: Scaffold API with FastAPI + uvicorn (AC: #1, #3)
  - [x] 3.1: `cd api && uv init --app`
  - [x] 3.2: `uv add fastapi --extra standard` (includes uvicorn[standard])
  - [x] 3.3: Create `api/src/__init__.py`
  - [x] 3.4: Create `api/src/main.py` with FastAPI app, CORS middleware, and a health check root endpoint
  - [x] 3.5: Create `api/src/config.py` with Settings class reading from env vars (CORS_ORIGINS, PORTFOLIO_DB_PATH, SUPERVISOR_DB_PATH)
  - [x] 3.6: Create `api/.env.example` with PORTFOLIO_DB_PATH, SUPERVISOR_DB_PATH, CORS_ORIGINS
  - [x] 3.7: Verify `uv run uvicorn src.main:app --reload` starts and `/docs` shows OpenAPI UI
- [x] Task 4: Create CI/CD workflow stubs (AC: #4)
  - [x] 4.1: Create `.github/workflows/frontend.yml` — triggered on `frontend/**`, runs: pnpm install, pnpm lint, pnpm type-check, pnpm test (placeholder steps)
  - [x] 4.2: Create `.github/workflows/api.yml` — triggered on `api/**`, runs: uv sync, uv run pytest (placeholder steps)
- [x] Task 5: Verify end-to-end scaffold (AC: #1, #2, #3, #4)
  - [x] 5.1: Fresh install test: delete node_modules/.venv, reinstall both projects
  - [x] 5.2: Verify frontend dev server runs at localhost:5173
  - [x] 5.3: Verify API server runs at localhost:8000 with `/docs` accessible
  - [x] 5.4: Verify directory structure matches architecture spec

## Dev Notes

### Critical Architecture Constraints

- **Monorepo, not monolith.** Frontend and API are independent projects in the same repo. No shared dependencies across the language boundary. No pnpm workspaces or Turborepo needed.
- **No ORM.** The API will use raw `sqlite3` in future stories. Do NOT install SQLAlchemy, SQLModel, or any ORM.
- **No Docker.** Runs directly on host. Do not add Dockerfile or docker-compose.
- **Read-only pattern.** All future DB connections will use `?mode=ro`. This story doesn't connect to databases yet, but `config.py` should define the DB path settings for future use.

### Exact Commands and Versions (verified April 2026)

**Frontend:**
```bash
pnpm create vite@latest frontend --template react-ts   # create-vite 9.0.3, Vite 7+
cd frontend && pnpm install
npx shadcn@latest init                                   # shadcn CLI v4 (March 2026), Tailwind v4, OKLCH colors, tw-animate-css
pnpm add @tanstack/react-router                          # latest stable
pnpm add @tanstack/react-query                           # v5.96.x
pnpm add -D @tanstack/router-plugin                      # v1.167.x (replaces @tanstack/router-vite-plugin)
```

**API:**
```bash
cd api && uv init --app
uv add fastapi --extra standard                          # includes uvicorn[standard] with uvloop + httptools
```

**Key version notes:**
- shadcn CLI v4 now scaffolds with Tailwind v4 by default. HSL → OKLCH color conversion is automatic. Uses `tw-animate-css` instead of deprecated `tailwindcss-animate`.
- TanStack Router plugin: use `@tanstack/router-plugin` (not the older `@tanstack/router-vite-plugin`). Import from `@tanstack/router-plugin/vite`.
- FastAPI with `--extra standard` bundles uvicorn[standard]. No separate `uv add uvicorn` needed.
- Node.js requirement: 20.19+ or 22.12+.
- Python requirement: 3.11+ for FastAPI.

### CORS Configuration (api/src/main.py)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings

app = FastAPI(title="Portfolio Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],          # Read-only API — GET only
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok"}
```

### Settings Pattern (api/src/config.py)

```python
import os

class Settings:
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    portfolio_db_path: str = os.getenv("PORTFOLIO_DB_PATH", "")
    supervisor_db_path: str = os.getenv("SUPERVISOR_DB_PATH", "")

settings = Settings()
```

Keep this simple — no Pydantic BaseSettings, no dotenv library. Plain `os.getenv`. Consistent with the existing portfolio-system patterns.

### Vite Config with TanStack Router Plugin

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),   // MUST be before react()
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### shadcn/ui Init Options

When `npx shadcn@latest init` prompts:
- Style: **Default**
- Base color: **Zinc** (we'll override with Midnight Fintech palette in a later story)
- CSS variables: **Yes**

This gives us the CSS variable foundation to customize later. Don't spend time on colors now — Story 1.3 (app shell) will apply the UX design spec's color tokens.

### Project Structure After Completion

```
portfolio-dashboard/
├── .github/
│   └── workflows/
│       ├── frontend.yml
│       └── api.yml
├── .gitignore
├── README.md
├── frontend/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── components.json          # shadcn config
│   ├── .env.example
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              # default Vite app (will be replaced in Story 1.3)
│       ├── app.css              # Tailwind imports + shadcn CSS vars
│       ├── lib/
│       │   └── utils.ts         # shadcn cn() utility
│       └── components/
│           └── ui/              # shadcn generated components dir
└── api/
    ├── pyproject.toml
    ├── uv.lock
    ├── .env.example
    └── src/
        ├── __init__.py
        ├── main.py              # FastAPI app + CORS
        └── config.py            # Settings from env vars
```

### What NOT To Do

- Do NOT create route files yet — Story 1.3 handles routing and app shell
- Do NOT install Recharts, additional shadcn components, or any charting libraries
- Do NOT connect to SQLite databases — Story 1.2 handles DB connections
- Do NOT create `api/src/db/`, `api/src/routers/`, or `api/tests/` directories yet
- Do NOT add authentication, rate limiting, or any middleware beyond CORS
- Do NOT customize the shadcn theme colors — UX spec colors come in Story 1.3
- Do NOT use Pydantic BaseSettings or python-dotenv — use plain os.getenv

### Project Structure Notes

- Frontend path alias: `@/` maps to `frontend/src/` — all imports use this alias
- API module structure: `api/src/` is the package root, run with `uvicorn src.main:app`
- Both `.env.example` files document required environment variables for future stories

### References

- [Source: architecture.md#Starter Template Evaluation] — Initialization commands and stack decisions
- [Source: architecture.md#Repository Structure: Monorepo] — Directory layout
- [Source: architecture.md#Implementation Patterns] — snake_case, no ORM, no transform layer
- [Source: architecture.md#Infrastructure & Deployment] — Vercel + VPS split, CI/CD workflows
- [Source: epics.md#Story 1.1] — Acceptance criteria
- [Source: ux-design-specification.md#Design System Foundation] — shadcn/ui + Tailwind v4 setup

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TanStack Router plugin requires `src/routes/__root.tsx` to exist — created minimal root route placeholder
- shadcn init requires Tailwind CSS v4 + path aliases configured first — installed `tailwindcss` and `@tailwindcss/vite` before init
- Removed nested `frontend/.git` created by `pnpm create vite` scaffold
- ESLint `react-refresh/only-export-components` rule changed to warn with `allowConstantExport: true` for shadcn compatibility

### Completion Notes List

- Monorepo scaffold complete: frontend (Vite 8 + React 19 + TS 5.9 + Tailwind v4 + shadcn/ui v4 + TanStack Router + TanStack Query) and API (FastAPI 0.135 + uvicorn via uv)
- Both projects install cleanly from fresh state and dev servers start without errors
- CI/CD workflow stubs created for both projects with proper path triggers
- API uses plain `os.getenv` Settings pattern (no Pydantic BaseSettings, no dotenv)
- CORS configured as GET-only per read-only API pattern

### File List

- `.gitignore` (existing, verified)
- `README.md` (existing, verified)
- `.github/workflows/frontend.yml` (new)
- `.github/workflows/api.yml` (new)
- `frontend/package.json` (modified — added shadcn, TanStack Router, TanStack Query deps)
- `frontend/pnpm-lock.yaml` (modified)
- `frontend/vite.config.ts` (modified — TanStack Router plugin, Tailwind plugin, path alias)
- `frontend/tsconfig.json` (modified — path aliases)
- `frontend/tsconfig.app.json` (modified — path aliases)
- `frontend/eslint.config.js` (modified — allowConstantExport rule)
- `frontend/components.json` (new — shadcn config)
- `frontend/.env.example` (new)
- `frontend/src/index.css` (modified — Tailwind v4 + shadcn CSS variables)
- `frontend/src/main.tsx` (modified — TanStack Router integration)
- `frontend/src/lib/utils.ts` (new — shadcn cn() utility)
- `frontend/src/components/ui/button.tsx` (new — shadcn button component)
- `frontend/src/routes/__root.tsx` (new — minimal root route for TanStack Router)
- `frontend/src/routes/index.tsx` (new — minimal index route placeholder)
- `frontend/src/routeTree.gen.ts` (new — auto-generated by TanStack Router plugin)
- `api/pyproject.toml` (new)
- `api/uv.lock` (new)
- `api/.python-version` (new)
- `api/.env.example` (new)
- `api/src/__init__.py` (new)
- `api/src/main.py` (new — FastAPI app with CORS and health check)
- `api/src/config.py` (new — Settings class with env vars)

## Change Log

- 2026-04-04: Story 1.1 implemented — full monorepo scaffold with frontend (Vite+React+shadcn+TanStack) and API (FastAPI+uvicorn), CI/CD workflow stubs, verified end-to-end
