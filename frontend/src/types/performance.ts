export interface PortfolioSummary {
  total_pnl: number | null
  total_pnl_pct: number | null
  cagr: number | null
  spy_return: number | null
  alpha: number | null
  win_rate: number | null
  start_date: string | null
  end_date: string | null
  total_trades: number
}

export interface PredictionAccuracy {
  total_predictions: number
  resolved_count: number
  hit_rate: number | null
  hit_rate_by_window: {
    t_5: number | null
    t_10: number | null
    t_20: number | null
  }
  average_brier_score: number | null
}

export interface Calibration {
  average_brier_score: number | null
  target_brier: number
  beating_random: boolean | null
  agreement_rate: number | null
  sycophancy_flag: boolean | null
}

export interface ArenaEntry {
  model_id: string
  session: string
  total_decisions: number
  hit_rate: number | null
  average_alpha: number | null
  total_cost: number
}

export interface Snapshot {
  snapshot_date: string
  portfolio_value: number
  spy_value: number | null
}

export interface PerformanceResponse {
  message: string | null
  portfolio_summary: PortfolioSummary | null
  portfolio_summary_error: string | null
  snapshots: Snapshot[] | null
  snapshots_error: string | null
  prediction_accuracy: PredictionAccuracy | null
  prediction_accuracy_error: string | null
  calibration: Calibration | null
  calibration_error: string | null
  arena_comparison: ArenaEntry[] | null
  arena_comparison_error: string | null
}
