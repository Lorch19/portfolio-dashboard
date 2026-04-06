import { createFileRoute } from "@tanstack/react-router"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/debug/logs")({
  component: DebugLogsPage,
})

function DebugLogsPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
