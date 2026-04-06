import { Card, CardContent } from "@/components/ui/card"
import type { AlertEvent } from "@/types/health"
import { formatRelativeTime } from "@/lib/format-time"

interface AlertsListProps {
  alerts: AlertEvent[]
}

export function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          No recent alerts
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="divide-y divide-muted p-0">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-center gap-3 px-4 py-3">
            <span className="shrink-0 text-xs text-faint-foreground">
              {formatRelativeTime(alert.created_at)}
            </span>
            <span className="text-sm font-medium">{alert.source}</span>
            <span className="text-xs text-muted-foreground">
              {alert.event_type}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
