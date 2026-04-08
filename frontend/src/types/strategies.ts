export interface Strategy {
  strategy_id: string
  start_date: string
  latest_snapshot_date: string
  latest_value: number | null
  open_positions: number
}

export interface StrategiesResponse {
  strategies: Strategy[]
  error: string | null
}
