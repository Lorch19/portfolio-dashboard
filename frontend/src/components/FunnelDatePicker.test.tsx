import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FunnelDatePicker } from "./FunnelDatePicker"

describe("FunnelDatePicker", () => {
  it("renders date input with label", () => {
    render(<FunnelDatePicker value="2026-04-04" onChange={() => {}} />)
    expect(screen.getByLabelText("Scan Date")).toBeInTheDocument()
  })

  it("renders with the provided date value", () => {
    render(<FunnelDatePicker value="2026-04-04" onChange={() => {}} />)
    const input = screen.getByLabelText("Scan Date") as HTMLInputElement
    expect(input.value).toBe("2026-04-04")
  })

  it("calls onChange when date is changed", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FunnelDatePicker value="2026-04-04" onChange={onChange} />)
    const input = screen.getByLabelText("Scan Date")
    await user.clear(input)
    await user.type(input, "2026-04-05")
    expect(onChange).toHaveBeenCalled()
  })

  it("renders input with type date", () => {
    render(<FunnelDatePicker value="" onChange={() => {}} />)
    const input = screen.getByLabelText("Scan Date") as HTMLInputElement
    expect(input.type).toBe("date")
  })
})
