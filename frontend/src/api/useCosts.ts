import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { CostsResponse } from "@/types/costs"
import { COSTS_STALE_TIME } from "@/lib/constants"

export function useCosts(startDate?: string, endDate?: string) {
  const params: Record<string, string> = {}
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate

  return useQuery({
    queryKey: ["costs", startDate ?? "all", endDate ?? "all"],
    queryFn: () =>
      apiClient<CostsResponse>("/api/costs", Object.keys(params).length > 0 ? params : undefined),
    staleTime: COSTS_STALE_TIME,
  })
}
