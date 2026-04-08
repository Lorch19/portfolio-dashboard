import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { CostsResponse } from "@/types/costs"

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => {
    return () => ({})
  },
}))

// Mock the useCosts hook
const mockUseCosts = vi.fn()
vi.mock("@/api/useCosts", () => ({
  useCosts: () => mockUseCosts(),
}))

// Mock recharts ResponsiveContainer (no DOM sizing in jsdom)
vi.mock("recharts", async () => {
  const actual = await vi.importActual("recharts")
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  }
})

import { CostsPageComponent as CostsPage } from "./costs"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const MOCK_DATA: CostsResponse = {
  message: null,
  brokerage: {
    trades: [
      {
        ticker: "AAPL",
        trade_date: "2026-04-04",
        action: "buy",
        shares: 10,
        price: 185.5,
        estimated_cost: 1855.0,
      },
      {
        ticker: "NVDA",
        trade_date: "2026-04-04",
        action: "buy",
        shares: 5,
        price: 890.25,
        estimated_cost: 4451.25,
      },
    ],
    cumulative_trade_event_fees: 6306.25,
    cumulative_realized_fees: 7.75,
    cumulative_total: 6314.0,
  },
  brokerage_error: null,
  api_costs: {
    per_model: [
      { model_id: "claude-sonnet", total_decisions: 3, total_cost: 1.5 },
      { model_id: "gpt-4o", total_decisions: 2, total_cost: 1.6 },
    ],
    cumulative_total: 3.1,
  },
  api_costs_error: null,
  portfolio_return: {
    start_value: 100000,
    end_value: 112500,
    total_return: 12500.0,
    total_return_pct: 12.5,
    start_date: "2026-01-15",
    end_date: "2026-04-04",
    months_running: 2.6,
  },
  portfolio_return_error: null,
  vps_monthly_cost: 20.0,
  vps_cumulative: 52.0,
  total_system_cost: 6369.1,
  cost_per_trade: 3184.55,
  total_trades: 2,
  net_return_after_costs: 6130.9,
  cost_as_pct_of_returns: 50.95,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCostsPage(hookReturn: any) {
  mockUseCosts.mockReturnValue(hookReturn)
  return render(<CostsPage />, { wrapper: createWrapper() })
}

const defaultHookReturn = {
  data: MOCK_DATA,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
}

describe("CostsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders loading skeletons when loading", () => {
    renderCostsPage({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    expect(screen.queryByText("Costs")).not.toBeInTheDocument()
  })

  it("renders error card on fetch failure", () => {
    renderCostsPage({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
      refetch: vi.fn(),
    })

    expect(screen.getByText("Network error")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  it("renders KPI cards with correct values", () => {
    renderCostsPage(defaultHookReturn)

    expect(screen.getByText("Costs")).toBeInTheDocument()
    expect(screen.getByText("Total System Cost")).toBeInTheDocument()
    expect(screen.getByText("$6,369.10")).toBeInTheDocument()
    expect(screen.getByText("Cost per Trade")).toBeInTheDocument()
    expect(screen.getByText("$3,184.55")).toBeInTheDocument()
    expect(screen.getByText("Total Trades")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("Net Return After Costs")).toBeInTheDocument()
    expect(screen.getByText("$6,130.90")).toBeInTheDocument()
  })

  it("renders brokerage table with trades", () => {
    renderCostsPage(defaultHookReturn)

    const section = screen.getByLabelText("Brokerage Fees")
    expect(within(section).getByText("AAPL")).toBeInTheDocument()
    expect(within(section).getByText("NVDA")).toBeInTheDocument()
    expect(within(section).getAllByText("buy")).toHaveLength(2)
  })

  it("sorts brokerage table when header clicked", async () => {
    const user = userEvent.setup()
    renderCostsPage(defaultHookReturn)

    const section = screen.getByLabelText("Brokerage Fees")
    const table = within(section).getByRole("table")

    // Click Ticker header to sort by ticker
    const tickerHeader = within(table).getByText("Ticker")
    await user.click(tickerHeader)

    // After sort by ticker desc, NVDA should be first
    const rows = within(table).getAllByRole("row")
    expect(within(rows[1]).getByText("NVDA")).toBeInTheDocument()
  })

  it("renders API costs chart section", () => {
    renderCostsPage(defaultHookReturn)

    expect(screen.getByText("API Costs by Model")).toBeInTheDocument()
    expect(screen.getByText("Cumulative: $3.10")).toBeInTheDocument()
  })

  it("renders VPS cost card", () => {
    renderCostsPage(defaultHookReturn)

    expect(screen.getByText("VPS Cost")).toBeInTheDocument()
    expect(screen.getByText("$20.00")).toBeInTheDocument()
    expect(screen.getByText("$52.00")).toBeInTheDocument()
  })

  it("renders brokerage error inline", () => {
    const data: CostsResponse = {
      ...MOCK_DATA,
      brokerage: null,
      brokerage_error: "portfolio.db not accessible",
    }

    renderCostsPage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("portfolio.db not accessible")).toBeInTheDocument()
  })

  it("renders API costs error inline", () => {
    const data: CostsResponse = {
      ...MOCK_DATA,
      api_costs: null,
      api_costs_error: "supervisor DB unavailable",
    }

    renderCostsPage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("supervisor DB unavailable")).toBeInTheDocument()
  })

  it("renders empty state when no data", () => {
    renderCostsPage({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    expect(screen.getByText("No cost data available")).toBeInTheDocument()
  })

  it("renders brokerage empty state when no brokerage data", () => {
    const data: CostsResponse = {
      ...MOCK_DATA,
      brokerage: null,
      brokerage_error: null,
    }

    renderCostsPage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("No brokerage data available")).toBeInTheDocument()
  })
})
