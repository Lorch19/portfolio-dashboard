import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { StrategiesResponse } from "@/types/strategies"

export function useStrategies() {
  return useQuery({
    queryKey: ["strategies"],
    queryFn: () => apiClient<StrategiesResponse>("/api/strategies"),
    staleTime: 300_000,
  })
}
