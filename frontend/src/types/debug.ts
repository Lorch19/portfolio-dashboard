export interface DebugEvent {
  id: number
  source: string
  event_type: string
  payload: string | null
  timestamp: string
}

export interface DebugEventsResponse {
  events: DebugEvent[]
  events_error: string | null
}

export interface LogEntry {
  timestamp: string
  agent: string
  severity: "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL"
  message: string
  trace: string | null
  source_file: string
}

export interface DebugLogsResponse {
  logs: LogEntry[]
  logs_error: string | null
  message: string | null
}

export interface ReplayStepDetail {
  [key: string]: unknown
}

export interface ReplayStep {
  step: string
  label: string
  summary: string
  detail: ReplayStepDetail
}

export interface DebugReplayResponse {
  date: string
  steps: ReplayStep[]
  message: string | null
  replay_error: string | null
}
