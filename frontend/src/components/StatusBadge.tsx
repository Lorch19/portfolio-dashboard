const statusColors: Record<string, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  down: "bg-destructive",
}

interface StatusBadgeProps {
  status: "healthy" | "degraded" | "down" | null
  variant?: "compact" | "full"
  agentName?: string
}

export function StatusBadge({ status, variant = "full", agentName }: StatusBadgeProps) {
  const colorClass = status ? statusColors[status] : "bg-muted-foreground"
  const label = status ?? "unknown"
  const ariaLabel = agentName
    ? `${agentName} agent status: ${label}`
    : `Status: ${label}`

  return (
    <span className="inline-flex items-center gap-1.5" role="status" aria-label={ariaLabel}>
      <span className={`h-2 w-2 rounded-full ${colorClass}`} />
      {variant === "full" && (
        <span className="text-xs capitalize text-muted-foreground">{label}</span>
      )}
    </span>
  )
}
