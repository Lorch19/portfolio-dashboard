import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { DecisionsResponse, TickerDeepDiveResponse } from "@/types/decisions"
import { DECISIONS_STALE_TIME } from "@/lib/constants"

export function useDecisions(ticker?: string) {
  const url = ticker ? `/api/decisions?ticker=${encodeURIComponent(ticker)}` : "/api/decisions"
  return useQuery({
    queryKey: ["decisions", ticker ?? ""],
    queryFn: () => apiClient<DecisionsResponse>(url),
    staleTime: DECISIONS_STALE_TIME,
  })
}

export function useTickerDeepDive(ticker: string) {
  return useQuery({
    queryKey: ["ticker-deep-dive", ticker],
    queryFn: () =>
      apiClient<TickerDeepDiveResponse>(
        `/api/decisions/${encodeURIComponent(ticker)}`,
      ),
    staleTime: DECISIONS_STALE_TIME,
    enabled: !!ticker,
  })
}
