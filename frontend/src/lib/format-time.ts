/**
 * Format an ISO timestamp as relative time ("2m ago", "3h ago")
 * or absolute if older than 24 hours.
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = Date.now()
  const diffMs = now - date.getTime()

  if (Number.isNaN(date.getTime())) return "Unknown"
  if (diffMs < 0) return formatAbsolute(date)

  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`

  return formatAbsolute(date)
}

function formatAbsolute(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
