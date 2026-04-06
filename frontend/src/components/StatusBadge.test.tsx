import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBadge } from "./StatusBadge"

describe("StatusBadge", () => {
  it("renders healthy status with green dot", () => {
    const { container } = render(<StatusBadge status="healthy" />)
    const dot = container.querySelector(".bg-success")
    expect(dot).toBeInTheDocument()
    expect(screen.getByText("healthy")).toBeInTheDocument()
  })

  it("renders degraded status with warning dot", () => {
    const { container } = render(<StatusBadge status="degraded" />)
    const dot = container.querySelector(".bg-warning")
    expect(dot).toBeInTheDocument()
    expect(screen.getByText("degraded")).toBeInTheDocument()
  })

  it("renders down status with destructive dot", () => {
    const { container } = render(<StatusBadge status="down" />)
    const dot = container.querySelector(".bg-destructive")
    expect(dot).toBeInTheDocument()
    expect(screen.getByText("down")).toBeInTheDocument()
  })

  it("renders null status as unknown", () => {
    const { container } = render(<StatusBadge status={null} />)
    const dot = container.querySelector(".bg-muted-foreground")
    expect(dot).toBeInTheDocument()
    expect(screen.getByText("unknown")).toBeInTheDocument()
  })

  it("renders compact variant (dot only, no label)", () => {
    const { container } = render(
      <StatusBadge status="healthy" variant="compact" />
    )
    const dot = container.querySelector(".bg-success")
    expect(dot).toBeInTheDocument()
    expect(screen.queryByText("healthy")).not.toBeInTheDocument()
  })
})
