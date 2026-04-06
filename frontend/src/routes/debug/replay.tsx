import { createFileRoute } from "@tanstack/react-router"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/debug/replay")({
  component: DebugReplayPage,
})

function DebugReplayPage() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
