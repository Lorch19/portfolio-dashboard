import { Card, CardContent } from "@/components/ui/card"
import { ErrorCard } from "@/components/ErrorCard"
import { StatusBadge } from "@/components/StatusBadge"
import type { HoldPointStatus } from "@/types/supervisor"
import { formatRelativeTime } from "@/lib/format-time"
import { parseJsonSummary } from "@/lib/parse-json-summary"

interface HoldPointsSectionProps {
  holdPoints: HoldPointStatus | null
  error: string | null
  onRetry?: () => void
}

export function HoldPointsSection({ holdPoints, error, onRetry }: HoldPointsSectionProps) {
  if (error) {
    return <ErrorCard error={error} onRetry={onRetry} />
  }

  if (!holdPoints) {
    return null
  }

  const statusMapping = holdPoints.state === "paused" ? "degraded" : "healthy"

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <StatusBadge
            status={statusMapping as "healthy" | "degraded"}
            variant="full"
            agentName="Hold Points"
          />
          <span className="text-sm font-medium capitalize">{holdPoints.state}</span>
          {holdPoints.trigger_pct != null && (
            <span className="text-xs text-muted-foreground">
              Trigger: {holdPoints.trigger_pct.toFixed(1)}%
            </span>
          )}
        </div>

        {holdPoints.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hold point events
          </p>
        ) : (
          <div className="mt-3 divide-y divide-muted">
            {holdPoints.events.map((event) => {
              const summary = parseJsonSummary(event.data)
              return (
                <div key={event.id} className="py-2">
                  <div className="flex items-center gap-3">
                    <span className="shrink-0 text-xs text-faint-foreground">
                      {formatRelativeTime(event.created_at)}
                    </span>
                    <span className="text-sm font-medium">
                      {event.source}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {event.event_type}
                    </span>
                  </div>
                  {summary && (
                    <p className="mt-0.5 truncate text-xs text-faint-foreground">
                      {summary}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
