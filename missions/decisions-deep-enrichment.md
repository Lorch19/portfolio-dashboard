# Mission: Decisions Tab Deep Enrichment

## Goal
Transform the Decisions tab from a flat table of ticker/date/decision into an investor-grade decision intelligence view that surfaces the full reasoning, scoring, and outcomes behind every trade decision.

## Context
The portfolio DB has incredibly rich decision data across trade_events (54 columns) and scout_candidates (56 columns), but the Decisions tab currently shows only 6 fields. This mission surfaces all available data in an expandable, learnable format.

## Available Data Inventory

### From trade_events (per trade decision):
- **Thesis:** thesis_full_text, primary_catalyst, invalidation_trigger, moat_thesis
- **Bear case:** bear_case_text, pre_mortem_text
- **Decision quality:** critique_quality_score (1-10), critique_changed_decision (bool), challenge_gate_result
- **Model attribution:** model_id, decided_by_model
- **Entry context:** pe_at_entry, median_pe_at_entry, roic_at_entry, conviction, decision_tier, sleeve
- **Performance outcome:** pnl_pct, realized_rr, max_favorable_excursion_pct, days_held, sp500_return_same_period
- **Exit details:** exit_price, exit_date, exit_trigger, exit_reason

### From scout_candidates (per ticker at scan time):
- **Scoring:** fundamental_score, technical_score, michael_quality_score
- **Financial health:** beneish_m_score, altman_z_score, roic_wacc_spread
- **Valuation:** pe_at_scan, median_pe, pe_discount_pct, valuation_verdict, valuation_fair_value, valuation_upside_pct
- **Technical:** rsi, relative_strength, momentum_at_scan, atr, volume_ratio
- **Insider signals:** insider_signal, insider_net_value_usd, insider_buy_cluster
- **Enrichment:** enrichment_flags, timing_signals, priority, sleeve

### From predictions table (portfolio.db):
- source, ticker, prediction_type, predicted_outcome, probability, time_horizon_days, counter_thesis, resolved, actual_outcome, brier_score

## Tasks

### 1. API: Enrich Decision Response
- `api/src/db/portfolio.py` → `get_recent_decisions()`: Pull ALL thesis/scoring/quality/insider fields from trade_events + scout_candidates. Join on ticker + closest scan_date.
- New endpoint: `GET /api/decisions/{ticker}` — full deep-dive for a single ticker: all decisions across time, all predictions, scout scoring history, rejection history

### 2. Frontend: Expandable Decision Cards
Redesign `frontend/src/routes/decisions.tsx`:

**Collapsed row:** Ticker | Date | Decision | Conviction | Tier | Sleeve | P&L outcome (colored)

**Expanded panel (click to open) with sections:**

**A. Investment Thesis**
- Full thesis text (scrollable)
- Primary catalyst (highlighted)
- Invalidation trigger (red highlight — "what kills this")
- Moat thesis

**B. Bear Case & Pre-Mortem**
- Bear case text
- Pre-mortem text
- Challenge gate result

**C. Scoring Dashboard**
Visual grid/cards showing:
- F-Score (0-9, color-coded)
- ROIC at scan + delta (trend arrow)
- RSI (color: <30 green, >70 red)
- P/E vs Median P/E (discount %)
- Momentum (12-1 month)
- Relative Strength
- Valuation verdict badge
- M-Score, Z-Score (financial health flags)
- Michael quality score

**D. Decision Quality**
- Critique quality score (1-10 bar)
- Did critique change decision? (badge)
- Model: which model decided
- Decision tier badge

**E. Insider Signals**
- Signal type (buy/sell/neutral)
- Net value USD
- Buy cluster flag

**F. Outcome (for closed positions)**
- P&L % (large, colored)
- Realized R:R
- Max favorable excursion
- Days held
- vs SPY same period (alpha)
- Exit trigger & reason

### 3. Ticker Deep-Dive Page
When user clicks a ticker name → navigates to `/decisions?ticker=AAPL` showing:
- All decisions for that ticker across time (timeline view)
- Prediction history with outcomes
- Scout scoring history (how scores changed across scans)
- Rejection history (when/why it was previously rejected)

## Files to Modify
- `api/src/db/portfolio.py` — enrich get_recent_decisions, add get_ticker_deep_dive
- `api/src/routers/decisions.py` — add /{ticker} endpoint
- `frontend/src/routes/decisions.tsx` — full redesign with expandable cards
- `frontend/src/types/decisions.ts` — expanded types for all fields
- `frontend/src/api/useDecisions.ts` — update response types

## Verification
- All existing tests pass
- New tests for enriched decision data + ticker deep-dive
- Visual verification: expand a decision card, check all sections render
- Test with real data: at least 3 trade_entry decisions should show thesis text

## Open Decisions
1. [OPEN] Should scoring dashboard use small inline charts (sparklines for ROIC history) or just current values?
2. [OPEN] Should the expanded card be a full-width panel or a side drawer?
3. [OPEN] Should we add a "Decision Quality Score" composite metric combining critique score + prediction accuracy?
