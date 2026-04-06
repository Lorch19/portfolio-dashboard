import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/StatusBadge"
import type { AgentStatus } from "@/types/health"
import { formatRelativeTime } from "@/lib/format-time"

interface AgentStatusCardProps {
  agent: AgentStatus
}

export function AgentStatusCard({ agent }: AgentStatusCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="min-w-0 overflow-hidden">
          <p className="truncate text-sm font-medium">{agent.agent_name}</p>
          <p className="mt-0.5 text-xs text-faint-foreground">
            {agent.last_run
              ? `Last run: ${formatRelativeTime(agent.last_run)}`
              : "No data"}
          </p>
        </div>
        <StatusBadge status={agent.status} variant="full" agentName={agent.agent_name} />
      </CardContent>
    </Card>
  )
}
