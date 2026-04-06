import { Card, CardContent } from "@/components/ui/card"
import { ErrorCard } from "@/components/ErrorCard"
import type { StranglerFigStatus } from "@/types/supervisor"

const modeStyles: Record<string, string> = {
  "v1-cron": "bg-muted text-muted-foreground",
  "v2-supervisor": "bg-success/15 text-success",
  dual: "bg-warning/15 text-warning",
}

interface StranglerFigTrackerProps {
  stranglerFig: StranglerFigStatus | null
  error: string | null
  onRetry?: () => void
}

export function StranglerFigTracker({ stranglerFig, error, onRetry }: StranglerFigTrackerProps) {
  if (error) {
    return <ErrorCard error={error} onRetry={onRetry} />
  }

  if (!stranglerFig) {
    return null
  }

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground">
          Migration Progress
        </p>
        <p className="mt-1 text-lg font-bold">
          {stranglerFig.progress_summary}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(stranglerFig.components).map(([name, comp]) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-md border border-muted px-3 py-2"
            >
              <span className="text-sm font-medium">{name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${modeStyles[comp.mode] ?? "bg-muted text-muted-foreground"}`}
              >
                {comp.mode}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
