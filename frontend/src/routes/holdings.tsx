import { createFileRoute } from "@tanstack/react-router"
import { useHoldings } from "@/api/useHoldings"
import { ErrorCard } from "@/components/ErrorCard"
import { HoldingsTable } from "@/components/HoldingsTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Briefcase } from "lucide-react"

export const Route = createFileRoute("/holdings")({
  component: HoldingsPage,
})

function HoldingsPage() {
  const { data, isLoading, isError, error, refetch } = useHoldings()

  if (isLoading) return <HoldingsSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load holdings data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6" aria-live="polite">
      <h1 className="text-xl font-semibold">Holdings</h1>

      {data?.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}

      {/* Positions error */}
      {data?.positions_error ? (
        <ErrorCard error={data.positions_error} onRetry={() => refetch()} />
      ) : data?.positions && data.positions.length > 0 ? (
        <section aria-label="Positions Table">
          <HoldingsTable positions={data.positions} />
        </section>
      ) : (
        <EmptyState />
      )}

      {/* Risk data warning (positions may still be visible) */}
      {data?.risk_data_error && !data?.positions_error && (
        <ErrorCard error={`Risk data unavailable: ${data.risk_data_error}`} onRetry={() => refetch()} />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Briefcase className="mb-3 h-12 w-12 text-muted-foreground" />
      <h2 className="text-base font-medium">No open positions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Positions will appear here when trades are active.
      </p>
    </div>
  )
}

function HoldingsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-7 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-10 rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
