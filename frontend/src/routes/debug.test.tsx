import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { DebugEventsResponse, DebugLogsResponse, DebugReplayResponse } from "@/types/debug"

// Mock TanStack Router
const mockNavigate = vi.fn()
const mockUseSearch = vi.fn().mockReturnValue({
  tab: "events",
  source: "",
  type: "",
  since: "",
  agent: "",
  date: "",
  severity: "",
})

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => {
    return (_opts: Record<string, unknown>) => {
      const route = {} as Record<string, unknown>
      route.useSearch = () => mockUseSearch()
      route.useNavigate = () => mockNavigate
      return route
    }
  },
  useNavigate: () => mockNavigate,
}))

// Mock hooks
const mockUseDebugEvents = vi.fn()
const mockUseDebugLogs = vi.fn()
const mockUseDebugReplay = vi.fn()
const mockUseReplayDates = vi.fn()
vi.mock("@/api/useDebug", () => ({
  useDebugEvents: (...args: unknown[]) => mockUseDebugEvents(...args),
  useDebugLogs: (...args: unknown[]) => mockUseDebugLogs(...args),
  useDebugReplay: (...args: unknown[]) => mockUseDebugReplay(...args),
  useReplayDates: () => mockUseReplayDates(),
}))

import { DebugPageComponent } from "./debug"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const MOCK_EVENTS: DebugEventsResponse = {
  events: [
    { id: 1, source: "Guardian", event_type: "alert", payload: '{"message": "High volatility"}', timestamp: "2026-04-04T06:00:00Z" },
    { id: 2, source: "shadow_observer", event_type: "sync_complete", payload: '{"tables_synced": 5}', timestamp: "2026-04-04T06:30:00Z" },
    { id: 3, source: "Scout", event_type: "info", payload: null, timestamp: "2026-04-04T05:30:00Z" },
  ],
  events_error: null,
}

const MOCK_LOGS: DebugLogsResponse = {
  logs: [
    { timestamp: "2026-04-04 06:02:00", agent: "Scout", severity: "ERROR", message: "Failed to fetch AAPL data", trace: "Traceback (most recent call last):\n  ConnectionError", source_file: "scout.log" },
    { timestamp: "2026-04-04 06:01:00", agent: "Scout", severity: "INFO", message: "Gate evaluation complete", trace: null, source_file: "scout.log" },
    { timestamp: "2026-04-04 06:00:00", agent: "Scout", severity: "WARNING", message: "Retrying AAPL fetch", trace: null, source_file: "scout.log" },
  ],
  logs_error: null,
  message: null,
}

const MOCK_REPLAY: DebugReplayResponse = {
  date: "2026-04-04",
  steps: [
    { step: "scout_scan", label: "Scout Scan", summary: "10 candidates scanned, 7 passed gates", detail: { total_scanned: 10, passed_gates: 7, top_tickers: ["AAPL", "MSFT", "NVDA"] } },
    { step: "guardian_decisions", label: "Guardian Decisions", summary: "3 approved, 1 modified, 1 rejected", detail: { approved_count: 3, modified_count: 1, rejected_count: 1, decisions: [] } },
    { step: "trade_events", label: "Trade Events", summary: "2 trades executed", detail: { trades: [] } },
  ],
  message: null,
  replay_error: null,
}

function hookResult(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSearch.mockReturnValue({ tab: "events", source: "", type: "", since: "", agent: "", date: "", severity: "" })
  mockUseDebugEvents.mockReturnValue(hookResult(MOCK_EVENTS))
  mockUseDebugLogs.mockReturnValue(hookResult(MOCK_LOGS))
  mockUseDebugReplay.mockReturnValue(hookResult(null, { isLoading: false }))
  mockUseReplayDates.mockReturnValue(hookResult({ dates: ["2026-04-05", "2026-04-01", "2026-03-25"], dates_error: null }))
})

