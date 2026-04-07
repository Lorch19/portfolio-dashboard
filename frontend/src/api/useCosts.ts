import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { CostsResponse } from "@/types/costs"
import { COSTS_STALE_TIME } from "@/lib/constants"

export function useCosts() {
  return useQuery({
    queryKey: ["costs"],
    queryFn: () => apiClient<CostsResponse>("/api/costs"),
    staleTime: COSTS_STALE_TIME,
  })
}
