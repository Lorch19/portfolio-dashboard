import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { KpiCard, KpiCardSkeleton } from "./KpiCard"

describe("KpiCard", () => {
  it("renders label and value", () => {
    render(<KpiCard label="CPU" value="12.5%" />)
    expect(screen.getByText("CPU")).toBeInTheDocument()
    expect(screen.getByText("12.5%")).toBeInTheDocument()
  })

  it("renders with aria-label", () => {
    render(<KpiCard label="Memory" value="45.2%" />)
    expect(screen.getByLabelText("Memory: 45.2%")).toBeInTheDocument()
  })

  it("renders trend indicator when provided", () => {
    const { container } = render(
      <KpiCard label="CPU" value="85%" trend="negative" />
    )
    const icon = container.querySelector(".text-destructive")
    expect(icon).toBeInTheDocument()
  })

  it("renders positive trend with success color", () => {
    const { container } = render(
      <KpiCard label="CPU" value="10%" trend="positive" />
    )
    const icon = container.querySelector(".text-success")
    expect(icon).toBeInTheDocument()
  })

  it("renders subtext when provided", () => {
    render(<KpiCard label="Disk" value="62%" subtext="120GB free" />)
    expect(screen.getByText("120GB free")).toBeInTheDocument()
  })

  it("does not render trend or subtext when not provided", () => {
    const { container } = render(<KpiCard label="CPU" value="12%" />)
    expect(container.querySelector(".text-success")).not.toBeInTheDocument()
    expect(container.querySelector(".text-destructive")).not.toBeInTheDocument()
  })
})

describe("KpiCardSkeleton", () => {
  it("renders skeleton placeholders", () => {
    const { container } = render(<KpiCardSkeleton />)
    const skeletons = container.querySelectorAll("[data-slot='skeleton']")
    expect(skeletons.length).toBeGreaterThanOrEqual(2)
  })
})
