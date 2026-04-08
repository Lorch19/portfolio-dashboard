import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { PerformanceResponse } from "@/types/performance"
import { PERFORMANCE_STALE_TIME } from "@/lib/constants"

export function usePerformance(strategyId?: string, startDate?: string, endDate?: string) {
  const params: Record<string, string> = {}
  if (strategyId) params.strategy_id = strategyId
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate

  return useQuery({
    queryKey: ["performance", strategyId ?? "all", startDate ?? "all", endDate ?? "all"],
    queryFn: () =>
      apiClient<PerformanceResponse>("/api/performance", Object.keys(params).length > 0 ? params : undefined),
    staleTime: PERFORMANCE_STALE_TIME,
  })
}
