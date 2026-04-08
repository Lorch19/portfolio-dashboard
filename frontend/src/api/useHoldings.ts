import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { HoldingsResponse } from "@/types/holdings"
import { HOLDINGS_STALE_TIME } from "@/lib/constants"

export function useHoldings(strategyId?: string) {
  return useQuery({
    queryKey: ["holdings", strategyId ?? "all"],
    queryFn: () =>
      apiClient<HoldingsResponse>("/api/holdings", strategyId ? { strategy_id: strategyId } : undefined),
    staleTime: HOLDINGS_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}
