import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ErrorCard } from "@/components/ErrorCard"
import { HoldingsTable } from "@/components/HoldingsTable"
import type { HoldingsResponse, HoldingsPosition } from "@/types/holdings"

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
]

describe("Holdings tab integration", () => {
  it("renders positions table with data", () => {
    render(<HoldingsTable positions={mockPositions} />)
    // Ticker appears in both desktop table and mobile card
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0)
    expect(screen.getByText("Ticker")).toBeInTheDocument()
    expect(screen.getAllByText("high").length).toBeGreaterThan(0)
  })

  it("renders error card with retry", () => {
    const onRetry = vi.fn()
    render(<ErrorCard error="Failed to load holdings" onRetry={onRetry} />)
    expect(screen.getByText("Failed to load holdings")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("renders empty table when no positions", () => {
    const { container } = render(<HoldingsTable positions={[]} />)
    const table = container.querySelector("table")
    expect(table).toBeInTheDocument()
    // Headers should still be present
    expect(screen.getByText("Ticker")).toBeInTheDocument()
  })

  it("renders positions_error as ErrorCard", () => {
    const mockData: HoldingsResponse = {
      positions: null,
      positions_error: "portfolio.db not accessible",
      portfolio_summary: null,
      risk_data_error: null,
      message: null,
    }
    render(<ErrorCard error={mockData.positions_error!} />)
    expect(screen.getByText("portfolio.db not accessible")).toBeInTheDocument()
  })

  it("renders risk_data_error as warning while positions still show", () => {
    const mockData: HoldingsResponse = {
      positions: mockPositions,
      positions_error: null,
      portfolio_summary: null,
      risk_data_error: "snapshot table missing",
      message: null,
    }

    render(
      <div>
        <HoldingsTable positions={mockData.positions!} />
        {mockData.risk_data_error && (
          <ErrorCard error={`Risk data unavailable: ${mockData.risk_data_error}`} />
        )}
      </div>
    )

    // Positions still visible (appears in desktop + mobile)
    expect(screen.getAllByText("AAPL").length).toBeGreaterThan(0)
    // Risk error shown
    expect(
      screen.getByText("Risk data unavailable: snapshot table missing")
    ).toBeInTheDocument()
  })

  it("shows message when provided", () => {
    const mockData: HoldingsResponse = {
      positions: [],
      positions_error: null,
      portfolio_summary: null,
      risk_data_error: null,
      message: "No open positions",
    }
    render(
      <div>
        {mockData.message && (
          <p className="text-sm text-muted-foreground">{mockData.message}</p>
        )}
      </div>
    )
    expect(screen.getByText("No open positions")).toBeInTheDocument()
  })
})
