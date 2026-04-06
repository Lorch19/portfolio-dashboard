import { createFileRoute } from "@tanstack/react-router"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/performance")({
  component: PerformancePage,
})

function PerformancePage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Performance</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  )
}
