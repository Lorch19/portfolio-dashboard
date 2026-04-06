import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentStatusCard } from "./AgentStatusCard"
import type { AgentStatus } from "@/types/health"

const healthyAgent: AgentStatus = {
  agent_name: "Scout",
  status: "healthy",
  last_run: new Date(Date.now() - 5 * 60_000).toISOString(),
  details: null,
  checked_at: new Date().toISOString(),
}

const nullAgent: AgentStatus = {
  agent_name: "Radar",
  status: null,
  last_run: null,
  details: null,
  checked_at: null,
}

describe("AgentStatusCard", () => {
  it("renders agent name and status badge", () => {
    render(<AgentStatusCard agent={healthyAgent} />)
    expect(screen.getByText("Scout")).toBeInTheDocument()
    expect(screen.getByText("healthy")).toBeInTheDocument()
  })

  it("renders last run time for agents with data", () => {
    render(<AgentStatusCard agent={healthyAgent} />)
    expect(screen.getByText(/Last run:/)).toBeInTheDocument()
  })

  it("renders 'No data' for agents with null status", () => {
    render(<AgentStatusCard agent={nullAgent} />)
    expect(screen.getByText("Radar")).toBeInTheDocument()
    expect(screen.getByText("No data")).toBeInTheDocument()
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })
})
