---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-04-04'
inputDocuments:
  - _bmad-output/PRD.md
  - _bmad-output/planning-artifacts/architecture.md
---

# portfolio-dashboard - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for portfolio-dashboard, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Display pipeline status per agent (Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer)
FR2: Display last successful run timestamp per agent
FR3: Display heartbeat status (healthchecks.io integration)
FR4: Display VPS metrics (CPU, memory, disk)
FR5: Display Telegram alert log (recent N alerts)
FR6: Display Shadow Observer feed (real-time supervisor events)
FR7: Display hold points log (HP-1, HP-2, etc.) with approval/rejection status
FR8: Display Strangler Fig migration status (v1 → v2 progress tracker)
FR9: Display active daemon status
FR10: Display per-cycle funnel drop-off: Scout universe (1,520) → Radar filtered → Guardian approved → Michael acted
FR11: Funnel filterable by date/cycle
FR12: Funnel drill-down: which tickers were filtered at each stage and why
FR13: Display current open positions
FR14: Display entry price, current price, unrealized P&L per position
FR15: Display sleeve allocation per position
FR16: Display Guardian risk rule status per position
FR17: Display portfolio P&L (absolute + %)
FR18: Display CAGR vs SPY benchmark
FR19: Display prediction accuracy over T+20 evaluation windows
FR20: Display CalibrationEngine scores
FR21: Display Arena variant comparison (parallel strategy variants)
FR22: Display per-ticker reasoning log
FR23: Display F-Score breakdown per ticker
FR24: Display ROIC / RSI inputs at time of decision
FR25: Display prediction log with outcomes (where T+20 has elapsed)
FR26: Display counterfactual engine output (what would have happened if...)
FR27: Display brokerage fees (per trade + cumulative)
FR28: Display API costs (Anthropic, data providers)
FR29: Display VPS running cost
FR30: Display cost-per-trade metric
FR31: Display total system running cost vs portfolio returns
FR32: Display raw SQLite event bus viewer
FR33: Display agent logs per run (filterable by agent, date, severity)
FR34: Display error stack traces
FR35: Display pipeline replay per cycle (step through what happened)

### NonFunctional Requirements

NFR1: Read-only — no write operations to the pipeline under any circumstances
NFR2: Mobile responsive — full functionality on mobile (Omri monitors on the go)
NFR3: Credible UI — investor-grade design, not a dev tool aesthetic
NFR4: Scalable — new agents and data sources must be addable without restructuring the dashboard
NFR5: Performance — dashboard loads within 3s on standard connection

### Additional Requirements

AR1: Monorepo structure with /frontend and /api subdirectories
AR2: Frontend scaffolding: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + TanStack Router + TanStack Query
AR3: Backend scaffolding: FastAPI + uvicorn + uv + raw sqlite3 with ?mode=ro
AR4: nginx reverse proxy with Let's Encrypt HTTPS on VPS
AR5: CI/CD: GitHub Actions with path-filtered workflows (frontend.yml + api.yml)
AR6: VPS metrics via psutil for live CPU/memory + health_checks table for disk
AR7: Agent logs read from log files on disk (API colocated on VPS)
AR8: Strangler Fig migration status as static config mapping in api/src/config.py
AR9: VPS running cost as config constant in api/src/config.py
AR10: Vercel deployment for frontend with VITE_API_URL env var
AR11: systemd service for FastAPI on VPS
AR12: CORS middleware restricted to Vercel frontend domain

### UX Design Requirements

N/A — No UX design document available.

### FR Coverage Map

