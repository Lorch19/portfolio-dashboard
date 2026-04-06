import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { HoldPointsSection } from "./HoldPointsSection"
import type { HoldPointStatus } from "@/types/supervisor"

const mockActiveHoldPoints: HoldPointStatus = {
  state: "active",
  trigger_pct: null,
  events: [
    {
      id: 5,
      source: "Guardian",
      event_type: "drawdown_pause",
      data: '{"drawdown_pct": 5.2}',
      created_at: "2026-04-03T14:00:00",
    },
    {
      id: 6,
      source: "shadow_observer",
      event_type: "hold_point_triggered",
      data: null,
      created_at: "2026-04-03T13:00:00",
    },
  ],
}

describe("HoldPointsSection", () => {
  it("renders active state", () => {
    render(<HoldPointsSection holdPoints={mockActiveHoldPoints} error={null} />)
    expect(screen.getByText("active")).toBeInTheDocument()
  })

  it("renders paused state with trigger percentage", () => {
    const paused: HoldPointStatus = {
      state: "paused",
      trigger_pct: 5.0,
      events: [],
    }
    render(<HoldPointsSection holdPoints={paused} error={null} />)
    expect(screen.getByText("paused")).toBeInTheDocument()
    expect(screen.getByText("Trigger: 5.0%")).toBeInTheDocument()
  })

  it("renders hold point events", () => {
    render(<HoldPointsSection holdPoints={mockActiveHoldPoints} error={null} />)
    expect(screen.getByText("drawdown_pause")).toBeInTheDocument()
    expect(screen.getByText("hold_point_triggered")).toBeInTheDocument()
  })

  it("renders parsed data summary for events", () => {
    render(<HoldPointsSection holdPoints={mockActiveHoldPoints} error={null} />)
    expect(screen.getByText("drawdown_pct: 5.2")).toBeInTheDocument()
  })

  it("renders empty events state", () => {
    const empty: HoldPointStatus = {
      state: "active",
      trigger_pct: null,
      events: [],
    }
    render(<HoldPointsSection holdPoints={empty} error={null} />)
    expect(screen.getByText("No hold point events")).toBeInTheDocument()
  })

  it("renders error card when error is provided", () => {
    render(<HoldPointsSection holdPoints={null} error="DB error" />)
    expect(screen.getByText("DB error")).toBeInTheDocument()
  })

  it("renders nothing when holdPoints is null and no error", () => {
    const { container } = render(
      <HoldPointsSection holdPoints={null} error={null} />,
    )
    expect(container.innerHTML).toBe("")
  })
})
