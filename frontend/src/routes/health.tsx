import { createFileRoute } from "@tanstack/react-router"
import { useHealth } from "@/api/useHealth"
import { ErrorCard } from "@/components/ErrorCard"
import { KpiCard, KpiCardSkeleton } from "@/components/KpiCard"
import { AgentStatusCard } from "@/components/AgentStatusCard"
import { AlertsList } from "@/components/AlertsList"
import { Skeleton } from "@/components/ui/skeleton"
import {
  VPS_THRESHOLD_WARNING,
  VPS_THRESHOLD_CRITICAL,
} from "@/lib/constants"

export const Route = createFileRoute("/health")({
  component: HealthPage,
})

function metricTrend(value: number): "positive" | "negative" | "neutral" {
  if (!Number.isFinite(value)) return "neutral"
  if (value > VPS_THRESHOLD_CRITICAL) return "negative"
  if (value > VPS_THRESHOLD_WARNING) return "neutral"
  return "positive"
}

function safePercent(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "N/A"
}

function HealthPage() {
  const { data, isLoading, isError, error, refetch } = useHealth()

  if (isLoading) return <HealthSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load health data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const allHealthy =
    data?.agents != null &&
    data.agents.length > 0 &&
    data.agents.every((a) => a.status === "healthy")

  return (
    <div
      className={`space-y-6 p-6 ${allHealthy ? "health-all-clear" : ""}`}
      aria-live="polite"
    >
      <h1 className="text-xl font-semibold">Health</h1>

      {/* VPS Metrics KPI Row */}
      {data?.vps_metrics_error ? (
        <ErrorCard
          error={data.vps_metrics_error}
          onRetry={() => refetch()}
        />
      ) : data?.vps_metrics ? (
        <section aria-label="VPS Metrics">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              label="CPU"
              value={safePercent(data.vps_metrics.cpu_percent)}
              trend={metricTrend(data.vps_metrics.cpu_percent)}
            />
            <KpiCard
              label="Memory"
              value={safePercent(data.vps_metrics.memory_percent)}
              trend={metricTrend(data.vps_metrics.memory_percent)}
            />
            <KpiCard
              label="Disk"
              value={safePercent(data.vps_metrics.disk_percent)}
              trend={metricTrend(data.vps_metrics.disk_percent)}
            />
          </div>
        </section>
      ) : null}

      {/* Agent Status Cards */}
      {data?.agents_error ? (
        <ErrorCard error={data.agents_error} onRetry={() => refetch()} />
      ) : data?.agents && data.agents.length > 0 ? (
        <section aria-label="Agent Status">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Agents
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.agents.map((agent) => (
              <AgentStatusCard key={agent.agent_name} agent={agent} />
            ))}
          </div>
        </section>
      ) : data?.agents ? (
        <p className="text-sm text-muted-foreground">No agents configured</p>
      ) : null}

      {/* Alerts List */}
      {data?.alerts_error ? (
        <ErrorCard error={data.alerts_error} onRetry={() => refetch()} />
      ) : data?.alerts ? (
        <section aria-label="Recent Alerts">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Recent Alerts
          </h2>
          <AlertsList alerts={data.alerts} />
        </section>
      ) : null}
    </div>
  )
}

function HealthSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-7 w-20" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-lg" />
    </div>
  )
}