FR1:  Epic 1 — Pipeline status per agent
FR2:  Epic 1 — Last successful run timestamp per agent
FR3:  Epic 1 — Heartbeat status
FR4:  Epic 1 — VPS metrics (CPU, memory, disk)
FR5:  Epic 1 — Telegram alert log
FR6:  Epic 2 — Shadow Observer feed
FR7:  Epic 2 — Hold points log
FR8:  Epic 2 — Strangler Fig migration status
FR9:  Epic 2 — Active daemon status
FR10: Epic 3 — Per-cycle funnel drop-off
FR11: Epic 3 — Funnel filterable by date/cycle
FR12: Epic 3 — Funnel drill-down per stage
FR13: Epic 4 — Current open positions
FR14: Epic 4 — Entry price, current price, unrealized P&L
FR15: Epic 4 — Sleeve allocation per position
FR16: Epic 4 — Guardian risk rule status per position
FR17: Epic 5 — Portfolio P&L (absolute + %)
FR18: Epic 5 — CAGR vs SPY benchmark
FR19: Epic 5 — Prediction accuracy over T+20 windows
FR20: Epic 5 — CalibrationEngine scores
FR21: Epic 5 — Arena variant comparison
FR22: Epic 6 — Per-ticker reasoning log
FR23: Epic 6 — F-Score breakdown per ticker
FR24: Epic 6 — ROIC / RSI inputs at time of decision
FR25: Epic 6 — Prediction log with outcomes
FR26: Epic 6 — Counterfactual engine output
FR27: Epic 7 — Brokerage fees (per trade + cumulative)
FR28: Epic 7 — API costs
FR29: Epic 7 — VPS running cost
FR30: Epic 7 — Cost-per-trade metric
FR31: Epic 7 — Total system cost vs portfolio returns
FR32: Epic 8 — Raw SQLite event bus viewer
FR33: Epic 8 — Agent logs per run
FR34: Epic 8 — Error stack traces
FR35: Epic 8 — Pipeline replay per cycle

## Epic List

### Epic 1: Project Foundation & System Health Dashboard
Omri can see at a glance whether the entire pipeline is healthy — agent statuses, heartbeats, VPS metrics, and recent alerts — from any device.
**FRs covered:** FR1, FR2, FR3, FR4, FR5
**ARs covered:** AR1, AR2, AR3, AR4, AR5, AR6, AR10, AR11, AR12

### Epic 2: Supervisor & Pipeline Oversight
Omri can monitor the supervisor layer — Shadow Observer activity, hold point decisions, Strangler Fig migration progress, and daemon health.
**FRs covered:** FR6, FR7, FR8, FR9
**ARs covered:** AR8

### Epic 3: Decision Funnel Visualization
Omri can trace exactly how the pipeline narrowed 1,520 tickers down to traded positions — per cycle, per stage, with drill-down into why each ticker was filtered.
**FRs covered:** FR10, FR11, FR12

### Epic 4: Holdings & Position Monitoring
Omri can see all open positions with live P&L, sleeve allocation, and Guardian risk rule status — the core operational view for daily monitoring.
**FRs covered:** FR13, FR14, FR15, FR16

### Epic 5: Performance & Prediction Accuracy
Omri (and potential investors) can evaluate portfolio performance vs SPY, prediction calibration, and arena model comparison — the credibility tab for external viewers.
**FRs covered:** FR17, FR18, FR19, FR20, FR21

### Epic 6: Decision Reasoning & Counterfactuals
Omri can inspect the full reasoning behind every trade decision — F-Score breakdown, ROIC/RSI inputs, prediction outcomes, and what-if counterfactual analysis.
**FRs covered:** FR22, FR23, FR24, FR25, FR26

### Epic 7: Cost Tracking & ROI
Omri can understand the total cost of running the system — brokerage fees, API costs, VPS costs, and whether the system's returns justify its expenses.
**FRs covered:** FR27, FR28, FR29, FR30, FR31
**ARs covered:** AR9

### Epic 8: Debug & Pipeline Replay
Omri can debug pipeline issues without SSHing into the VPS — raw event bus viewer, agent logs, error stack traces, and step-through cycle replay.
**FRs covered:** FR32, FR33, FR34, FR35
**ARs covered:** AR7

---

## Epic 1: Project Foundation & System Health Dashboard

Omri can see at a glance whether the entire pipeline is healthy — agent statuses, heartbeats, VPS metrics, and recent alerts — from any device.

### Story 1.1: Scaffold Monorepo with Frontend and API Projects

