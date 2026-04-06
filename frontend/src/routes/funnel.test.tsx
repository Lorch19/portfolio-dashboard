import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { FunnelResponse, FunnelStages } from "@/types/funnel"
import { FunnelChart } from "@/components/FunnelChart"
import { DrilldownTable } from "@/components/DrilldownTable"
import { FunnelDatePicker } from "@/components/FunnelDatePicker"
import { ErrorCard } from "@/components/ErrorCard"

const mockStages: FunnelStages = {
  scout_universe: 1520,
  scout_passed: 45,
  guardian_approved: 12,
  guardian_modified: 3,
  guardian_rejected: 30,
  michael_traded: 8,
}

const mockFunnelData: FunnelResponse = {
  scan_date: "2026-04-04",
  stages: mockStages,
  stages_error: null,
  drilldown: [
    { ticker: "META", stage: "scout_rejected", reason: "Failed momentum gate" },
    {
      ticker: "AMZN",
      stage: "guardian_rejected",
      reason: "Sector concentration exceeded",
    },
    { ticker: "NFLX", stage: "scout_rejected", reason: "Low volume" },
    { ticker: "AAPL", stage: "traded", reason: "buy" },
  ],
  drilldown_error: null,
  message: null,
}

describe("Funnel tab components integration", () => {
  it("renders funnel chart with all stages", () => {
    render(
      <FunnelChart
        stages={mockFunnelData.stages!}
        selectedStage={null}
        onStageClick={() => {}}
      />
    )
    expect(screen.getByText("Scout Universe")).toBeInTheDocument()
    expect(screen.getByText("1,520")).toBeInTheDocument()
    expect(screen.getByText("Michael Traded")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
  })

  it("renders drilldown table filtered by stage", () => {
    render(
      <DrilldownTable
        entries={mockFunnelData.drilldown!}
        selectedStage="scout_rejected"
      />
    )
    expect(screen.getByText("META")).toBeInTheDocument()
    expect(screen.getByText("NFLX")).toBeInTheDocument()
    expect(screen.queryByText("AMZN")).not.toBeInTheDocument()
  })

  it("renders date picker with scan date", () => {
    render(<FunnelDatePicker value="2026-04-04" onChange={() => {}} />)
    const input = screen.getByLabelText("Scan Date") as HTMLInputElement
    expect(input.value).toBe("2026-04-04")
  })

  it("renders error card for stages error", () => {
    const onRetry = vi.fn()
    render(<ErrorCard error="DB connection failed" onRetry={onRetry} />)
    expect(screen.getByText("DB connection failed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("renders error card for drilldown error", () => {
    render(<ErrorCard error="rejection_log table missing" />)
    expect(
      screen.getByText("rejection_log table missing")
    ).toBeInTheDocument()
  })

  it("handles stage click to show drilldown", async () => {
    const user = userEvent.setup()
    const onStageClick = vi.fn()

    render(
      <FunnelChart
        stages={mockFunnelData.stages!}
        selectedStage={null}
        onStageClick={onStageClick}
      />
    )

    await user.click(
      screen.getByRole("button", { name: "Guardian Rejected: 30" })
    )
    expect(onStageClick).toHaveBeenCalledWith("guardian_rejected")
  })

  it("renders message when present", () => {
    const dataWithMessage: FunnelResponse = {
      ...mockFunnelData,
      message: "No funnel data for 2026-01-01",
    }
    render(<p>{dataWithMessage.message}</p>)
    expect(
      screen.getByText("No funnel data for 2026-01-01")
    ).toBeInTheDocument()
  })

  it("renders traded drilldown entries when filtered by traded stage", () => {
    render(
      <DrilldownTable
        entries={mockFunnelData.drilldown!}
        selectedStage="traded"
      />
    )
    expect(screen.getByText("AAPL")).toBeInTheDocument()
    expect(screen.getByText("buy")).toBeInTheDocument()
    expect(screen.queryByText("META")).not.toBeInTheDocument()
  })

  it("handles null stages gracefully", () => {
    const data: FunnelResponse = {
      ...mockFunnelData,
      stages: null,
      stages_error: "Failed to query stages",
    }
    render(<ErrorCard error={data.stages_error!} />)
    expect(screen.getByText("Failed to query stages")).toBeInTheDocument()
  })

  it("handles null drilldown gracefully", () => {
    const data: FunnelResponse = {
      ...mockFunnelData,
      drilldown: null,
      drilldown_error: "rejection_log missing",
    }
    render(<ErrorCard error={data.drilldown_error!} />)
    expect(screen.getByText("rejection_log missing")).toBeInTheDocument()
  })
})
