export interface Decision {
  scan_date: string
  ticker: string
  decision: string
  conviction: string | null
  thesis_full_text: string | null
  primary_catalyst: string | null
  invalidation_trigger: string | null
  decision_tier: string | null
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
