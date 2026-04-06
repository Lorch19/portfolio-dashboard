import { createFileRoute } from "@tanstack/react-router"
import { useSupervisor } from "@/api/useSupervisor"
import { ErrorCard } from "@/components/ErrorCard"
import { ShadowObserverFeed } from "@/components/ShadowObserverFeed"
import { HoldPointsSection } from "@/components/HoldPointsSection"
import { StranglerFigTracker } from "@/components/StranglerFigTracker"
import { DaemonStatusSection } from "@/components/DaemonStatusSection"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute("/supervisor")({
  component: SupervisorPage,
})

function SupervisorPage() {
  const { data, isLoading, isError, error, refetch } = useSupervisor()

  if (isLoading) return <SupervisorSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load supervisor data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6" aria-live="polite">
      <h1 className="text-xl font-semibold">Supervisor</h1>

      {/* Shadow Observer + Hold Points side-by-side on desktop */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-label="Shadow Observer Events">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Shadow Observer
          </h2>
          <ShadowObserverFeed
            events={data?.shadow_observer_events ?? null}
            error={data?.shadow_observer_events_error ?? null}
            onRetry={() => refetch()}
          />
        </section>

        <section aria-label="Hold Points">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Hold Points
          </h2>
          <HoldPointsSection
            holdPoints={data?.hold_points ?? null}
            error={data?.hold_points_error ?? null}
            onRetry={() => refetch()}
          />
        </section>
      </div>

      {/* Strangler Fig Progress */}
      <section aria-label="Strangler Fig Migration">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Strangler Fig Migration
        </h2>
        <StranglerFigTracker
          stranglerFig={data?.strangler_fig ?? null}
          error={data?.strangler_fig_error ?? null}
          onRetry={() => refetch()}
        />
      </section>

      {/* Daemon Status Grid */}
      <section aria-label="Daemon Status">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Daemons
        </h2>
        <DaemonStatusSection
          daemons={data?.daemons ?? null}
          error={data?.daemons_error ?? null}
          onRetry={() => refetch()}
        />
      </section>
    </div>
  )
}

function SupervisorSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-7 w-28" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
