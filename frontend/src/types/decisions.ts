export interface Decision {
  scan_date: string
  ticker: string
  decision: string
  conviction: string | null

  // Thesis
  thesis_full_text: string | null
  primary_catalyst: string | null
  invalidation_trigger: string | null
  decision_tier: string | null
  moat_thesis: string | null

  // Bear case
  bear_case_text: string | null
  pre_mortem_text: string | null
  challenge_gate_result: string | null

  // Decision quality
  critique_quality_score: number | null
  critique_changed_decision: boolean | null
  model_id: string | null
  decided_by_model: string | null

  // Entry context
  entry_price: number | null
  stop_loss: number | null
  target_1: number | null
  target_2: number | null
  pe_at_entry: number | null
  median_pe_at_entry: number | null
  roic_at_entry: number | null
  sleeve: string | null

  // Outcome (closed positions)
  pnl_pct: number | null
  realized_rr: number | null
  max_favorable_excursion_pct: number | null
  days_held: number | null
  sp500_return_same_period: number | null
  exit_price: number | null
  exit_date: string | null
  exit_trigger: string | null
  exit_reason: string | null

  // Primary scoring (from scout_candidates)
  fundamental_score: number | null
  roic_at_scan: number | null
  prev_roic: number | null
  roic_delta: number | null
  rsi: number | null
  pe_at_scan: number | null
  median_pe: number | null
  pe_discount_pct: number | null
  relative_strength: number | null
  valuation_verdict: string | null

  // Extended scoring
  technical_score: number | null
  michael_quality_score: number | null
  beneish_m_score: number | null
  altman_z_score: number | null
  roic_wacc_spread: number | null
  valuation_fair_value: number | null
  valuation_upside_pct: number | null
  momentum_at_scan: number | null
  atr: number | null
  volume_ratio: number | null

  // Insider signals
  insider_signal: string | null
  insider_net_value_usd: number | null
  insider_buy_cluster: boolean | null

  // Context
  sector: string | null
  regime_at_scan: string | null
  price_at_scan: number | null
}

export interface Prediction {
  ticker: string
  scan_date: string
  predicted_outcome: string
  probability: number | null
  actual_outcome: string | null
  resolved: number
  brier_score: number | null
}

export interface CounterfactualEntry {
  ticker: string
  scan_date: string
  rejection_gate: string
  rejection_reason: string
  forward_return_pct: number
}

export interface Counterfactuals {
  top_misses: CounterfactualEntry[]
  top_good_rejections: CounterfactualEntry[]
}

export interface DecisionsResponse {
  message: string | null
  decisions: Decision[] | null
  decisions_error: string | null
  predictions: Prediction[] | null
  predictions_error: string | null
  counterfactuals: Counterfactuals | null
  counterfactuals_error: string | null
}

// ── Ticker deep-dive types ──────────────────────────────────────────────

export interface ScoringHistoryEntry {
  scan_date: string
  ticker: string
  fundamental_score: number | null
  technical_score: number | null
  roic_at_scan: number | null
  rsi: number | null
  pe_at_scan: number | null
  relative_strength: number | null
  valuation_verdict: string | null
  michael_quality_score: number | null
  price_at_scan: number | null
  sector: string | null
}

export interface RejectionHistoryEntry {
  scan_date: string
  ticker: string
  rejected_at_gate: string
  rejection_reason: string
  t_plus_5: number | null
  t_plus_10: number | null
  t_plus_20: number | null
}

export interface TickerDeepDiveResponse {
  decisions: Decision[] | null
  scoring_history: ScoringHistoryEntry[] | null
  rejection_history: RejectionHistoryEntry[] | null
  predictions: Prediction[] | null
  error: string | null
  predictions_error: string | null
}
