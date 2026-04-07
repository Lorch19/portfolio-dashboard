import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { DecisionsResponse } from "@/types/decisions"
import { DECISIONS_STALE_TIME } from "@/lib/constants"

export function useDecisions(ticker?: string) {
  const url = ticker ? `/api/decisions?ticker=${encodeURIComponent(ticker)}` : "/api/decisions"
  return useQuery({
    queryKey: ["decisions", ticker ?? ""],
    queryFn: () => apiClient<DecisionsResponse>(url),
    staleTime: DECISIONS_STALE_TIME,
  })
}
