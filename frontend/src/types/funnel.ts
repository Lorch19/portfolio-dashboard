export interface FunnelStages {
  scout_universe: number
  scout_passed: number
  guardian_approved: number
  guardian_modified: number
  guardian_rejected: number
  michael_traded: number
}

export interface FunnelDrilldownEntry {
  ticker: string
  stage: string
  reason: string
}

export interface FunnelResponse {
  scan_date: string | null
  stages: FunnelStages | null
  stages_error: string | null
  drilldown: FunnelDrilldownEntry[] | null
  drilldown_error: string | null
  message: string | null
}
