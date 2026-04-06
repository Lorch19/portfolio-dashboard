import { Card, CardContent } from "@/components/ui/card"
import { ErrorCard } from "@/components/ErrorCard"
import { StatusBadge } from "@/components/StatusBadge"
import type { DaemonStatus } from "@/types/supervisor"
import { formatRelativeTime } from "@/lib/format-time"
import { parseJsonSummary } from "@/lib/parse-json-summary"

const statusMap: Record<string, "healthy" | "degraded" | "down"> = {
  healthy: "healthy",
  degraded: "degraded",
  down: "down",
}

interface DaemonStatusSectionProps {
  daemons: DaemonStatus[] | null
  error: string | null
  onRetry?: () => void
}

export function DaemonStatusSection({ daemons, error, onRetry }: DaemonStatusSectionProps) {
  if (error) {
    return <ErrorCard error={error} onRetry={onRetry} />
  }

  if (!daemons || daemons.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          No daemon status data
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {daemons.map((daemon) => {
        const detailsSummary = parseJsonSummary(daemon.details)
        return (
          <Card key={daemon.component}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="min-w-0 overflow-hidden">
                <p className="truncate text-sm font-medium">{daemon.component}</p>
                <p className="mt-0.5 text-xs text-faint-foreground">
                  {daemon.checked_at
                    ? `Checked: ${formatRelativeTime(daemon.checked_at)}`
                    : "No data"}
                </p>
                {detailsSummary && (
                  <p className="mt-0.5 truncate text-xs text-faint-foreground">
                    {detailsSummary}
                  </p>
                )}
              </div>
              <StatusBadge
                status={(daemon.status in statusMap ? statusMap[daemon.status] : null) as "healthy" | "degraded" | "down" | null}
                variant="full"
                agentName={daemon.component}
              />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
