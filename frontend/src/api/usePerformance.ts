import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { PerformanceResponse } from "@/types/performance"
import { PERFORMANCE_STALE_TIME } from "@/lib/constants"

export function usePerformance(strategyId?: string) {
  return useQuery({
    queryKey: ["performance", strategyId ?? "all"],
    queryFn: () =>
      apiClient<PerformanceResponse>("/api/performance", strategyId ? { strategy_id: strategyId } : undefined),
    staleTime: PERFORMANCE_STALE_TIME,
  })
}
