# Portfolio Dashboard

Real-time monitoring dashboard for an autonomous portfolio management system.

## Structure

- `frontend/` — React + TypeScript + Vite + shadcn/ui
- `api/` — FastAPI + uvicorn (read-only REST API)

## Setup

### Frontend

```bash
cd frontend
pnpm install
pnpm dev
```

### API

```bash
cd api
uv sync
uv run uvicorn src.main:app --reload
```