As a developer,
I want a working monorepo with both frontend and API projects scaffolded and running locally,
So that all subsequent stories have a foundation to build on.

**Acceptance Criteria:**

**Given** a fresh clone of the repository
**When** I run `pnpm install` in `frontend/` and `uv sync` in `api/`
**Then** both projects install dependencies without errors

**Given** the frontend project is installed
**When** I run `pnpm dev` in `frontend/`
**Then** a Vite dev server starts with React 19 + TypeScript + Tailwind v4 + shadcn/ui initialized

**Given** the API project is installed
**When** I run `uvicorn src.main:app` in `api/`
**Then** a FastAPI server starts with CORS middleware configured and OpenAPI docs available at `/docs`

**Given** both projects are running
**When** I check the project structure
**Then** it matches the architecture: `frontend/` (Vite + shadcn), `api/` (FastAPI + uvicorn), `.github/workflows/`, `.gitignore`, `README.md`

### Story 1.2: API Database Connections and Health Endpoint

As Omri,
I want an API endpoint that returns the health status of all pipeline agents,
So that the dashboard has data to display on the Health tab.

**Acceptance Criteria:**

**Given** the API is running on the VPS
**When** I call `GET /api/health`
**Then** I receive a JSON response with: agent statuses (Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer), last successful run timestamp per agent, heartbeat status from `health_checks` table, VPS metrics (CPU, memory via psutil, disk from health_checks), and recent alert events from supervisor `events` table

**Given** the API connects to both SQLite databases
**When** any database query executes
**Then** connections use `?mode=ro` (read-only) and no write operations are possible

**Given** a database file is missing or inaccessible
**When** the health endpoint is called
**Then** it returns a degraded status with error detail rather than crashing

**Given** the API is running
**When** I call `GET /api/health`
**Then** the response completes within 500ms

### Story 1.3: Frontend App Shell with Tab Navigation

As Omri,
I want a responsive app shell with navigation for all 8 dashboard tabs,
So that I can navigate between different views on both desktop and mobile.

**Acceptance Criteria:**

**Given** I open the dashboard in a browser
**When** the app loads
**Then** I see a sidebar navigation with all 8 tabs: Health, Supervisor, Funnel, Holdings, Performance, Decisions, Costs, Debug

**Given** I am on any tab
**When** I click another tab in the navigation
**Then** TanStack Router navigates to the new route without a full page reload

**Given** I open the dashboard on a mobile device (< 768px)
**When** the app loads
**Then** the navigation adapts to a mobile-friendly layout (collapsible sidebar or bottom nav)

**Given** I open the dashboard
**When** no specific route is in the URL
**Then** I am redirected to the Health tab (`/health`) as the default view

**Given** I navigate to any tab
**When** the tab's data is not yet loaded
**Then** I see shadcn skeleton loading components (not spinners)

### Story 1.4: Health Tab — Agent Status & VPS Metrics Display

As Omri,
I want to see all agent statuses, heartbeats, VPS metrics, and recent alerts on the Health tab,
So that I can quickly assess whether the pipeline is running correctly from my phone or desktop.

**Acceptance Criteria:**

**Given** I am on the Health tab
**When** data loads from `GET /api/health`
**Then** I see a status card per agent (Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer) showing: status badge (healthy/degraded/down), last successful run timestamp

**Given** I am on the Health tab
**When** data loads
**Then** I see heartbeat status indicators and VPS metrics (CPU %, memory %, disk usage)

**Given** I am on the Health tab
**When** data loads
**Then** I see a list of recent alert events (most recent N) with timestamp, source, and event type

**Given** I am on the Health tab
**When** 30 seconds have elapsed since the last fetch
**Then** TanStack Query automatically refetches the health data (refetchInterval: 30s)

**Given** the API returns an error
**When** the Health tab attempts to display data
**Then** I see an inline ErrorCard with the error detail and a retry button

**Given** I view the Health tab on mobile
**When** the layout renders
**Then** all cards stack vertically and remain fully readable without horizontal scrolling

