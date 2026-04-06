import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DrilldownTable } from "./DrilldownTable"
import type { FunnelDrilldownEntry } from "@/types/funnel"

const mockEntries: FunnelDrilldownEntry[] = [
  { ticker: "META", stage: "scout_rejected", reason: "Failed momentum gate" },
  {
    ticker: "AMZN",
    stage: "guardian_rejected",
    reason: "Sector concentration exceeded",
  },
  { ticker: "NFLX", stage: "scout_rejected", reason: "Low volume" },
  {
    ticker: "TSLA",
    stage: "guardian_rejected",
    reason: "Conviction below threshold",
  },
  { ticker: "AAPL", stage: "traded", reason: "buy" },
]

describe("DrilldownTable", () => {
  it("renders filtered entries for selected stage", () => {
    render(
      <DrilldownTable entries={mockEntries} selectedStage="scout_rejected" />
    )
    expect(screen.getByText("META")).toBeInTheDocument()
    expect(screen.getByText("Failed momentum gate")).toBeInTheDocument()
    expect(screen.getByText("NFLX")).toBeInTheDocument()
    expect(screen.getByText("Low volume")).toBeInTheDocument()
    // guardian_rejected entries should not appear
    expect(screen.queryByText("AMZN")).not.toBeInTheDocument()
  })

  it("renders table headers", () => {
    render(
      <DrilldownTable entries={mockEntries} selectedStage="scout_rejected" />
    )
    expect(screen.getByText("Ticker")).toBeInTheDocument()
    expect(screen.getByText("Stage")).toBeInTheDocument()
    expect(screen.getByText("Reason")).toBeInTheDocument()
  })

  it("renders empty state when no entries match", () => {
    render(
      <DrilldownTable entries={mockEntries} selectedStage="michael_traded" />
    )
    expect(
      screen.getByText("No drill-down entries for this stage.")
    ).toBeInTheDocument()
  })

  it("renders empty state for empty entries array", () => {
    render(<DrilldownTable entries={[]} selectedStage="scout_rejected" />)
    expect(
      screen.getByText("No drill-down entries for this stage.")
    ).toBeInTheDocument()
  })

  it("renders table with aria-label for accessibility", () => {
    render(
      <DrilldownTable
        entries={mockEntries}
        selectedStage="guardian_rejected"
      />
    )
    expect(
      screen.getByRole("table", { name: "Stage drill-down details" })
    ).toBeInTheDocument()
  })

  it("renders traded entries when filtered by traded stage", () => {
    render(
      <DrilldownTable entries={mockEntries} selectedStage="traded" />
    )
    expect(screen.getByText("AAPL")).toBeInTheDocument()
    expect(screen.getByText("buy")).toBeInTheDocument()
    expect(screen.queryByText("META")).not.toBeInTheDocument()
  })

  it("renders the scrollable container with overflow-x-auto", () => {
    const { container } = render(
      <DrilldownTable entries={mockEntries} selectedStage="scout_rejected" />
    )
    const scrollContainer = container.querySelector(".overflow-x-auto")
    expect(scrollContainer).toBeInTheDocument()
  })
})
