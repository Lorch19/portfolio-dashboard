import { createFileRoute } from "@tanstack/react-router"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/costs")({
  component: CostsPage,
})

function CostsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Costs</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  )
}
