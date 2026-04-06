export interface ShadowObserverEvent {
  id: number
  source: string
  event_type: string
  data: string | null
  created_at: string
}

export interface HoldPointEvent {
  id: number
  source: string
  event_type: string
  data: string | null
  created_at: string
}

export interface HoldPointStatus {
  state: "active" | "paused"
  trigger_pct: number | null
  events: HoldPointEvent[]
}

export interface StranglerFigComponent {
  mode: "v1-cron" | "v2-supervisor" | "dual"
  description: string
}

export interface StranglerFigStatus {
  components: Record<string, StranglerFigComponent>
  progress_summary: string
}

export interface DaemonStatus {
  component: string
  status: string
  details: string | null
  checked_at: string
}

export interface SupervisorResponse {
  shadow_observer_events: ShadowObserverEvent[] | null
  shadow_observer_events_error: string | null
  hold_points: HoldPointStatus | null
  hold_points_error: string | null
  strangler_fig: StranglerFigStatus | null
  strangler_fig_error: string | null
  daemons: DaemonStatus[] | null
  daemons_error: string | null
}
