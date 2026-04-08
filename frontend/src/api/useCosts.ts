import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { CostsResponse } from "@/types/costs"
import { COSTS_STALE_TIME } from "@/lib/constants"

export function useCosts(startDate?: string, endDate?: string, strategyId?: string) {
  const params: Record<string, string> = {}
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate
  if (strategyId) params.strategy_id = strategyId

  return useQuery({
    queryKey: ["costs", startDate ?? "all", endDate ?? "all", strategyId ?? "all"],
    queryFn: () =>
      apiClient<CostsResponse>("/api/costs", Object.keys(params).length > 0 ? params : undefined),
    staleTime: COSTS_STALE_TIME,
  })
}
