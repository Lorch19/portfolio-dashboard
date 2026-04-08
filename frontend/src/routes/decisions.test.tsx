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
    return () => {
      const route = {} as Record<string, unknown>
      route.useSearch = () => mockUseSearch()
      route.useNavigate = () => mockNavigate
      return route
    }
  },
}))

// Mock the useDecisions hooks
const mockUseDecisions = vi.fn()
const mockUseTickerDeepDive = vi.fn()
vi.mock("@/api/useDecisions", () => ({
  useDecisions: (...args: unknown[]) => mockUseDecisions(...args),
  useTickerDeepDive: (...args: unknown[]) => mockUseTickerDeepDive(...args),
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
      moat_thesis: "Ecosystem lock-in with 1.5B active devices",
      bear_case_text: "iPhone saturation risk in mature markets",
      pre_mortem_text: "Services growth stalls if App Store regulation tightens",
      challenge_gate_result: "passed",
      critique_quality_score: 7.5,
      critique_changed_decision: false,
      model_id: null,
      decided_by_model: "claude-sonnet-4",
      entry_price: 185.50,
      stop_loss: 175.00,
      target_1: 195.00,
      target_2: 210.00,
      pe_at_entry: 28.1,
      median_pe_at_entry: 32.5,
      roic_at_entry: 28.5,
      sleeve: "core",
      pnl_pct: 5.2,
      realized_rr: 1.8,
      max_favorable_excursion_pct: 8.1,
      days_held: 22,
      sp500_return_same_period: 2.1,
      exit_price: 195.14,
      exit_date: "2026-04-26",
      exit_trigger: "target_1_hit",
      exit_reason: "Price reached first target",
      fundamental_score: 8,
      roic_at_scan: 45.2,
      prev_roic: 42.1,
      roic_delta: 3.1,
      rsi: 55.3,
      pe_at_scan: 28.5,
      median_pe: 30.2,
      pe_discount_pct: -5.6,
      relative_strength: 1.15,
      valuation_verdict: "undervalued",
      technical_score: 8,
      michael_quality_score: 8.2,
      beneish_m_score: -2.1,
      altman_z_score: 4.5,
      roic_wacc_spread: null,
      valuation_fair_value: null,
      valuation_upside_pct: null,
      momentum_at_scan: 12.3,
      atr: null,
      volume_ratio: null,
      insider_signal: "buy",
      insider_net_value_usd: 2500000,
      insider_buy_cluster: true,
      sector: "Technology",
      regime_at_scan: null,
      price_at_scan: 185.50,
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
      moat_thesis: null,
      bear_case_text: null,
      pre_mortem_text: null,
      challenge_gate_result: null,
      critique_quality_score: null,
      critique_changed_decision: null,
      model_id: null,
      decided_by_model: null,
      entry_price: null,
      stop_loss: null,
      target_1: null,
      target_2: null,
      pe_at_entry: null,
      median_pe_at_entry: null,
      roic_at_entry: null,
      sleeve: null,
      pnl_pct: null,
      realized_rr: null,
      max_favorable_excursion_pct: null,
      days_held: null,
      sp500_return_same_period: null,
      exit_price: null,
      exit_date: null,
      exit_trigger: null,
      exit_reason: null,
      fundamental_score: 5,
      roic_at_scan: 30.1,
      prev_roic: 31.5,
      roic_delta: -1.4,
      rsi: 68.0,
      pe_at_scan: 35.2,
      median_pe: 32.0,
      pe_discount_pct: 10.0,
      relative_strength: 0.95,
      valuation_verdict: "overvalued",
      technical_score: null,
      michael_quality_score: null,
      beneish_m_score: null,
      altman_z_score: null,
      roic_wacc_spread: null,
      valuation_fair_value: null,
      valuation_upside_pct: null,
      momentum_at_scan: null,
      atr: null,
      volume_ratio: null,
      insider_signal: null,
      insider_net_value_usd: null,
      insider_buy_cluster: null,
      sector: null,
      regime_at_scan: null,
      price_at_scan: null,
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

  // --- Table rendering ---

  it("renders decisions table with ticker, date, and conviction", () => {
    renderDecisionsPage(defaultHookReturn)

    expect(screen.getByText("Decisions")).toBeInTheDocument()
    const section = screen.getByLabelText("Recent Decisions")
    expect(section).toBeInTheDocument()

    // Check table headers
    expect(within(section).getByText("Conv")).toBeInTheDocument()

    // Check data
    expect(within(section).getAllByText("AAPL").length).toBeGreaterThanOrEqual(1)
    expect(within(section).getAllByText("MSFT").length).toBeGreaterThanOrEqual(1)
  })

  it("renders decision badge with approve/reject colors", () => {
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const approveEls = within(section).getAllByText("approve")
    expect(approveEls[0].className).toContain("text-success")

    const rejectEls = within(section).getAllByText("reject")
    expect(rejectEls[0].className).toContain("text-destructive")
  })

  it("renders P&L and Alpha columns in table", () => {
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    expect(within(section).getByText("P&L")).toBeInTheDocument()
    expect(within(section).getByText("Alpha")).toBeInTheDocument()

    // AAPL has pnl_pct: 5.2
    expect(within(section).getAllByText("+5.20%").length).toBeGreaterThanOrEqual(1)
    // Alpha: 5.2 - 2.1 = 3.1
    expect(within(section).getAllByText("+3.10%").length).toBeGreaterThanOrEqual(1)
  })

  it("renders sleeve column", () => {
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    expect(within(section).getAllByText("core").length).toBeGreaterThanOrEqual(1)
  })

  // --- Expanded card sections ---

  it("expands decision row to show outcome section (closed position)", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    // Outcome section should appear (AAPL has pnl_pct)
    expect(screen.getAllByText("Outcome").length).toBeGreaterThanOrEqual(1)
    // Large P&L display in outcome section
    expect(screen.getAllByText("Risk:Reward").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("1.8x").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Days Held").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("22").length).toBeGreaterThanOrEqual(1)
  })

  it("shows thesis section with catalyst and invalidation", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Primary Catalyst").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Q2 earnings beat").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Invalidation Trigger").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Moat").length).toBeGreaterThanOrEqual(1)
  })

  it("shows scoring dashboard with F-Score, RSI, and valuation", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Scoring Dashboard").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("F-Score").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("8").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("RSI").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("55.3").length).toBeGreaterThanOrEqual(1)
  })

  it("shows bear case section when data exists", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Bear Case").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("iPhone saturation risk in mature markets").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Pre-Mortem").length).toBeGreaterThanOrEqual(1)
  })

  it("hides bear case section when all fields null", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    // Expand MSFT (has null bear_case_text)
    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const msftRow = within(table).getByText("MSFT").closest("tr")!
    await user.click(msftRow)

    // Bear Case should not appear for MSFT
    // MSFT's bear_case_text is null so BearCaseSection returns null
    // The section heading won't appear in MSFT's expanded panel
    const msftExpanded = msftRow.nextElementSibling
    if (msftExpanded) {
      expect(within(msftExpanded as HTMLElement).queryByText("Bear Case")).not.toBeInTheDocument()
    }
  })

  it("shows decision quality section with critique score", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Decision Quality").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("7.5/10").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("claude-sonnet-4").length).toBeGreaterThanOrEqual(1)
  })

  it("shows insider signals section when available", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Insider Signals").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("buy").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("$2,500,000").length).toBeGreaterThanOrEqual(1)
  })

  it("hides outcome section for open positions (pnl_pct null)", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const msftRow = within(table).getByText("MSFT").closest("tr")!
    await user.click(msftRow)

    const msftExpanded = msftRow.nextElementSibling
    if (msftExpanded) {
      expect(within(msftExpanded as HTMLElement).queryByText("Outcome")).not.toBeInTheDocument()
    }
  })

  it("shows prediction log in expanded detail", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    const aaplRow = within(table).getByText("AAPL").closest("tr")!
    await user.click(aaplRow)

    expect(screen.getAllByText("Prediction Log").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("up").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("72%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("0.180").length).toBeGreaterThanOrEqual(1)
  })

  it("renders ticker search input", () => {
    renderDecisionsPage(defaultHookReturn)

    expect(screen.getByLabelText("Filter by ticker")).toBeInTheDocument()
  })

  it("enters deep-dive mode when ticker search param is set", () => {
    mockUseSearch.mockReturnValue({ ticker: "AAPL" })
    mockUseTickerDeepDive.mockReturnValue({
      data: {
        decisions: [MOCK_DATA.decisions![0]],
        scoring_history: [],
        rejection_history: [],
        predictions: [],
        error: null,
        predictions_error: null,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    })

    renderDecisionsPage(defaultHookReturn)

    // Deep-dive mode: should show back button and ticker name
    expect(screen.getByText("All Decisions")).toBeInTheDocument()
    expect(screen.getByText("AAPL")).toBeInTheDocument()
    expect(screen.getByText("Decision Timeline")).toBeInTheDocument()
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

    // Click Ticker header to sort by ticker
    const tickerHeader = within(table).getByText("Ticker")
    await user.click(tickerHeader)

    const rowsAfterSort = within(table).getAllByRole("row")
    // Desc sort on ticker: MSFT first
    expect(within(rowsAfterSort[1]).getByText("MSFT")).toBeInTheDocument()
  })

  // --- Counterfactual Analysis ---

  it("renders counterfactual section with top misses and good rejections", () => {
    renderDecisionsPage(defaultHookReturn)

    expect(screen.getByLabelText("Counterfactual Analysis")).toBeInTheDocument()
    expect(screen.getByText("Top Misses (T+20 > 10%)")).toBeInTheDocument()
    expect(screen.getByText("Good Rejections (T+20 < 0%)")).toBeInTheDocument()

    expect(screen.getAllByText("NVDA").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("+25.50%").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("COIN").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("-12.30%").length).toBeGreaterThanOrEqual(1)
  })

  it("renders gate accuracy metrics", () => {
    renderDecisionsPage(defaultHookReturn)

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

    const section = screen.getByLabelText("Recent Decisions")
    expect(section).toBeInTheDocument()
    expect(within(section).getAllByText("AAPL").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Supervisor DB unavailable")).toBeInTheDocument()
  })

  // --- Ticker click navigation ---

  it("clicking ticker name navigates to deep-dive", async () => {
    const user = userEvent.setup()
    renderDecisionsPage(defaultHookReturn)

    const section = screen.getByLabelText("Recent Decisions")
    const table = within(section).getByRole("table")
    // Find the AAPL link button in the table
    const tickerButton = within(table).getAllByText("AAPL")[0]
    await user.click(tickerButton)

    expect(mockNavigate).toHaveBeenCalledWith({ search: { ticker: "AAPL" } })
  })
})
