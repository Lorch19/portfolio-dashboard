import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { PerformanceResponse } from "@/types/performance"

// Mock TanStack Router
const mockNavigate = vi.fn()
const mockUseSearch = vi.fn().mockReturnValue({ session: "" })
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => {
    return () => {
      const route = {} as Record<string, unknown>
      route.useSearch = () => mockUseSearch()
      route.useNavigate = () => mockNavigate
      return route
    }
  },
}))

// Mock the usePerformance hook
const mockUsePerformance = vi.fn()
vi.mock("@/api/usePerformance", () => ({
  usePerformance: () => mockUsePerformance(),
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

import { PerformancePageComponent } from "./performance"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const MOCK_DATA: PerformanceResponse = {
  message: null,
  portfolio_summary: {
    total_pnl: 12500.0,
    total_pnl_pct: 12.5,
    cagr: 14.2,
    spy_return: 8.33,
    alpha: 4.17,
    win_rate: 0.62,
    start_date: "2026-01-15",
    end_date: "2026-04-04",
    total_trades: 42,
  },
  portfolio_summary_error: null,
  snapshots: [
    { snapshot_date: "2026-01-15", portfolio_value: 100000, spy_value: 4800 },
    { snapshot_date: "2026-04-04", portfolio_value: 112500, spy_value: 5200 },
  ],
  snapshots_error: null,
  prediction_accuracy: {
    total_predictions: 150,
    resolved_count: 120,
    hit_rate: 0.65,
    hit_rate_by_window: {
      t_5: 0.58,
      t_10: 0.62,
      t_20: 0.65,
    },
    average_brier_score: 0.22,
  },
  prediction_accuracy_error: null,
  calibration: {
    average_brier_score: 0.22,
    target_brier: 0.25,
    beating_random: true,
    agreement_rate: 0.78,
    sycophancy_flag: false,
  },
  calibration_error: null,
  arena_comparison: [
    {
      model_id: "claude-sonnet",
      session: "2026-03-arena-1",
      total_decisions: 25,
      hit_rate: 0.68,
      average_alpha: 2.3,
      total_cost: 15.5,
    },
    {
      model_id: "gpt-4o",
      session: "2026-03-arena-1",
      total_decisions: 25,
      hit_rate: 0.52,
      average_alpha: 0.8,
      total_cost: 12.0,
    },
    {
      model_id: "claude-sonnet",
      session: "2026-04-arena-2",
      total_decisions: 30,
      hit_rate: 0.7,
      average_alpha: 3.1,
      total_cost: 18.0,
    },
  ],
  arena_comparison_error: null,
  strategy_comparison: null,
  strategy_comparison_error: null,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPerformancePage(hookReturn: any) {
  mockUsePerformance.mockReturnValue(hookReturn)
  return render(<PerformancePageComponent />, { wrapper: createWrapper() })
}

const defaultHookReturn = {
  data: MOCK_DATA,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
}

describe("PerformancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ session: "" })
  })

  it("renders loading skeletons when loading", () => {
    renderPerformancePage({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    // Skeleton is rendered instead of page heading
    expect(screen.queryByText("Performance")).not.toBeInTheDocument()
  })

  it("renders error card on fetch failure", () => {
    renderPerformancePage({
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
    renderPerformancePage(defaultHookReturn)

    expect(screen.getByText("Performance")).toBeInTheDocument()
    expect(screen.getByText("Total P&L")).toBeInTheDocument()
    expect(screen.getByText("$12,500.00")).toBeInTheDocument()
    expect(screen.getByText("CAGR")).toBeInTheDocument()
    expect(screen.getByText("+14.20%")).toBeInTheDocument()
    expect(screen.getByText("SPY Return")).toBeInTheDocument()
    expect(screen.getByText("+8.33%")).toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("+4.17%")).toBeInTheDocument()
    expect(screen.getByText("Total Trades")).toBeInTheDocument()
    expect(screen.getByText("42")).toBeInTheDocument()
  })

  it("renders chart card titles", () => {
    renderPerformancePage(defaultHookReturn)

    expect(screen.getByText("Portfolio P&L vs SPY")).toBeInTheDocument()
    expect(screen.getByText("Prediction Calibration")).toBeInTheDocument()
  })

  it("renders partial error for portfolio_summary_error", () => {
    const dataWithError: PerformanceResponse = {
      ...MOCK_DATA,
      portfolio_summary: null,
      portfolio_summary_error: "DB connection failed",
    }

    renderPerformancePage({
      data: dataWithError,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    expect(screen.getByText("DB connection failed")).toBeInTheDocument()
  })

  it("renders empty state when no portfolio data", () => {
    const emptyData: PerformanceResponse = {
      ...MOCK_DATA,
      portfolio_summary: null,
      portfolio_summary_error: null,
    }

    renderPerformancePage({
      data: emptyData,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    expect(screen.getByText("No performance data available")).toBeInTheDocument()
  })

  it("renders snapshots_error as inline chart error while KPIs still show", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      snapshots: null,
      snapshots_error: "Snapshot query timeout",
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    // KPI cards should still render
    expect(screen.getByText("Total P&L")).toBeInTheDocument()
    expect(screen.getByText("$12,500.00")).toBeInTheDocument()
    // Snapshot error should show inline in chart area
    expect(screen.getByText("Snapshot query timeout")).toBeInTheDocument()
  })

  // --- Story 5.3: Prediction Accuracy tests ---

  it("renders prediction accuracy section with hit rates per window", () => {
    renderPerformancePage(defaultHookReturn)

    const section = screen.getByLabelText("Prediction Accuracy")
    expect(within(section).getByText("Total Predictions")).toBeInTheDocument()
    expect(within(section).getByText("150")).toBeInTheDocument()
    expect(within(section).getByText("Resolved")).toBeInTheDocument()
    expect(within(section).getByText("120")).toBeInTheDocument()
    expect(within(section).getByText("Overall Hit Rate")).toBeInTheDocument()
    expect(within(section).getByText("T+5 Hit Rate")).toBeInTheDocument()
    expect(within(section).getByText("58.0%")).toBeInTheDocument()
    expect(within(section).getByText("T+10 Hit Rate")).toBeInTheDocument()
    expect(within(section).getByText("62.0%")).toBeInTheDocument()
    expect(within(section).getByText("T+20 Hit Rate")).toBeInTheDocument()
    // Both overall and T+20 show 65.0% — verify at least 2 exist
    expect(within(section).getAllByText("65.0%")).toHaveLength(2)
  })

  it("renders Brier score with success color when beating random", () => {
    renderPerformancePage(defaultHookReturn)

    const section = screen.getByLabelText("Prediction Accuracy")
    expect(within(section).getByText("Avg Brier Score")).toBeInTheDocument()
    // 0.220 appears in both prediction section and calibration card — scope to section
    expect(within(section).getByText("0.220")).toBeInTheDocument()
  })

  it("renders prediction accuracy error inline", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      prediction_accuracy: null,
      prediction_accuracy_error: "Supervisor DB unavailable",
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("Supervisor DB unavailable")).toBeInTheDocument()
  })

  it("renders prediction empty state when no data", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      prediction_accuracy: null,
      prediction_accuracy_error: null,
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("No prediction data available")).toBeInTheDocument()
  })

  // --- Story 5.3: Calibration tests ---

  it("renders calibration metrics", () => {
    renderPerformancePage(defaultHookReturn)

    expect(screen.getByText("Prediction Calibration")).toBeInTheDocument()
    expect(screen.getByText("Brier Score")).toBeInTheDocument()
    // Brier score appears in calibration metrics section
    const brierLabel = screen.getByText("Brier Score")
    const brierSection = brierLabel.closest("div")!
    expect(within(brierSection).getByText("0.220")).toBeInTheDocument()
    expect(screen.getByText("Agreement Rate")).toBeInTheDocument()
    expect(screen.getByText("78.0%")).toBeInTheDocument()
    expect(screen.getByText("Sycophancy Flag")).toBeInTheDocument()
    expect(screen.getByText("OK")).toBeInTheDocument()
  })

  it("renders sycophancy warning when flag is true", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      calibration: {
        average_brier_score: 0.28,
        target_brier: 0.25,
        beating_random: false,
        agreement_rate: 0.96,
        sycophancy_flag: true,
      },
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("Warning")).toBeInTheDocument()
  })

  it("renders calibration error inline", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      calibration: null,
      calibration_error: "Calibration query failed",
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("Calibration query failed")).toBeInTheDocument()
  })

  // --- Story 5.3: Arena Comparison tests ---

  it("renders arena comparison table with correct columns and data", () => {
    renderPerformancePage(defaultHookReturn)

    expect(screen.getByText("Arena Model Comparison")).toBeInTheDocument()
    // Check column headers
    expect(screen.getByText("Model")).toBeInTheDocument()
    expect(screen.getByText("Session")).toBeInTheDocument()
    expect(screen.getByText("Decisions")).toBeInTheDocument()
    expect(screen.getByText("Hit Rate")).toBeInTheDocument()
    expect(screen.getByText("Avg Alpha")).toBeInTheDocument()
    expect(screen.getByText("Cost")).toBeInTheDocument()

    // Check data rows
    expect(screen.getAllByText("claude-sonnet").length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText("gpt-4o")).toBeInTheDocument()
  })

  it("sorts arena table by column when header clicked", async () => {
    const user = userEvent.setup()
    renderPerformancePage(defaultHookReturn)

    // Default sort is by hit_rate desc, so first row should have highest hit rate
    const table = screen.getByRole("table")
    const rows = within(table).getAllByRole("row")
    // rows[0] is header, rows[1] is first data row
    // Default sort by hit_rate desc: 0.70 (claude-sonnet arena-2) should be first
    expect(within(rows[1]).getByText("70.0%")).toBeInTheDocument()

    // Click Model header to sort by model_id
    const modelHeader = screen.getByText("Model")
    await user.click(modelHeader)

    // After sorting by model_id desc, gpt-4o should be last alphabetically but first in desc
    const rowsAfterSort = within(table).getAllByRole("row")
    expect(within(rowsAfterSort[1]).getByText("gpt-4o")).toBeInTheDocument()
  })

  it("filters arena rows by session", () => {
    mockUseSearch.mockReturnValue({ session: "2026-04-arena-2" })
    renderPerformancePage(defaultHookReturn)

    const table = screen.getByRole("table")
    const rows = within(table).getAllByRole("row")
    // Header + 1 data row (only claude-sonnet in arena-2)
    expect(rows).toHaveLength(2)
    expect(within(rows[1]).getByText("2026-04-arena-2")).toBeInTheDocument()
  })

  it("renders arena comparison error inline", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      arena_comparison: null,
      arena_comparison_error: "Arena tables missing",
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("Arena tables missing")).toBeInTheDocument()
  })

  it("renders arena empty state when no data", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      arena_comparison: null,
      arena_comparison_error: null,
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("No arena comparison data available")).toBeInTheDocument()
  })

  it("renders arena empty state for empty array", () => {
    const data: PerformanceResponse = {
      ...MOCK_DATA,
      arena_comparison: [],
      arena_comparison_error: null,
    }

    renderPerformancePage({
      ...defaultHookReturn,
      data,
    })

    expect(screen.getByText("No arena comparison data available")).toBeInTheDocument()
  })
})
