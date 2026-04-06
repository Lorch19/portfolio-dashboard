import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { HoldingsTable } from "./HoldingsTable"
import type { HoldingsPosition } from "@/types/holdings"

const mockPositions: HoldingsPosition[] = [
  {
    ticker: "AAPL",
    sector: "Technology",
    entry_price: 175.5,
    entry_date: "2026-03-15",
    current_price: 185.5,
    shares: 10,
    unrealized_pnl: 100.0,
    unrealized_pnl_pct: 5.7,
    sleeve: 1,
    stop_loss: 165.0,
    target_1: 195.0,
    target_2: 210.0,
    conviction: "high",
    days_held: 21,
    current_stop_level: 170.0,
    exit_stage: "breakeven",
    portfolio_heat_contribution: 0.12,
    sector_concentration_status: "ok",
  },
  {
    ticker: "MSFT",
    sector: "Technology",
    entry_price: 420.0,
    entry_date: "2026-03-10",
    current_price: 405.0,
    shares: 5,
    unrealized_pnl: -75.0,
    unrealized_pnl_pct: -3.57,
    sleeve: 2,
    stop_loss: 390.0,
    target_1: 450.0,
    target_2: null,
    conviction: "medium",
    days_held: 26,
    current_stop_level: 395.0,
    exit_stage: "initial",
    portfolio_heat_contribution: 0.25,
    sector_concentration_status: "warning",
  },
  {
    ticker: "GOOG",
    sector: "Technology",
    entry_price: 150.0,
    entry_date: "2026-04-01",
    current_price: 150.0,
    shares: 20,
    unrealized_pnl: 0,
    unrealized_pnl_pct: 0,
    sleeve: 1,
    stop_loss: 140.0,
    target_1: 170.0,
    target_2: 180.0,
    conviction: "low",
    days_held: 5,
    current_stop_level: null,
    exit_stage: null,
    portfolio_heat_contribution: null,
    sector_concentration_status: null,
  },
]

describe("HoldingsTable", () => {
  it("renders all required column headers", () => {
    render(<HoldingsTable positions={mockPositions} />)
    expect(screen.getByText("Ticker")).toBeInTheDocument()
    expect(screen.getByText("Sleeve")).toBeInTheDocument()
    expect(screen.getByText("Entry")).toBeInTheDocument()
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(screen.getByText("P&L ($)")).toBeInTheDocument()
    expect(screen.getByText("P&L (%)")).toBeInTheDocument()
    expect(screen.getByText("Days")).toBeInTheDocument()
    expect(screen.getByText("Conviction")).toBeInTheDocument()
    expect(screen.getByText("Exit Stage")).toBeInTheDocument()
    expect(screen.getByText("Stop Loss")).toBeInTheDocument()
    expect(screen.getByText("Risk")).toBeInTheDocument()
  })

  it("renders all position tickers", () => {
    render(<HoldingsTable positions={mockPositions} />)
    // Each ticker appears twice: desktop table + mobile card
    expect(screen.getAllByText("AAPL")).toHaveLength(2)
    expect(screen.getAllByText("MSFT")).toHaveLength(2)
    expect(screen.getAllByText("GOOG")).toHaveLength(2)
  })

  it("renders sleeve badges", () => {
    render(<HoldingsTable positions={mockPositions} />)
    const badges = screen.getAllByText(/Sleeve \d/)
    expect(badges.length).toBeGreaterThanOrEqual(3)
  })

  it("sorts ascending then descending on column header click", async () => {
    const user = userEvent.setup()
    render(<HoldingsTable positions={mockPositions} />)

    const daysHeader = screen.getByText("Days")
    await user.click(daysHeader)

    // After first click on "Days" (asc), rows should be sorted by days_held ascending
    const table = screen.getByRole("table")
    const rows = within(table).getAllByRole("row")
    // First row is header, data rows start at index 1
    const firstDataRow = rows[1]
    expect(within(firstDataRow).getByText("GOOG")).toBeInTheDocument() // 5 days

    // Click again for descending
    await user.click(daysHeader)
    const rowsDesc = within(table).getAllByRole("row")
    const firstDataRowDesc = rowsDesc[1]
    expect(within(firstDataRowDesc).getByText("MSFT")).toBeInTheDocument() // 26 days
  })

  it("shows green arrow for positive P&L", () => {
    const { container } = render(<HoldingsTable positions={mockPositions} />)
    // Find the AAPL row's P&L cell — it should have text-success class
    const successCells = container.querySelectorAll(".text-success")
    expect(successCells.length).toBeGreaterThan(0)
  })

  it("shows red arrow for negative P&L", () => {
    const { container } = render(<HoldingsTable positions={mockPositions} />)
    const destructiveCells = container.querySelectorAll(".text-destructive")
    expect(destructiveCells.length).toBeGreaterThan(0)
  })

  it("shows muted dash for zero P&L", () => {
    const { container } = render(<HoldingsTable positions={mockPositions} />)
    // GOOG has 0 P&L — should show muted-foreground style
    const mutedCells = container.querySelectorAll(".text-muted-foreground")
    expect(mutedCells.length).toBeGreaterThan(0)
  })

  it("renders risk badges - high heat for MSFT", () => {
    render(<HoldingsTable positions={mockPositions} />)
    expect(screen.getByText("High Heat")).toBeInTheDocument()
    expect(screen.getByText("Sector Warning")).toBeInTheDocument()
  })

  it("renders OK risk badge for AAPL", () => {
    render(<HoldingsTable positions={mockPositions} />)
    expect(screen.getByText("OK")).toBeInTheDocument()
  })

  it("renders mobile card layout with hidden md class", () => {
    const { container } = render(<HoldingsTable positions={mockPositions} />)
    // Mobile view container has md:hidden
    const mobileView = container.querySelector(".md\\:hidden")
    expect(mobileView).toBeInTheDocument()
  })

  it("mobile card expands on click", async () => {
    const user = userEvent.setup()
    const { container } = render(<HoldingsTable positions={mockPositions} />)

    // Find the mobile card container
    const mobileView = container.querySelector(".md\\:hidden")!
    const cards = mobileView.querySelectorAll("[role='button']")
    expect(cards.length).toBe(3)

    // Click first card to expand
    await user.click(cards[0])
    // After expansion, should see detail fields
    expect(screen.getAllByText("Entry Price").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Current Price").length).toBeGreaterThan(0)
  })

  it("handles empty positions array", () => {
    const { container } = render(<HoldingsTable positions={[]} />)
    const table = container.querySelector("table")
    // Table exists but tbody should be empty
    expect(table).toBeInTheDocument()
    const tbody = table!.querySelector("tbody")
    expect(tbody!.children.length).toBe(0)
  })

  it("column headers have aria-sort attribute", () => {
    render(<HoldingsTable positions={mockPositions} />)
    const tickerHeader = screen.getByText("Ticker").closest("th")
    // Default sort is by ticker asc
    expect(tickerHeader).toHaveAttribute("aria-sort", "ascending")
  })
})
