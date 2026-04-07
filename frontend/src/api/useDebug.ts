import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type {
  DebugEventsResponse,
  DebugLogsResponse,
  DebugReplayResponse,
} from "@/types/debug"

interface EventsParams {
  source?: string
  type?: string
  since?: string
  limit?: number
}

export function useDebugEvents(params: EventsParams, enabled = true) {
  const searchParams = new URLSearchParams()
  if (params.source) searchParams.set("source", params.source)
  if (params.type) searchParams.set("type", params.type)
  if (params.since) searchParams.set("since", params.since)
  if (params.limit) searchParams.set("limit", String(params.limit))

  const qs = searchParams.toString()
  const path = `/api/debug/events${qs ? `?${qs}` : ""}`

  return useQuery<DebugEventsResponse>({
    queryKey: ["debug-events", params],
    queryFn: () => apiClient<DebugEventsResponse>(path),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

interface LogsParams {
  agent?: string
  date?: string
  severity?: string
}

export function useDebugLogs(params: LogsParams, enabled = true) {
  const searchParams = new URLSearchParams()
  if (params.agent) searchParams.set("agent", params.agent)
  if (params.date) searchParams.set("date", params.date)
  if (params.severity) searchParams.set("severity", params.severity)

  const qs = searchParams.toString()
  const path = `/api/debug/logs${qs ? `?${qs}` : ""}`

  return useQuery<DebugLogsResponse>({
    queryKey: ["debug-logs", params],
    queryFn: () => apiClient<DebugLogsResponse>(path),
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function useDebugReplay(date: string, enabled = true) {
  return useQuery<DebugReplayResponse>({
    queryKey: ["debug-replay", date],
    queryFn: () => apiClient<DebugReplayResponse>(`/api/debug/replay?date=${date}`),
    enabled: enabled && !!date,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

interface ReplayDatesResponse {
  dates: string[]
  dates_error: string | null
}

export function useReplayDates() {
  return useQuery<ReplayDatesResponse>({
    queryKey: ["debug-replay-dates"],
    queryFn: () => apiClient<ReplayDatesResponse>("/api/debug/replay/dates"),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}