---

## Epic 2: Supervisor & Pipeline Oversight

Omri can monitor the supervisor layer — Shadow Observer activity, hold point decisions, Strangler Fig migration progress, and daemon health.

### Story 2.1: Supervisor API Endpoint

As Omri,
I want an API endpoint that returns supervisor data — Shadow Observer events, hold points, Strangler Fig status, and daemon status,
So that the Supervisor tab has data to display.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/supervisor`
**Then** I receive JSON with: recent Shadow Observer events from supervisor `events` table (source filters), hold point status from `drawdown_state` table and related supervisor events, Strangler Fig migration status from static config mapping, and active daemon status from latest `health_checks`

**Given** the Strangler Fig status is configured in `api/src/config.py`
**When** the endpoint returns migration status
**Then** each pipeline component shows its current mode (v1-cron / v2-supervisor / dual) with a progress summary

**Given** the supervisor database is unavailable
**When** I call `GET /api/supervisor`
**Then** I receive a degraded response with error detail, not a 500 crash

### Story 2.2: Supervisor Tab UI

As Omri,
I want to see Shadow Observer activity, hold points, migration status, and daemon health on the Supervisor tab,
So that I can monitor the v2 infrastructure layer in real time.

**Acceptance Criteria:**

**Given** I am on the Supervisor tab
**When** data loads from `GET /api/supervisor`
**Then** I see a Shadow Observer feed showing recent supervisor events with timestamp, source, event type, and payload summary

**Given** I am on the Supervisor tab
**When** data loads
**Then** I see a hold points section showing drawdown state (paused/active), trigger percentage, and approval/rejection history

**Given** I am on the Supervisor tab
**When** data loads
**Then** I see a Strangler Fig progress tracker showing each component's migration state (v1/v2/dual)

**Given** I am on the Supervisor tab
**When** data loads
**Then** I see active daemon status with latest health check results per component

**Given** I am on the Supervisor tab
**When** 30 seconds have elapsed since the last fetch
**Then** TanStack Query automatically refetches (refetchInterval: 30s)

**Given** I view the Supervisor tab on mobile
**When** the layout renders
**Then** all sections stack vertically and remain fully readable

---

## Epic 3: Decision Funnel Visualization

Omri can trace exactly how the pipeline narrowed 1,520 tickers down to traded positions — per cycle, per stage, with drill-down.

### Story 3.1: Funnel API Endpoint

As Omri,
I want an API endpoint that returns funnel data showing how candidates were filtered at each pipeline stage,
So that the Funnel tab can visualize the decision drop-off.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/funnel?scan_date=2026-04-04`
**Then** I receive JSON with counts at each stage: Scout universe size, Scout candidates (passed gates), Guardian approved, Guardian modified, Guardian rejected, and Michael acted (traded)

**Given** I call `GET /api/funnel?scan_date=2026-04-04`
**When** the response includes drill-down data
**Then** each stage includes a list of tickers with: ticker symbol, the stage where it was filtered, and the reason (rejection_reason from `rejection_log`, decision from `guardian_decisions`, or trade action from `trade_events`)

**Given** I call `GET /api/funnel` without a scan_date
**When** the endpoint processes the request
**Then** it defaults to the most recent scan date available in `scout_candidates`

**Given** I call `GET /api/funnel?scan_date=2026-04-04` and no data exists for that date
**When** the endpoint processes the request
**Then** it returns an empty funnel with zero counts and a clear message

### Story 3.2: Funnel Tab — Drop-off Visualization and Drill-down

As Omri,
I want to see a visual funnel showing how tickers were filtered at each stage, with the ability to drill into specific stages,
So that I can understand pipeline selectivity and debug filtering decisions.

**Acceptance Criteria:**

**Given** I am on the Funnel tab
**When** data loads for a scan date
**Then** I see a funnel/bar chart showing the count at each stage: Scout universe → Scout passed → Guardian approved → Michael traded

**Given** I am on the Funnel tab
**When** I select a different date using the date picker
**Then** the funnel updates to show data for the selected date via TanStack Router search params

