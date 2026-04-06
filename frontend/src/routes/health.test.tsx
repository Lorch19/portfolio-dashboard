import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { HealthResponse } from "@/types/health"
import { KpiCard } from "@/components/KpiCard"
import { AgentStatusCard } from "@/components/AgentStatusCard"
import { AlertsList } from "@/components/AlertsList"
import { ErrorCard } from "@/components/ErrorCard"

const mockHealthData: HealthResponse = {
  agents: [
    { agent_name: "Scout", status: "healthy", last_run: "2026-04-04T06:35:00", details: null, checked_at: "2026-04-04T06:40:00" },
    { agent_name: "Radar", status: "healthy", last_run: "2026-04-04T06:30:00", details: null, checked_at: "2026-04-04T06:40:00" },
    { agent_name: "Guardian", status: "degraded", last_run: "2026-04-04T06:00:00", details: null, checked_at: "2026-04-04T06:40:00" },
    { agent_name: "Chronicler", status: "healthy", last_run: "2026-04-04T06:35:00", details: null, checked_at: "2026-04-04T06:40:00" },
    { agent_name: "Michael", status: "healthy", last_run: "2026-04-04T06:35:00", details: null, checked_at: "2026-04-04T06:40:00" },
    { agent_name: "Shadow Observer", status: "down", last_run: null, details: null, checked_at: null },
  ],
  agents_error: null,
  heartbeats: { Scout: { status: "healthy", checked_at: "2026-04-04T06:40:00" } },
  heartbeats_error: null,
  alerts: [
    { id: 1, source: "Guardian", event_type: "alert", data: null, created_at: "2026-04-04T06:00:00" },
  ],
  alerts_error: null,
  vps_metrics: { cpu_percent: 12.5, memory_percent: 45.2, disk_percent: 62.0 },
  vps_metrics_error: null,
}

describe("Health tab components integration", () => {
  it("renders VPS metrics as KPI cards", () => {
    const vps = mockHealthData.vps_metrics!
    render(
      <div>
        <KpiCard label="CPU" value={`${vps.cpu_percent.toFixed(1)}%`} trend="positive" />
        <KpiCard label="Memory" value={`${vps.memory_percent.toFixed(1)}%`} trend="positive" />
        <KpiCard label="Disk" value={`${vps.disk_percent.toFixed(1)}%`} trend="neutral" />
      </div>
    )
    expect(screen.getByText("CPU")).toBeInTheDocument()
    expect(screen.getByText("12.5%")).toBeInTheDocument()
    expect(screen.getByText("Memory")).toBeInTheDocument()
    expect(screen.getByText("45.2%")).toBeInTheDocument()
    expect(screen.getByText("Disk")).toBeInTheDocument()
    expect(screen.getByText("62.0%")).toBeInTheDocument()
  })

  it("renders all 6 agent status cards", () => {
    render(
      <div>
        {mockHealthData.agents!.map((agent) => (
          <AgentStatusCard key={agent.agent_name} agent={agent} />
        ))}
      </div>
    )
    expect(screen.getByText("Scout")).toBeInTheDocument()
    expect(screen.getByText("Radar")).toBeInTheDocument()
    expect(screen.getByText("Guardian")).toBeInTheDocument()
    expect(screen.getByText("Chronicler")).toBeInTheDocument()
    expect(screen.getByText("Michael")).toBeInTheDocument()
    expect(screen.getByText("Shadow Observer")).toBeInTheDocument()
  })

  it("renders alerts list with alert data", () => {
    render(<AlertsList alerts={mockHealthData.alerts!} />)
    expect(screen.getByText("Guardian")).toBeInTheDocument()
    expect(screen.getByText("alert")).toBeInTheDocument()
  })

  it("renders empty alerts list", () => {
    render(<AlertsList alerts={[]} />)
    expect(screen.getByText("No recent alerts")).toBeInTheDocument()
  })

  it("renders error card with retry", () => {
    const onRetry = vi.fn()
    render(<ErrorCard error="Failed to load health data" onRetry={onRetry} />)
    expect(screen.getByText("Failed to load health data")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("determines green board effect correctly", () => {
    const allHealthy = mockHealthData.agents!.every((a) => a.status === "healthy")
    expect(allHealthy).toBe(false) // Guardian is degraded, Shadow Observer is down

    const allHealthyData = {
      ...mockHealthData,
      agents: mockHealthData.agents!.map((a) => ({ ...a, status: "healthy" as const })),
    }
    const allHealthy2 = allHealthyData.agents.every((a) => a.status === "healthy")
    expect(allHealthy2).toBe(true)
  })
})
