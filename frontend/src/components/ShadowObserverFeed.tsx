import { Card, CardContent } from "@/components/ui/card"
import { ErrorCard } from "@/components/ErrorCard"
import type { ShadowObserverEvent } from "@/types/supervisor"
import { formatRelativeTime } from "@/lib/format-time"
import { parseJsonSummary } from "@/lib/parse-json-summary"

interface ShadowObserverFeedProps {
  events: ShadowObserverEvent[] | null
  error: string | null
  onRetry?: () => void
}

export function ShadowObserverFeed({ events, error, onRetry }: ShadowObserverFeedProps) {
  if (error) {
    return <ErrorCard error={error} onRetry={onRetry} />
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          No Shadow Observer events
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="divide-y divide-muted p-0">
        {events.map((event) => {
          const summary = parseJsonSummary(event.data)
          return (
            <div key={event.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-xs text-faint-foreground">
                  {formatRelativeTime(event.created_at)}
                </span>
                <span className="text-sm font-medium">{event.source}</span>
                <span className="text-xs text-muted-foreground">
                  {event.event_type}
                </span>
              </div>
              {summary && (
                <p className="mt-1 truncate text-xs text-faint-foreground">
                  {summary}
                </p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
