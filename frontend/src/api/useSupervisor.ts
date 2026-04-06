import { useQuery } from "@tanstack/react-query"
import { apiClient } from "./client"
import type { SupervisorResponse } from "@/types/supervisor"
import { SUPERVISOR_REFETCH_INTERVAL } from "@/lib/constants"

export function useSupervisor() {
  return useQuery({
    queryKey: ["supervisor"],
    queryFn: () => apiClient<SupervisorResponse>("/api/supervisor"),
    refetchInterval: SUPERVISOR_REFETCH_INTERVAL,
    refetchIntervalInBackground: false,
  })
}
