import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useHoldings } from "@/api/useHoldings"
import { useStrategies } from "@/api/useStrategies"
import { ErrorCard } from "@/components/ErrorCard"
import { HoldingsTable } from "@/components/HoldingsTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Briefcase } from "lucide-react"

export const Route = createFileRoute("/holdings")({
  component: HoldingsPage,
})

function HoldingsPage() {
  const [strategyId, setStrategyId] = useState<string>("")
  const { data: strategiesData } = useStrategies()
  const { data, isLoading, isError, error, refetch } = useHoldings(strategyId || undefined)

  const strategies = strategiesData?.strategies ?? []

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

  const summary = data?.portfolio_summary
  const selectedStrategy = strategies.find((s) => s.strategy_id === strategyId)

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Holdings</h1>

        {strategies.length > 1 && (
          <div className="flex items-center gap-3">
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
              aria-label="Filter by strategy"
            >
              <option value="">All Strategies</option>
              {strategies.map((s) => (
                <option key={s.strategy_id} value={s.strategy_id}>
                  {s.strategy_id} (since {s.start_date})
                </option>
              ))}
            </select>
            {selectedStrategy && (
              <span className="text-xs text-muted-foreground">
                {selectedStrategy.open_positions} positions
              </span>
            )}
          </div>
        )}
      </div>

      {/* Portfolio Summary Header */}
      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Total Value" value={summary.total_value != null ? `$${summary.total_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"} />
          <SummaryCard label="Cash" value={summary.cash_pct != null ? `${summary.cash_pct}%` : "—"} subtext={summary.cash != null ? `$${summary.cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined} />
          <SummaryCard label="Invested" value={summary.invested_pct != null ? `${summary.invested_pct}%` : "—"} />
          <SummaryCard label="Positions" value={String(summary.positions_count ?? "—")} />
          <SummaryCard label="Regime" value={summary.regime ?? "—"} />
          <SummaryCard label="Heat" value={summary.portfolio_heat != null ? `${summary.portfolio_heat}%` : "—"} />
        </div>
      )}

      {data?.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}

      {/* Positions error */}
      <div aria-live="polite">
        {data?.positions_error ? (
          <ErrorCard error={data.positions_error} onRetry={() => refetch()} />
        ) : data?.positions && data.positions.length > 0 ? (
          <section aria-label="Positions Table">
            <HoldingsTable positions={data.positions} />
          </section>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Risk data warning (positions may still be visible) */}
      {data?.risk_data_error && !data?.positions_error && (
        <div aria-live="polite">
          <ErrorCard error={`Risk data unavailable: ${data.risk_data_error}`} onRetry={() => refetch()} />
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-lg bg-card p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
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
