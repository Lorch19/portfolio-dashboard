# PRD: Portfolio System Dashboard

## Overview
A read-only web dashboard for monitoring and understanding the autonomous investment portfolio system. Serves as both an operational control center (for Omri) and a credible performance showcase (for potential investors).

## Goals
- Monitor system health across all pipeline agents in real time
- Understand the decision funnel from universe screening to final trades
- Track portfolio performance vs benchmark (SPY)
- Debug pipeline issues without SSHing into the VPS
- Present system logic and outcomes credibly to external viewers

## Users
- **Primary:** Omri (daily operational use, mobile + desktop)
- **Secondary:** Potential investors (read-only showcase, must look credible)

## Tabs / Feature Areas

### 1. System & Health
- Pipeline status per agent (Scout, Radar, Guardian, Chronicler, Michael, Shadow Observer)
- Last successful run timestamp per agent
- Heartbeat status (healthchecks.io integration)
- VPS metrics (CPU, memory, disk)
- Telegram alert log (recent N alerts)

### 2. Supervisor
- Shadow Observer feed (real-time supervisor events)
- Hold points log (HP-1, HP-2, etc.) with approval/rejection status
- Strangler Fig migration status (v1 → v2 progress tracker)
- Active daemon status

### 3. Funnel
- Per-cycle drop-off: Scout universe (1,520) → Radar filtered → Guardian approved → Michael acted
- Filterable by date/cycle
- Drill-down: which tickers were filtered at each stage and why

### 4. Holdings
- Current open positions
- Entry price, current price, unrealized P&L
- Sleeve allocation (which strategy sleeve each position belongs to)
- Guardian risk rule status per position

### 5. Performance
- Portfolio P&L (absolute + %)
- CAGR vs SPY benchmark
- Prediction accuracy over T+20 evaluation windows
- CalibrationEngine scores
- Arena variant comparison (parallel strategy variants)

### 6. Decisions
- Per-ticker reasoning log
- F-Score breakdown per ticker
- ROIC / RSI inputs at time of decision
- Prediction log with outcomes (where T+20 has elapsed)
- Counterfactual engine output (what would have happened if...)

### 7. Costs
- Brokerage fees (per trade + cumulative)
- API costs (Anthropic, data providers)
- VPS running cost
- Cost-per-trade metric
- Total system running cost vs portfolio returns

### 8. Debug
- Raw SQLite event bus viewer
- Agent logs per run (filterable by agent, date, severity)
- Error stack traces
- Pipeline replay per cycle (step through what happened)

## Non-Functional Requirements
- **Read-only:** No write operations to the pipeline under any circumstances
- **Mobile responsive:** Full functionality on mobile (Omri monitors on the go)
- **Credible UI:** Investor-grade design, not a dev tool aesthetic
- **Scalable:** New agents and data sources must be addable without restructuring the dashboard
- **Performance:** Dashboard loads within 3s on standard connection

## Data Source
- Source of truth: SQLite database on Hetzner VPS
- Access pattern: TBD (architect to recommend — thin FastAPI layer vs direct read vs other)
- All data is read-only

## Future Phases
- Authentication layer for external viewer access
- Additional portfolio strategies / sleeves
- Alerting / notification preferences UI
- Historical backtesting visualization
