import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { HoldingsResponse } from "@/types/holdings"
import { HOLDINGS_STALE_TIME } from "@/lib/constants"

export function useHoldings() {
  return useQuery({
    queryKey: ["holdings"],
    queryFn: () => apiClient<HoldingsResponse>("/api/holdings"),
    staleTime: HOLDINGS_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}