**Given** I am viewing the funnel
**When** I click on a specific stage (e.g., "Guardian rejected")
**Then** I see a drill-down table listing each ticker filtered at that stage with the rejection reason

**Given** I view the Funnel tab on mobile
**When** the funnel chart renders
**Then** the chart adapts to vertical orientation and the drill-down table is scrollable

**Given** the funnel data is stale (>15 minutes)
**When** TanStack Query evaluates staleness
**Then** it refetches on the next window focus (staleTime: 15min)

---

## Epic 4: Holdings & Position Monitoring

Omri can see all open positions with live P&L, sleeve allocation, and Guardian risk rule status.

### Story 4.1: Holdings API Endpoint

As Omri,
I want an API endpoint that returns all current open positions with P&L and risk data,
So that the Holdings tab can display my portfolio.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/holdings`
**Then** I receive JSON with all open positions from `sim_positions WHERE status='open'` including: ticker, sector, entry_price, entry_date, current_price, shares, unrealized P&L (absolute and %), sleeve allocation, stop_loss, target_1, target_2, conviction, days_held

**Given** the response includes position data
**When** Guardian risk rule status is requested
**Then** each position includes: current stop level, exit stage (initial/breakeven/trailing), portfolio heat contribution, and sector concentration status from the latest `sim_portfolio_snapshots`

**Given** the API queries open positions
**When** the query executes
**Then** all reads use `?mode=ro` and complete within 500ms

### Story 4.2: Holdings Tab — Positions Table with P&L and Risk Status

As Omri,
I want to see all open positions in a sortable table with unrealized P&L, sleeve allocation, and Guardian risk indicators,
So that I can monitor my portfolio health at a glance on any device.

**Acceptance Criteria:**

**Given** I am on the Holdings tab
**When** data loads from `GET /api/holdings`
**Then** I see a DataTable with columns: ticker, sleeve, entry price, current price, unrealized P&L (% and $), days held, conviction, exit stage, stop loss

**Given** I am viewing the holdings table
**When** I click a column header
**Then** the table sorts by that column (ascending/descending toggle)

**Given** I am viewing holdings
**When** a position's unrealized P&L is negative
**Then** the P&L cell is styled with a red/loss indicator; positive P&L shows green/gain

**Given** I am viewing holdings
**When** data loads
**Then** sleeve allocation is displayed per position with a visual grouping or badge (Sleeve 1 / Sleeve 2)

**Given** I am viewing holdings
**When** Guardian risk indicators are present
**Then** I see risk status badges per position (e.g., near stop, high heat contribution)

**Given** I am on the Holdings tab
**When** 5 minutes have elapsed since the last fetch
**Then** TanStack Query marks data as stale and refetches on focus (staleTime: 5min)

**Given** I view the Holdings tab on mobile
**When** the table renders
**Then** the table is horizontally scrollable with the ticker column pinned/visible

---

## Epic 5: Performance & Prediction Accuracy

Omri (and potential investors) can evaluate portfolio performance vs SPY, prediction calibration, and arena model comparison.

### Story 5.1: Performance API Endpoint

As Omri,
I want an API endpoint that returns portfolio performance metrics, prediction accuracy, calibration scores, and arena comparison data,
So that the Performance tab can display credible analytics.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/performance`
**Then** I receive JSON with: portfolio P&L (absolute and %), CAGR calculation, SPY benchmark return over the same period, alpha (portfolio return - SPY return) from `sim_portfolio_snapshots`

**Given** the response includes prediction data
**When** prediction accuracy is calculated
**Then** it includes: total predictions, resolved count, hit rate by eval window (T+5, T+10, T+20), average Brier score, and calibration buckets from supervisor `predictions` and `eval_results` tables

**Given** the response includes calibration data
**When** CalibrationEngine scores are included
**Then** it includes: average Brier score, target Brier (0.25), beating-random flag, agreement rate, and sycophancy flag

