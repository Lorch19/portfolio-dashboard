import { createFileRoute } from "@tanstack/react-router"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/decisions")({
  component: DecisionsPage,
})

function DecisionsPage() {
  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Decisions</h1>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}
