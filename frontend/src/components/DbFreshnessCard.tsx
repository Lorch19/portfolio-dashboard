import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/StatusBadge"
import type { DbFreshness } from "@/types/health"

interface DbFreshnessCardProps {
  db: DbFreshness
}

const DB_LABELS: Record<string, string> = {
  portfolio_db: "Portfolio DB",
  supervisor_db: "Supervisor DB",
}

// DbFreshness status values (healthy/stale/missing) map onto the shared
// StatusBadge palette (healthy/degraded/down).
const STATUS_MAP: Record<DbFreshness["status"], "healthy" | "degraded" | "down"> = {
  healthy: "healthy",
  stale: "degraded",
  missing: "down",
}

function formatAge(seconds: number | null): string {
  if (seconds == null) return "no data"
  if (seconds < 60) return `${Math.round(seconds)}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  return `${(seconds / 3600).toFixed(1)}h ago`
}

export function DbFreshnessCard({ db }: DbFreshnessCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0 overflow-hidden">
          <p className="truncate text-sm font-medium">
            {DB_LABELS[db.name] ?? db.name}
          </p>
          <p className="mt-0.5 text-xs text-faint-foreground">
            Synced: {formatAge(db.age_seconds)}
          </p>
        </div>
        <StatusBadge
          status={STATUS_MAP[db.status]}
          variant="full"
          agentName={DB_LABELS[db.name] ?? db.name}
        />
      </CardContent>
    </Card>
  )
}
