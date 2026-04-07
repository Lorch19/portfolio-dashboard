import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { HealthResponse } from "@/types/health"
import { HEALTH_REFETCH_INTERVAL } from "@/lib/constants"

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient<HealthResponse>("/api/health"),
    refetchInterval: HEALTH_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  })
}
