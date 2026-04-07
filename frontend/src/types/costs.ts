export interface BrokerageTrade {
  ticker: string
  trade_date: string
  action: string
  shares: number | null
  price: number | null
  estimated_cost: number
}

export interface BrokerageCosts {
  trades: BrokerageTrade[]
  cumulative_trade_event_fees: number
  cumulative_realized_fees: number
  cumulative_total: number
}

export interface ApiCostModel {
  model_id: string
  total_decisions: number
  total_cost: number
}

export interface ApiCosts {
  per_model: ApiCostModel[]
  cumulative_total: number
}

export interface PortfolioReturn {
  start_value: number
  end_value: number
  total_return: number
  total_return_pct: number
  start_date: string
  end_date: string
  months_running: number
}

export interface CostsResponse {
  message: string | null
  brokerage: BrokerageCosts | null
  brokerage_error: string | null
  api_costs: ApiCosts | null
  api_costs_error: string | null
  portfolio_return: PortfolioReturn | null
  portfolio_return_error: string | null
  vps_monthly_cost: number
  vps_cumulative: number
  total_system_cost: number
  cost_per_trade: number | null
  total_trades: number
  net_return_after_costs: number | null
  cost_as_pct_of_returns: number | null
}
