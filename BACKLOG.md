# Portfolio Dashboard Backlog

## Urgent
> Broken or misleading — must fix before daily use

- **Fix current price on Holdings tab** — `peak_price` used as proxy for `current_price` shows 0% P&L for all positions. Need to fetch live/last-close prices (either via API enrichment at query time, or a `current_price` column populated by the pipeline).
  - AC: Every open position shows accurate unrealized P&L based on latest available price.

- **Fix Funnel "Scout Passed" showing -2,557** — counting rejections across all dates, not just the selected scan_date. The subtraction logic produces negative numbers. Need to count only candidates that were NOT rejected for the selected date.
  - AC: Scout Passed is always >= 0 and <= Scout Universe for any given date.

- **Fix Decisions tab showing "No decisions available"** — guardian_decisions exist in DB but query returns empty. Likely a schema mismatch still present (decision_date matching, or the enrichment joins failing silently).
  - AC: Recent guardian decisions render with ticker, decision, conviction, and date.

- **Fix Counterfactuals showing empty** — rejection_log has data but `t_plus_20` values are mostly NULL for recent entries (status='open'). Need to filter to resolved entries only.
  - AC: Counterfactuals show top misses and good rejections from resolved rejection_log rows.

- **Health tab agents all show "No data"** — health_checks `component` values (e.g. "health", "eval", "data_bridge") don't match EXPECTED_AGENTS list ("Scout", "Guardian", etc.). Need to map real component names or pull all components dynamically.
  - AC: Agent status cards show real health data for each pipeline component.

## High
> Missing critical insights — the main reason the dashboard feels hollow

- **Add live price enrichment for Holdings** — The portfolio system doesn't store current prices in sim_positions. Add a lightweight price lookup (Yahoo Finance or cached from the pipeline) so P&L is meaningful.
  - AC: Holdings table shows current market price and accurate unrealized P&L.

- **Surface regime state prominently** — sim_portfolio_snapshots has a `regime` column. This is critical context for understanding all decisions. Show it as a banner or badge on Performance, Holdings, and Decisions tabs.
  - AC: Current market regime is visible without navigating to Debug.

- **Add portfolio heat and sector concentration to Holdings** — sim_portfolio_snapshots has `portfolio_heat` and `sector_concentration_json`. These are key Guardian risk signals currently invisible.
  - AC: Portfolio heat gauge and sector breakdown visible on Holdings tab.

- **Performance tab: use snapshot time-series for P&L chart** — Currently shows $0.00 P&L because only 1 snapshot exists with total_value. As more snapshots accumulate, the chart should show portfolio value over time vs SPY.
  - AC: Line chart renders portfolio value trajectory when 2+ snapshots exist.

- **Surface trade thesis on Holdings** — trade_events has `thesis_full_text`, `primary_catalyst`, `invalidation_trigger` per position. These are the "why" behind each holding, currently invisible.
  - AC: Clicking/expanding a position shows its thesis, catalyst, and invalidation trigger.

- **Add position sizing context** — trade_events has `position_size_pct`, `sleeve`, `decision_tier`. Holdings shows sleeve but not size % or tier. These matter for understanding portfolio construction.
  - AC: Holdings shows position size % and decision tier per position.

## Priority
> Important improvements for daily operational use

- **Funnel: show actual funnel visualization** — Currently just a flat list of numbers. Should be a horizontal bar chart or actual funnel shape showing the drop-off visually. PRD says "funnel/bar chart."
  - AC: Funnel renders as a visual bar chart showing progressive narrowing from universe to traded.

- **Holdings: add total portfolio value summary** — No header showing total AUM, cash %, invested %, position count. sim_portfolio_snapshots has all of these.
  - AC: Holdings header shows total value, cash %, invested %, and position count.

- **Decisions: show scoring breakdown** — scout_candidates has fundamental_score, ROIC, RSI, P/E data per ticker. The Decisions tab should show these as a visual scoring card, not just raw numbers.
  - AC: Each decision row expandable to show F-Score, ROIC delta, RSI, valuation verdict.

- **Debug Replay: show available dates** — Currently requires you to guess a valid date. Should show a list of dates that have pipeline runs, or at minimum default to the most recent run date.
  - AC: Replay sub-tab defaults to most recent pipeline run date and shows date picker constrained to valid dates.

- **Performance: show win rate from snapshots** — sim_portfolio_snapshots has `win_rate` and `closed_trades`. Currently showing "—" for Win Rate.
  - AC: Win Rate KPI populated from latest snapshot data.

- **Costs: surface brokerage table with real data** — trade_events has `estimated_cost_dollars` and `transaction_cost` per trade. Table should show per-trade costs with ticker and date.
  - AC: Brokerage table shows all trades with individual cost breakdowns.

## Strategic
> Investor-grade polish — making it credible for external viewers

- **Design overhaul: investor-grade visual hierarchy** — Current UI is functional but sparse. Needs: consistent card elevation, section headers with context, colored status indicators, proper typography scale, breathing room between sections.
  - AC: Dashboard passes visual credibility check — would not embarrass if shown to an LP.

- **Add dark mode** — PRD mentions "credible UI." A well-done dark mode with proper chart colors signals sophistication.
  - AC: Toggle between light/dark themes, charts and tables adapt.

- **Performance: add equity curve chart** — The marquee visualization for any fund. Portfolio value over time vs SPY, with drawdown shading. Currently just KPI cards.
  - AC: Full-width equity curve chart with portfolio line, SPY line, and alpha shading.

- **Add summary/overview landing page** — Instead of defaulting to Health (ops detail), the default view should be a summary: portfolio value, today's P&L, active positions count, last pipeline run, regime state. One-glance "is everything OK?"
  - AC: Root "/" shows an executive summary with key metrics from across all tabs.

- **Holdings: add sparkline per position** — Even a simple 20-day price trend sparkline per row would make the table 10x more informative.
  - AC: Each position row shows a mini price chart for the last 20 trading days.

- **Mobile UX: bottom tab bar** — Hamburger menu on mobile is an extra tap for every navigation. A fixed bottom tab bar (top 5 tabs + "More") is standard for mobile dashboards.
  - AC: Mobile viewport shows fixed bottom navigation with icon + label.

## Non-priority
> Nice-to-haves, polish, tech debt

- **Add loading shimmer animations** — Current skeletons are flat gray blocks. Shimmer/pulse animation feels more responsive.
  - AC: All skeleton states use animated shimmer effect.

- **Supervisor: make Strangler Fig migration status dynamic** — Currently hardcoded in config.py. Should read from the real system or at least from a config file that the pipeline updates.
  - AC: Migration status reflects actual pipeline state.

- **Debug: add log file support** — Logs sub-tab is wired up but needs LOG_DIR configured. Document the expected log format and directory structure.
  - AC: Agent logs display when LOG_DIR points to real pipeline log directory.

- **Add keyboard shortcuts** — j/k for row navigation, / for search, number keys for tab switching. Power-user feature for daily ops.
  - AC: Keyboard navigation works across all tables and tabs.

- **Add data freshness indicators per section** — Show "last updated X minutes ago" per data section, not just globally. Some data updates every 30s, other data is daily.
  - AC: Each section shows its own data freshness timestamp.

- **Fix test warnings: TanStack Router flagging test files as routes** — Add `routeFileIgnorePattern` to vite/router config to suppress warnings about `.test.tsx` files in routes/.
  - AC: No route warnings in dev server console output.

- **Add CI pipeline for dashboard** — Currently no linting or test step in CI beyond dependency install. Add ruff + pytest for API, vitest for frontend.
  - AC: PRs run lint + test for both API and frontend.