describe("DebugPage", () => {
  it("renders page title and sub-tabs", () => {
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("Debug")).toBeInTheDocument()
    expect(screen.getByText("Events")).toBeInTheDocument()
    expect(screen.getByText("Logs")).toBeInTheDocument()
    expect(screen.getByText("Replay")).toBeInTheDocument()
  })

  it("shows loading skeleton for events", () => {
    mockUseDebugEvents.mockReturnValue(hookResult(null, { isLoading: true }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows error card for events", () => {
    mockUseDebugEvents.mockReturnValue(hookResult(null, { isError: true, error: { message: "Network error" } }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("Network error")).toBeInTheDocument()
  })
})

describe("Events sub-tab", () => {
  it("renders event rows", () => {
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    // Sources and types appear in both table rows and filter dropdowns
    expect(screen.getAllByText("Guardian").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("shadow_observer").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("alert").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("sync_complete").length).toBeGreaterThanOrEqual(1)
  })

  it("shows empty state when no events", () => {
    mockUseDebugEvents.mockReturnValue(hookResult({ events: [], events_error: null }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("No events found for the selected filters")).toBeInTheDocument()
  })

  it("shows events_error from API", () => {
    mockUseDebugEvents.mockReturnValue(hookResult({ events: [], events_error: "DB connection failed" }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("DB connection failed")).toBeInTheDocument()
  })

  it("expands event payload on click", async () => {
    const user = userEvent.setup()
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    // Find the expand link for the first event with payload
    const expandButtons = screen.getAllByText("expand")
    await user.click(expandButtons[0])
    expect(screen.getByText(/High volatility/)).toBeInTheDocument()
  })

  it("renders filter dropdowns", () => {
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("All sources")).toBeInTheDocument()
    expect(screen.getByText("All types")).toBeInTheDocument()
    expect(screen.getByText("Refresh")).toBeInTheDocument()
  })
})

describe("Logs sub-tab", () => {
  beforeEach(() => {
    mockUseSearch.mockReturnValue({ tab: "logs", source: "", type: "", since: "", agent: "", date: "", severity: "" })
  })

  it("renders log entries with severity badges", () => {
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    // Severity badges appear in log entries (may also be in filter dropdowns)
    expect(screen.getAllByText("ERROR").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("INFO").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("WARNING").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Failed to fetch AAPL data")).toBeInTheDocument()
  })

  it("shows empty state for logs", () => {
    mockUseDebugLogs.mockReturnValue(hookResult({ logs: [], logs_error: null, message: null }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("No log entries found for the selected filters")).toBeInTheDocument()
  })

  it("shows log message from API", () => {
    mockUseDebugLogs.mockReturnValue(hookResult({ logs: [], logs_error: null, message: "Log directory not configured" }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("Log directory not configured")).toBeInTheDocument()
  })

  it("expands error entry to show stack trace", async () => {
    const user = userEvent.setup()
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    // Click on the ERROR entry
    await user.click(screen.getByText("Failed to fetch AAPL data"))
    expect(screen.getByText(/Traceback/)).toBeInTheDocument()
  })
})

describe("Replay sub-tab", () => {
  beforeEach(() => {
    mockUseSearch.mockReturnValue({ tab: "replay", source: "", type: "", since: "", agent: "", date: "2026-04-04", severity: "" })
    mockUseDebugReplay.mockReturnValue(hookResult(MOCK_REPLAY))
  })

  it("renders timeline steps", () => {
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("Scout Scan")).toBeInTheDocument()
    expect(screen.getByText("Guardian Decisions")).toBeInTheDocument()
    expect(screen.getByText("Trade Events")).toBeInTheDocument()
  })

  it("shows step summaries", () => {
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("10 candidates scanned, 7 passed gates")).toBeInTheDocument()
    expect(screen.getByText("2 trades executed")).toBeInTheDocument()
  })

  it("shows no-data message for empty replay", () => {
    mockUseDebugReplay.mockReturnValue(hookResult({
      date: "2020-01-01",
      steps: [],
      message: "No pipeline run found for this date",
      replay_error: null,
    }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("No pipeline run found for this date")).toBeInTheDocument()
  })

  it("shows no-data message when no pipeline dates exist", () => {
    mockUseSearch.mockReturnValue({ tab: "replay", source: "", type: "", since: "", agent: "", date: "", severity: "" })
    mockUseReplayDates.mockReturnValue(hookResult({ dates: [], dates_error: null }))
    mockUseDebugReplay.mockReturnValue(hookResult(null, { isLoading: false }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("No pipeline run dates found")).toBeInTheDocument()
  })

  it("expands step to show detail", async () => {
    const user = userEvent.setup()
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    await user.click(screen.getByText("Scout Scan"))
    expect(screen.getByText(/"total_scanned": 10/)).toBeInTheDocument()
  })

  it("shows replay_error from API", () => {
    mockUseDebugReplay.mockReturnValue(hookResult({
      date: "2026-04-04",
      steps: [],
      message: null,
      replay_error: "portfolio.db not configured",
    }))
    render(<DebugPageComponent />, { wrapper: createWrapper() })
    expect(screen.getByText("portfolio.db not configured")).toBeInTheDocument()
  })
})
