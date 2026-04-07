import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { PerformanceResponse } from "@/types/performance"
import { PERFORMANCE_STALE_TIME } from "@/lib/constants"

export function usePerformance() {
  return useQuery({
    queryKey: ["performance"],
    queryFn: () => apiClient<PerformanceResponse>("/api/performance"),
    staleTime: PERFORMANCE_STALE_TIME,
  })
}