**Given** the response includes arena data
**When** arena comparison is included
**Then** it includes per-model: model_id, total decisions, hit rate, average alpha, total cost, grouped by session for side-by-side comparison from `arena_decisions` and `arena_forward_returns`

### Story 5.2: Performance Tab — Portfolio P&L and Benchmark Charts

As Omri,
I want to see portfolio P&L over time compared to SPY, with CAGR and alpha metrics,
So that I (and potential investors) can evaluate system performance credibly.

**Acceptance Criteria:**

**Given** I am on the Performance tab
**When** data loads
**Then** I see a Recharts area/line chart showing portfolio value over time vs SPY benchmark, using shadcn/ui chart components

**Given** I am viewing the performance chart
**When** I hover over data points
**Then** I see a tooltip with date, portfolio value, SPY value, and daily alpha

**Given** I am on the Performance tab
**When** summary metrics load
**Then** I see KPI cards showing: total P&L ($ and %), CAGR, SPY return, alpha, win rate, total trades

**Given** I view the Performance tab on mobile
**When** charts render
**Then** charts adapt to full-width and remain interactive (touch-friendly tooltips)

### Story 5.3: Performance Tab — Prediction Accuracy and Arena Comparison

As Omri,
I want to see prediction accuracy metrics, calibration scores, and arena model comparison on the Performance tab,
So that I can evaluate whether Michael's predictions are improving and how models compare.

**Acceptance Criteria:**

**Given** I am on the Performance tab
**When** prediction data loads
**Then** I see prediction accuracy broken down by eval window (T+5, T+10, T+20) with hit rates and average returns

**Given** I am viewing prediction accuracy
**When** calibration data is available
**Then** I see CalibrationEngine metrics: Brier score vs target, calibration buckets chart, agreement rate, and sycophancy flag indicator

**Given** I am on the Performance tab
**When** arena data is available
**Then** I see a model comparison table showing: model name, decision count, hit rate, average alpha, total cost — sortable by any column

**Given** arena data includes multiple sessions
**When** I want to compare models for a specific session
**Then** I can filter by session or date range via search params

**Given** the Performance tab data
**When** staleness exceeds 1 hour
**Then** TanStack Query marks data as stale (staleTime: 60min)

---

## Epic 6: Decision Reasoning & Counterfactuals

Omri can inspect the full reasoning behind every trade decision — F-Score, ROIC/RSI, predictions, and counterfactuals.

### Story 6.1: Decisions API Endpoint

