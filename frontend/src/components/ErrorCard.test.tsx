import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ErrorCard } from "./ErrorCard"

describe("ErrorCard", () => {
  it("renders error message", () => {
    render(<ErrorCard error="Something went wrong" />)
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
  })

  it("renders retry button when onRetry provided", () => {
    render(<ErrorCard error="Failed" onRetry={() => {}} />)
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  it("does not render retry button when onRetry omitted", () => {
    render(<ErrorCard error="Failed" />)
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument()
  })

  it("calls onRetry when retry button is clicked", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ErrorCard error="Failed" onRetry={onRetry} />)
    await user.click(screen.getByRole("button", { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
