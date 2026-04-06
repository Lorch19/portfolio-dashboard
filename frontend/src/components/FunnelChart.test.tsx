import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FunnelChart } from "./FunnelChart"
import type { FunnelStages } from "@/types/funnel"

const mockStages: FunnelStages = {
  scout_universe: 1520,
  scout_passed: 45,
  guardian_approved: 12,
  guardian_modified: 3,
  guardian_rejected: 30,
  michael_traded: 8,
}

describe("FunnelChart", () => {
  it("renders all 6 stage bars with labels and counts", () => {
    render(
      <FunnelChart
        stages={mockStages}
        selectedStage={null}
        onStageClick={() => {}}
      />
    )
    expect(screen.getByText("Scout Universe")).toBeInTheDocument()
    expect(screen.getByText("1,520")).toBeInTheDocument()
    expect(screen.getByText("Scout Passed")).toBeInTheDocument()
    expect(screen.getByText("45")).toBeInTheDocument()
    expect(screen.getByText("Guardian Approved")).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("Guardian Modified")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("Guardian Rejected")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
    expect(screen.getByText("Michael Traded")).toBeInTheDocument()
    expect(screen.getByText("8")).toBeInTheDocument()
  })

  it("renders each bar as a button with aria-label", () => {
    render(
      <FunnelChart
        stages={mockStages}
        selectedStage={null}
        onStageClick={() => {}}
      />
    )
    expect(
      screen.getByRole("button", { name: "Scout Universe: 1520" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Michael Traded: 8" })
    ).toBeInTheDocument()
  })

  it("calls onStageClick when a bar is clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <FunnelChart
        stages={mockStages}
        selectedStage={null}
        onStageClick={onClick}
      />
    )
    await user.click(
      screen.getByRole("button", { name: "Guardian Rejected: 30" })
    )
    expect(onClick).toHaveBeenCalledWith("guardian_rejected")
  })

  it("highlights the selected stage with aria-pressed", () => {
    render(
      <FunnelChart
        stages={mockStages}
        selectedStage="scout_passed"
        onStageClick={() => {}}
      />
    )
    const selectedButton = screen.getByRole("button", {
      name: "Scout Passed: 45",
    })
    expect(selectedButton).toHaveAttribute("aria-pressed", "true")

    const otherButton = screen.getByRole("button", {
      name: "Scout Universe: 1520",
    })
    expect(otherButton).toHaveAttribute("aria-pressed", "false")
  })

  it("renders the funnel group with role and aria-label", () => {
    render(
      <FunnelChart
        stages={mockStages}
        selectedStage={null}
        onStageClick={() => {}}
      />
    )
    expect(
      screen.getByRole("group", { name: "Funnel stages" })
    ).toBeInTheDocument()
  })

  it("handles zero counts without crashing", () => {
    const zeroStages: FunnelStages = {
      scout_universe: 0,
      scout_passed: 0,
      guardian_approved: 0,
      guardian_modified: 0,
      guardian_rejected: 0,
      michael_traded: 0,
    }
    render(
      <FunnelChart
        stages={zeroStages}
        selectedStage={null}
        onStageClick={() => {}}
      />
    )
    expect(screen.getByText("Scout Universe")).toBeInTheDocument()
    expect(screen.getAllByText("0")).toHaveLength(6)
  })
})
