import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { FunnelResponse } from "@/types/funnel"
import { FUNNEL_STALE_TIME } from "@/lib/constants"

export function useFunnel(scanDate?: string) {
  const path = scanDate
    ? `/api/funnel?scan_date=${encodeURIComponent(scanDate)}`
    : "/api/funnel"

  return useQuery({
    queryKey: ["funnel", scanDate ?? ""],
    queryFn: () => apiClient<FunnelResponse>(path),
    staleTime: FUNNEL_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}
