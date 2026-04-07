import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { DecisionsResponse } from "@/types/decisions"

// Mock TanStack Router
const mockNavigate = vi.fn()
const mockUseSearch = vi.fn().mockReturnValue({ ticker: "" })
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => {
    return (_opts: Record<string, unknown>) => {
      const route = {} as Record<string, unknown>
      route.useSearch = () => mockUseSearch()
      route.useNavigate = () => mockNavigate
      return route
    }
  },
}))

// Mock the useDecisions hook
const mockUseDecisions = vi.fn()
vi.mock("@/api/useDecisions", () => ({
  useDecisions: (...args: unknown[]) => mockUseDecisions(...args),
}))

import { DecisionsPageComponent } from "./decisions"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const MOCK_DATA: DecisionsResponse = {
  message: null,
  decisions: [
    {
      scan_date: "2026-04-04",
      ticker: "AAPL",
      decision: "approve",
      conviction: "high",
      thesis_full_text: "Strong earnings momentum with expanding services segment driving margin improvement.",
      primary_catalyst: "Q2 earnings beat",
      invalidation_trigger: "Services growth stalls below 15%",
      decision_tier: "tier-1",
      fundamental_score: 8,
      roic_at_scan: 45.2,
      prev_roic: 42.1,
      roic_delta: 3.1,
      rsi: 55.3,
      pe_at_scan: 28.5,
      median_pe: 30.2,
      pe_discount_pct: -5.6,
      relative_strength: 1.15,
      valuation_verdict: "fair",
    },
    {
      scan_date: "2026-04-03",
      ticker: "MSFT",
      decision: "reject",
      conviction: "low",
      thesis_full_text: "Cloud growth decelerating amid competitive pressure.",
      primary_catalyst: null,
      invalidation_trigger: null,
      decision_tier: "tier-2",
      fundamental_score: 5,
      roic_at_scan: 30.1,
      prev_roic: 31.5,
      roic_delta: -1.4,
      rsi: 68.0,
      pe_at_scan: 35.2,
      median_pe: 32.0,
      pe_discount_pct: 10.0,
      relative_strength: 0.95,
      valuation_verdict: "expensive",
    },
  ],
  decisions_error: null,
  predictions: [
    {
      ticker: "AAPL",
      scan_date: "2026-04-04",
      predicted_outcome: "up",
      probability: 0.72,
      actual_outcome: "up",
      resolved: 1,
      brier_score: 0.18,
    },
    {
      ticker: "AAPL",
      scan_date: "2026-04-04",
      predicted_outcome: "up",
      probability: 0.65,
      actual_outcome: null,
      resolved: 0,
      brier_score: null,
    },
  ],
  predictions_error: null,
  counterfactuals: {
    top_misses: [
      {
        ticker: "NVDA",
        scan_date: "2026-03-15",
        rejection_gate: "fundamental_gate",
        rejection_reason: "F-Score below threshold",
        forward_return_pct: 25.5,
      },
    ],
    top_good_rejections: [
      {
        ticker: "COIN",
        scan_date: "2026-03-20",
        rejection_gate: "valuation_gate",
        rejection_reason: "P/E exceeds 3x median",
        forward_return_pct: -12.3,
      },
    ],
  },
  counterfactuals_error: null,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDecisionsPage(hookReturn: any) {
  mockUseDecisions.mockReturnValue(hookReturn)
  return render(<DecisionsPageComponent />, { wrapper: createWrapper() })
}

const defaultHookReturn = {
  data: MOCK_DATA,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
}

describe("DecisionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearch.mockReturnValue({ ticker: "" })
  })

  it("renders loading skeletons when loading", () => {
    renderDecisionsPage({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    expect(screen.queryByText("Decisions")).not.toBeInTheDocument()
  })

  it("renders error card on fetch failure", () => {
    renderDecisionsPage({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Network error"),
      refetch: vi.fn(),
    })

    expect(screen.getByText("Network error")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument()
  })

  // --- Story 6.2: Reasoning Log ---

  it("renders decisions table with ticker, date, tier, and conviction", () => {
    renderDecisionsPage(defaultHookReturn)

    expect(screen.getByText("Decisions")).toBeInTheDocument()
    const section = screen.getByLabelText("Recent Decisions")
    expect(section).toBeInTheDocument()

    // Check table headers within the decisions section
    expect(within(section).getByText("Tier")).toBeInTheDocument()
    expect(within(section).getByText("Conviction")).toBeInTheDocument()

    // Check data (desktop + mobile views both render in jsdom)
    expect(within(section).getAllByText("AAPL").length).toBeGreaterThanOrEqual(1)
    expect(within(section).getAllByText("MSFT").length).toBeGreaterThanOrEqual(1)
    expect(within(section).getAllByText("tier-1").length).toBeGreaterThanOrEqual(1)
  })

  it("renders decision badge with approve/reject colors", () => {
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    // Desktop + mobile both render, use getAllByText and check first match
    const approveEls = within(section).getAllByText("approve")
    expect(approveEls[0].className).toContain("text-success")

    const rejectEls = within(section).getAllByText("reject")
    expect(rejectEls[0].className).toContain("text-destructive")
  })

  it("expands decision row to show detail panel", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    // Thesis detail should not be fully visible initially
    expect(screen.queryByText("Primary Catalyst")).not.toBeInTheDocument()

    // Click the AAPL row to expand it (desktop table in the decisions section)
    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    // Should now show full thesis, catalyst, scoring inputs (desktop + mobile both expand)
    expect(screen.getAllByText("Primary Catalyst").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Q2 earnings beat").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Invalidation Trigger").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Scoring Inputs").length).toBeGreaterThanOrEqual(1)
  })

  it("shows scoring inputs in expanded detail", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("F-Score").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("8").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("RSI").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("55.3").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Valuation").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("fair").length).toBeGreaterThanOrEqual(1)
  })

  it("shows prediction log in expanded detail", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Prediction Log").length).toBeGreaterThanOrEqual(1)
    // Prediction for AAPL — "up" appears multiple times (predicted + actual columns + dual view)
    expect(screen.getAllByText("up").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("72%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("0.180").length).toBeGreaterThanOrEqual(1)
  })

  it("renders ticker search input", () => {
    renderDecisionsPage(defaultHookReturn)

    expect(screen.getByLabelText("Filter by ticker")).toBeInTheDocument()
  })

  it("passes ticker to useDecisions when search param is set", () => {
    mockUseSearch.mockReturnValue({ ticker: "AAPL" })
    renderDecisionsPage(defaultHookReturn)

    expect(mockUseDecisions).toHaveBeenCalledWith("AAPL")
  })

  it("renders decisions empty state when no data", () => {
    renderDecisionsPage({
      ...defaultHookReturn,
      data: { ...MOCK_DATA, decisions: [], decisions_error: null, counterfactuals: { top_misses: [], top_good_rejections: [] } },
    })

    expect(screen.getByText("No decisions available")).toBeInTheDocument()
  })

  it("renders decisions error inline", () => {
    renderDecisionsPage({
      ...defaultHookReturn,
      data: { ...MOCK_DATA, decisions: null, decisions_error: "DB connection failed" },
    })

    expect(screen.getByText("DB connection failed")).toBeInTheDocument()
  })

  it("sorts decisions table by column when header clicked", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const rows = within(table).getAllByRole("row")
    // Default sort by scan_date desc: 2026-04-04 (AAPL) should be first
    expect(within(rows[1]).getByText("AAPL")).toBeInTheDocument()

    // Click Ticker header to sort by ticker (first "Ticker" in this section's table)
    const tickerHeader = within(table).getByText("Ticker")
    await user.click(tickerHeader)

    const rowsAfterSort = within(table).getAllByRole("row")
    // Desc sort on ticker: MSFT first
    expect(within(rowsAfterSort[1]).getByText("MSFT")).toBeInTheDocument()
  })

  // --- Story 6.3: Counterfactual Analysis ---

  it("renders counterfactual section with top misses and good rejections", () => {
    renderDecisionsPage(defaultHookReturn)

    expect(screen.getByLabelText("Counterfactual Analysis")).toBeInTheDocument()
    expect(screen.getByText("Top Misses (T+20 > 10%)")).toBeInTheDocument()
    expect(screen.getByText("Good Rejections (T+20 < 0%)")).toBeInTheDocument()

    // Check data (appears in both desktop table + mobile cards in jsdom)
    expect(screen.getAllByText("NVDA").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("+25.50%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("COIN").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("-12.30%").length).toBeGreaterThanOrEqual(1)
  })

  it("renders gate accuracy metrics", () => {
    renderDecisionsPage(defaultHookReturn)

    // Gate names appear in both accuracy cards and table rows (desktop + mobile)
    expect(screen.getAllByText("fundamental_gate").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("valuation_gate").length).toBeGreaterThanOrEqual(1)
  })

  it("renders counterfactual error inline", () => {
    renderDecisionsPage({
      ...defaultHookReturn,
      data: { ...MOCK_DATA, counterfactuals: null, counterfactuals_error: "Rejection log missing" },
    })

    expect(screen.getByText("Rejection log missing")).toBeInTheDocument()
  })

  it("renders predictions error independently", () => {
    renderDecisionsPage({
      ...defaultHookReturn,
      data: {
        ...MOCK_DATA,
        predictions: null,
        predictions_error: "Supervisor DB unavailable",
      },
    })

    // Decisions table should still render
    const section = screen.getByLabelText("Recent Decisions")
    expect(section).toBeInTheDocument()
    expect(within(section).getAllByText("AAPL").length).toBeGreaterThanOrEqual(1)
    // Predictions error shown
    expect(screen.getByText("Supervisor DB unavailable")).toBeInTheDocument()
  })
})
