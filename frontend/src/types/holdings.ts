export interface HoldingsPosition {
  ticker: string
  sector: string | null
  entry_price: number
  entry_date: string
  current_price: number
  shares: number
  unrealized_pnl: number
  unrealized_pnl_pct: number | null
  sleeve: number
  stop_loss: number | null
  target_1: number | null
  target_2: number | null
  conviction: string
  days_held: number
  current_stop_level: number | null
  exit_stage: string | null
  portfolio_heat_contribution: number | null
  sector_concentration_status: string | null
}

export interface HoldingsResponse {
  positions: HoldingsPosition[] | null
  positions_error: string | null
  risk_data_error: string | null
  message: string | null
}