As Omri,
I want an API endpoint that returns per-ticker reasoning, scoring inputs, prediction outcomes, and counterfactual analysis,
So that the Decisions tab has the data for deep inspection.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/decisions`
**Then** I receive JSON with recent trade decisions including: ticker, scan_date, thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, conviction

**Given** I call `GET /api/decisions?ticker=AAPL`
**When** ticker filter is applied
**Then** I receive all decisions for that ticker across all scan dates, including: F-Score (fundamental_score), ROIC (roic_at_scan, prev_roic, roic_delta), RSI, P/E (pe_at_scan, median_pe, pe_discount_pct), relative strength, valuation verdict

**Given** the response includes prediction data
**When** predictions with elapsed T+20 windows exist
**Then** each prediction includes: predicted outcome, probability, actual outcome, resolved status, Brier score from the `predictions` table

**Given** the response includes counterfactual data
**When** counterfactuals are available
**Then** it includes top missed opportunities (rejected tickers with T+20 > 10%) and top good rejections (T+20 < 0%) from `rejection_log`, with rejection gate and reason

### Story 6.2: Decisions Tab — Reasoning Log and Scoring Breakdown

As Omri,
I want to see per-ticker reasoning with F-Score, ROIC, RSI breakdowns and prediction outcomes,
So that I can audit and understand every decision the system made.

**Acceptance Criteria:**

**Given** I am on the Decisions tab
**When** data loads
**Then** I see a table of recent decisions with: ticker, date, decision tier, conviction, thesis summary (truncated), and P&L outcome if closed

**Given** I am viewing the decisions table
**When** I click on a ticker row
**Then** I see an expanded detail view with: full thesis text, F-Score breakdown, ROIC/RSI/P&E inputs at time of decision, Guardian rules checked, and prediction log with outcomes

**Given** I want to find a specific ticker
**When** I type a ticker symbol in a search/filter input
**Then** the decisions table filters to show only that ticker's history (via TanStack Router search params)

**Given** I am viewing prediction outcomes
**When** T+20 has elapsed for a prediction
**Then** I see: predicted vs actual outcome, Brier score, and direction correctness badge

### Story 6.3: Decisions Tab — Counterfactual Analysis

As Omri,
I want to see counterfactual output showing what would have happened with rejected candidates,
So that I can evaluate whether the pipeline's filters are correctly calibrated.

**Acceptance Criteria:**

**Given** I am on the Decisions tab
**When** counterfactual data loads
**Then** I see a "Top Misses" section: rejected tickers where T+20 return exceeded 10%, showing ticker, rejection gate, rejection reason, and actual T+20 return

**Given** I am viewing counterfactuals
**When** data loads
**Then** I see a "Top Good Rejections" section: rejected tickers where T+20 return was negative, validating the filter worked

**Given** I am viewing counterfactuals
**When** gate accuracy data is available
**Then** I see per-gate accuracy metrics: total rejections, miss rate %, validate rate % — showing which gates are most/least accurate

**Given** I view the Decisions tab on mobile
**When** the layout renders
**Then** expanded detail views and counterfactual tables are vertically stacked and scrollable

---

## Epic 7: Cost Tracking & ROI

Omri can understand the total cost of running the system and whether returns justify expenses.

### Story 7.1: Costs API Endpoint

As Omri,
I want an API endpoint that returns all system costs — brokerage, API, VPS — and ROI metrics,
So that the Costs tab can display total system economics.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/costs`
**Then** I receive JSON with: brokerage fees per trade and cumulative from `realized_gains` (transaction_costs) and `trade_events` (estimated_cost_dollars), API costs per model and cumulative from `arena_decisions` (cost_usd), VPS running cost from config constant, cost-per-trade metric (total costs / total trades), total system cost vs portfolio returns ratio

**Given** the VPS cost is a config constant
**When** the endpoint calculates total system cost
**Then** it sums: cumulative brokerage fees + cumulative API costs + (VPS monthly cost x months running)

**Given** the endpoint calculates ROI
**When** portfolio returns are available from `sim_portfolio_snapshots`
**Then** it returns total system cost, total portfolio return, and net return after costs

### Story 7.2: Costs Tab — Fee Breakdown and ROI Display

As Omri,
I want to see a breakdown of all system costs and whether my returns justify the expenses,
So that I can make informed decisions about the system's economic viability.

**Acceptance Criteria:**

**Given** I am on the Costs tab
**When** data loads from `GET /api/costs`
**Then** I see a cost breakdown with sections: Brokerage Fees (per-trade table + cumulative total), API Costs (per-model breakdown + cumulative), VPS Cost (monthly + cumulative)

**Given** I am viewing costs
**When** summary metrics load
**Then** I see KPI cards: total system cost, cost-per-trade, total portfolio return, net return after costs, cost-as-%-of-returns

**Given** I am on the Costs tab
**When** cost data includes API costs by model
**Then** I see a Recharts bar/pie chart showing cost distribution across models (Claude Sonnet, Opus, Haiku, GPT-4o, etc.)

**Given** I am viewing the brokerage fees section
**When** individual trade costs are listed
**Then** I see a table with: ticker, trade date, entry/exit, spread, estimated cost ($), sortable by any column

**Given** the Costs tab data
**When** staleness exceeds 1 hour
**Then** TanStack Query marks data as stale (staleTime: 60min)

**Given** I view the Costs tab on mobile
**When** the layout renders
**Then** KPI cards stack vertically, charts adapt to full width, and tables are scrollable

---

## Epic 8: Debug & Pipeline Replay

