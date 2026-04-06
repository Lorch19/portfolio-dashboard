export interface AgentStatus {
  agent_name: string
  status: "healthy" | "degraded" | "down" | null
  last_run: string | null
  details: string | null
  checked_at: string | null
}

export interface HeartbeatEntry {
  status: string
  checked_at: string | null
}

export interface VpsMetrics {
  cpu_percent: number
  memory_percent: number
  disk_percent: number
}

export interface AlertEvent {
  id: number
  source: string
  event_type: string
  data: string | null
  created_at: string
}

export interface HealthResponse {
  agents: AgentStatus[] | null
  agents_error: string | null
  heartbeats: Record<string, HeartbeatEntry> | null
  heartbeats_error: string | null
  alerts: AlertEvent[] | null
  alerts_error: string | null
  vps_metrics: VpsMetrics | null
  vps_metrics_error: string | null
}
