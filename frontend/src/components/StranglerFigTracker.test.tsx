import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StranglerFigTracker } from "./StranglerFigTracker"
import type { StranglerFigStatus } from "@/types/supervisor"

const mockStranglerFig: StranglerFigStatus = {
  components: {
    Scout: { mode: "v1-cron", description: "Runs via cron schedule" },
    Radar: { mode: "v1-cron", description: "Runs via cron schedule" },
    Guardian: { mode: "v1-cron", description: "Runs via cron schedule" },
    Chronicler: { mode: "v1-cron", description: "Runs via cron schedule" },
    Michael: { mode: "v1-cron", description: "Runs via cron schedule" },
    "Shadow Observer": { mode: "v2-supervisor", description: "Supervisor daemon" },
    DataBridge: { mode: "v2-supervisor", description: "Supervisor sync service" },
    "Health Monitor": { mode: "v2-supervisor", description: "Supervisor health checks" },
  },
  progress_summary: "3/8 components on v2-supervisor",
}

describe("StranglerFigTracker", () => {
  it("renders all 8 component names", () => {
    render(<StranglerFigTracker stranglerFig={mockStranglerFig} error={null} />)
    expect(screen.getByText("Scout")).toBeInTheDocument()
    expect(screen.getByText("Radar")).toBeInTheDocument()
    expect(screen.getByText("Guardian")).toBeInTheDocument()
    expect(screen.getByText("Chronicler")).toBeInTheDocument()
    expect(screen.getByText("Michael")).toBeInTheDocument()
    expect(screen.getByText("Shadow Observer")).toBeInTheDocument()
    expect(screen.getByText("DataBridge")).toBeInTheDocument()
    expect(screen.getByText("Health Monitor")).toBeInTheDocument()
  })

  it("renders correct mode badges", () => {
    render(<StranglerFigTracker stranglerFig={mockStranglerFig} error={null} />)
    expect(screen.getAllByText("v1-cron")).toHaveLength(5)
    expect(screen.getAllByText("v2-supervisor")).toHaveLength(3)
  })

  it("renders progress summary", () => {
    render(<StranglerFigTracker stranglerFig={mockStranglerFig} error={null} />)
    expect(screen.getByText("3/8 components on v2-supervisor")).toBeInTheDocument()
  })

  it("renders error card when error is provided", () => {
    render(<StranglerFigTracker stranglerFig={null} error="Config error" />)
    expect(screen.getByText("Config error")).toBeInTheDocument()
  })

  it("renders nothing when stranglerFig is null and no error", () => {
    const { container } = render(
      <StranglerFigTracker stranglerFig={null} error={null} />,
    )
    expect(container.innerHTML).toBe("")
  })

  it("handles dual mode badge", () => {
    const withDual: StranglerFigStatus = {
      components: {
        Scout: { mode: "dual", description: "Running both v1 and v2" },
      },
      progress_summary: "0/1 components on v2-supervisor",
    }
    render(<StranglerFigTracker stranglerFig={withDual} error={null} />)
    expect(screen.getByText("dual")).toBeInTheDocument()
  })
})
