import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useFunnel } from "@/api/useFunnel"
import { ErrorCard } from "@/components/ErrorCard"
import { FunnelChart } from "@/components/FunnelChart"
import { DrilldownTable } from "@/components/DrilldownTable"
import { FunnelDatePicker } from "@/components/FunnelDatePicker"
import { Skeleton } from "@/components/ui/skeleton"

/** Map chart stage keys to the drilldown stage values returned by the backend */
const STAGE_TO_DRILLDOWN: Record<string, string> = {
  scout_passed: "scout_rejected",
  michael_traded: "traded",
}

export const Route = createFileRoute("/funnel")({
  validateSearch: (search: Record<string, unknown>) => ({
    scan_date: (search.scan_date as string) || "",
  }),
  component: FunnelPage,
})

function FunnelPage() {
  const { scan_date } = Route.useSearch()
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useFunnel(
    scan_date || undefined
  )
  // Key on scan_date to reset selectedStage when date changes (avoids setState in effect)
  const [selectedStage, setSelectedStage] = useState<{ date: string; stage: string | null }>({ date: scan_date, stage: null })
  if (selectedStage.date !== scan_date) {
    setSelectedStage({ date: scan_date, stage: null })
  }
  const activeStage = selectedStage.stage

  if (isLoading) return <FunnelSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load funnel data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const handleDateChange = (date: string) => {
    navigate({
      to: "/funnel",
      search: { scan_date: date },
    })
  }

  const displayDate = scan_date || data?.scan_date || ""

  // Map chart stage names to backend drilldown stage names
  const drilldownStage = activeStage
    ? STAGE_TO_DRILLDOWN[activeStage] ?? activeStage
    : null

  return (
    <div className="space-y-6 p-6" aria-live="polite">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Funnel</h1>
        <FunnelDatePicker value={displayDate} onChange={handleDateChange} />
      </div>

      {data?.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}

      {/* Funnel Chart Section */}
      {data?.stages_error ? (
        <ErrorCard error={data.stages_error} onRetry={() => refetch()} />
      ) : data?.stages ? (
        <section aria-label="Funnel Chart">
          <FunnelChart
            stages={data.stages}
            selectedStage={activeStage}
            onStageClick={(stage) => setSelectedStage({ date: scan_date, stage })}
          />
        </section>
      ) : null}

      {/* Drilldown Table Section */}
      {drilldownStage && (
        <>
          {data?.drilldown_error ? (
            <ErrorCard
              error={data.drilldown_error}
              onRetry={() => refetch()}
            />
          ) : data?.drilldown ? (
            <section aria-label="Stage Drill-down">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                Drill-down
              </h2>
              <DrilldownTable
                entries={data.drilldown}
                selectedStage={drilldownStage}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function FunnelSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