Omri can debug pipeline issues without SSHing into the VPS — raw event bus viewer, agent logs, error traces, and cycle replay.

### Story 8.1: Debug API Endpoints

As Omri,
I want API endpoints for raw event bus data, agent logs, and pipeline replay,
So that the Debug tab has access to low-level system data.

**Acceptance Criteria:**

**Given** the API is running
**When** I call `GET /api/debug/events?source=data_bridge&type=sync_complete&since=2026-04-01&limit=50`
**Then** I receive raw events from supervisor `events` table with: id, timestamp, source, event_type, strategy_id, payload (as JSON), processed flag — filtered by query params

**Given** the API is running
**When** I call `GET /api/debug/logs?agent=scout&date=2026-04-04&severity=ERROR`
**Then** I receive log entries read from agent log files on disk, filtered by agent name, date, and severity level

**Given** the API is running
**When** I call `GET /api/debug/replay?date=2026-04-04`
**Then** I receive a reconstructed pipeline cycle: Scout candidates scanned (count + top tickers), Guardian decisions made (approved/modified/rejected with reasons), trade events executed, regime state at the time — all ordered chronologically

**Given** log files don't exist for the requested date
**When** the logs endpoint is called
**Then** it returns an empty array with no error (graceful degradation)

### Story 8.2: Debug Tab — Raw Event Bus Viewer

As Omri,
I want to browse raw events from the SQLite event bus with filtering,
So that I can inspect system behavior at the lowest level.

**Acceptance Criteria:**

**Given** I am on the Debug > Events sub-tab
**When** data loads from `GET /api/debug/events`
**Then** I see a table of events with columns: timestamp, source, event_type, strategy_id, payload (expandable JSON), and processed flag

**Given** I am viewing the event bus
**When** I set filters for source, event type, or date range
**Then** the table updates via TanStack Router search params and the API is called with the new filters

**Given** I am viewing an event row
**When** I click to expand the payload
**Then** I see the full JSON payload formatted and syntax-highlighted

**Given** I am on the Debug > Events tab
**When** I click a manual refresh button
**Then** TanStack Query refetches immediately (no auto-refetch — on-demand only)

### Story 8.3: Debug Tab — Agent Logs and Error Traces

As Omri,
I want to view agent logs with filtering and see error stack traces,
So that I can diagnose pipeline issues without SSH access.

**Acceptance Criteria:**

**Given** I am on the Debug > Logs sub-tab
**When** data loads from `GET /api/debug/logs`
**Then** I see log entries with: timestamp, agent, severity level (INFO/WARNING/ERROR), and message text

**Given** I am viewing logs
**When** I filter by agent (dropdown), date (picker), or severity (dropdown)
**Then** the log list updates via search params

**Given** a log entry has severity ERROR
**When** I click on it
**Then** I see the full error stack trace in a monospace code block

**Given** I am viewing logs on mobile
**When** the layout renders
**Then** log entries are readable with severity indicated by color badges and stack traces are scrollable

### Story 8.4: Debug Tab — Pipeline Replay

As Omri,
I want to step through what happened in a specific pipeline cycle,
So that I can understand the complete flow of decisions for any given day.

**Acceptance Criteria:**

**Given** I am on the Debug > Replay sub-tab
**When** I select a date
**Then** I see a chronological timeline of the pipeline cycle for that date

**Given** the replay loads
**When** data is displayed
**Then** I see sequential steps: Regime state detected → Scout scan (candidate count, top tickers) → Guardian decisions (approved/modified/rejected per ticker with reasons) → Trade events executed (entries, exits) → Portfolio snapshot after cycle

**Given** I am viewing the replay
**When** I click on a step in the timeline
**Then** I see expanded detail for that step (e.g., full list of Scout candidates, Guardian rule checks per ticker)

**Given** I select a date with no pipeline run
**When** the replay loads
**Then** I see a clear message: "No pipeline run found for this date" (pipeline runs MWF only)

**Given** I view the replay on mobile
**When** the timeline renders
**Then** it displays as a vertical timeline with expandable steps
