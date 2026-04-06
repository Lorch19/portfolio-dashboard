import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { SupervisorResponse } from "@/types/supervisor"
import { ShadowObserverFeed } from "@/components/ShadowObserverFeed"
import { HoldPointsSection } from "@/components/HoldPointsSection"
import { StranglerFigTracker } from "@/components/StranglerFigTracker"
import { DaemonStatusSection } from "@/components/DaemonStatusSection"
import { ErrorCard } from "@/components/ErrorCard"

const mockSupervisorData: SupervisorResponse = {
  shadow_observer_events: [
    {
      id: 1,
      source: "shadow_observer",
      event_type: "sync_complete",
      data: '{"tables_synced": 5}',
      created_at: "2026-04-04T06:30:00Z",
    },
    {
      id: 2,
      source: "shadow_observer",
      event_type: "health_check",
      data: null,
      created_at: "2026-04-04T06:35:00Z",
    },
  ],
  shadow_observer_events_error: null,
  hold_points: {
    state: "active",
    trigger_pct: null,
    events: [
      {
        id: 5,
        source: "Guardian",
        event_type: "drawdown_pause",
        data: '{"drawdown_pct": 5.2}',
        created_at: "2026-04-03T14:00:00",
      },
    ],
  },
  hold_points_error: null,
  strangler_fig: {
    components: {
      Scout: { mode: "v1-cron", description: "Runs via cron schedule" },
      Radar: { mode: "v1-cron", description: "Runs via cron schedule" },
      Guardian: { mode: "v1-cron", description: "Runs via cron schedule" },
      Chronicler: { mode: "v1-cron", description: "Runs via cron schedule" },
      Michael: { mode: "v1-cron", description: "Runs via cron schedule" },
      "Shadow Observer": {
        mode: "v2-supervisor",
        description: "Supervisor daemon",
      },
      DataBridge: {
        mode: "v2-supervisor",
        description: "Supervisor sync service",
      },
      "Health Monitor": {
        mode: "v2-supervisor",
        description: "Supervisor health checks",
      },
    },
    progress_summary: "3/8 components on v2-supervisor",
  },
  strangler_fig_error: null,
  daemons: [
    {
      component: "Scout",
      status: "healthy",
      details: '{"cycles": 42}',
      checked_at: "2026-04-04T06:40:00",
    },
    {
      component: "Shadow Observer",
      status: "healthy",
      details: null,
      checked_at: "2026-04-04T06:40:00",
    },
    {
      component: "Guardian",
      status: "degraded",
      details: null,
      checked_at: "2026-04-04T06:00:00",
    },
  ],
  daemons_error: null,
}

describe("Supervisor tab components integration", () => {
  // Shadow Observer Feed
  it("renders shadow observer events with timestamps and event types", () => {
    render(
      <ShadowObserverFeed
        events={mockSupervisorData.shadow_observer_events}
        error={null}
      />,
    )
    expect(screen.getAllByText("shadow_observer")).toHaveLength(2)
    expect(screen.getByText("sync_complete")).toBeInTheDocument()
    expect(screen.getByText("health_check")).toBeInTheDocument()
  })

  it("renders shadow observer event payload summary", () => {
    render(
      <ShadowObserverFeed
        events={mockSupervisorData.shadow_observer_events}
        error={null}
      />,
    )
    expect(screen.getByText("tables_synced: 5")).toBeInTheDocument()
  })

  it("renders empty state when no shadow observer events", () => {
    render(<ShadowObserverFeed events={[]} error={null} />)
    expect(
      screen.getByText("No Shadow Observer events"),
    ).toBeInTheDocument()
  })

  it("renders error card when shadow observer has error", () => {
    const onRetry = vi.fn()
    render(
      <ShadowObserverFeed
        events={null}
        error="DB unavailable"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByText("DB unavailable")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  // Hold Points
  it("renders hold points with active state", () => {
    render(
      <HoldPointsSection
        holdPoints={mockSupervisorData.hold_points}
        error={null}
      />,
    )
    expect(screen.getByText("active")).toBeInTheDocument()
    expect(screen.getByText("drawdown_pause")).toBeInTheDocument()
  })

  it("renders hold points with paused state", () => {
    const pausedHoldPoints = {
      state: "paused" as const,
      trigger_pct: 5.0,
      events: [],
    }
    render(
      <HoldPointsSection holdPoints={pausedHoldPoints} error={null} />,
    )
    expect(screen.getByText("paused")).toBeInTheDocument()
    expect(screen.getByText("Trigger: 5.0%")).toBeInTheDocument()
  })

  it("renders empty hold point events", () => {
    const emptyHoldPoints = {
      state: "active" as const,
      trigger_pct: null,
      events: [],
    }
    render(
      <HoldPointsSection holdPoints={emptyHoldPoints} error={null} />,
    )
    expect(screen.getByText("No hold point events")).toBeInTheDocument()
  })

  it("renders error card when hold points has error", () => {
    render(
      <HoldPointsSection
        holdPoints={null}
        error="Hold points query failed"
      />,
    )
    expect(
      screen.getByText("Hold points query failed"),
    ).toBeInTheDocument()
  })

  // Strangler Fig
  it("renders all 8 strangler fig components", () => {
    render(
      <StranglerFigTracker
        stranglerFig={mockSupervisorData.strangler_fig}
        error={null}
      />,
    )
    expect(screen.getByText("Scout")).toBeInTheDocument()
    expect(screen.getByText("Radar")).toBeInTheDocument()
    expect(screen.getByText("Guardian")).toBeInTheDocument()
    expect(screen.getByText("Chronicler")).toBeInTheDocument()
    expect(screen.getByText("Michael")).toBeInTheDocument()
    expect(screen.getByText("Shadow Observer")).toBeInTheDocument()
    expect(screen.getByText("DataBridge")).toBeInTheDocument()
    expect(screen.getByText("Health Monitor")).toBeInTheDocument()
  })

  it("renders strangler fig progress summary", () => {
    render(
      <StranglerFigTracker
        stranglerFig={mockSupervisorData.strangler_fig}
        error={null}
      />,
    )
    expect(
      screen.getByText("3/8 components on v2-supervisor"),
    ).toBeInTheDocument()
  })

  it("renders mode badges for strangler fig components", () => {
    render(
      <StranglerFigTracker
        stranglerFig={mockSupervisorData.strangler_fig}
        error={null}
      />,
    )
    const v1Badges = screen.getAllByText("v1-cron")
    const v2Badges = screen.getAllByText("v2-supervisor")
    expect(v1Badges).toHaveLength(5)
    expect(v2Badges).toHaveLength(3)
  })

  it("renders error card when strangler fig has error", () => {
    render(
      <StranglerFigTracker
        stranglerFig={null}
        error="Config malformed"
      />,
    )
    expect(screen.getByText("Config malformed")).toBeInTheDocument()
  })

  // Daemon Status
  it("renders daemon status cards with component names", () => {
    render(
      <DaemonStatusSection
        daemons={mockSupervisorData.daemons}
        error={null}
      />,
    )
    expect(screen.getByText("Scout")).toBeInTheDocument()
    expect(screen.getByText("Shadow Observer")).toBeInTheDocument()
    expect(screen.getByText("Guardian")).toBeInTheDocument()
  })

  it("renders empty state when no daemons", () => {
    render(<DaemonStatusSection daemons={[]} error={null} />)
    expect(screen.getByText("No daemon status data")).toBeInTheDocument()
  })

  it("renders error card when daemons has error", () => {
    render(
      <DaemonStatusSection
        daemons={null}
        error="Daemon query failed"
      />,
    )
    expect(screen.getByText("Daemon query failed")).toBeInTheDocument()
  })

  // Partial degradation
  it("renders sections independently when one has error", () => {
    // Simulate shadow observer error but other sections OK
    render(
      <div>
        <ShadowObserverFeed events={null} error="Shadow observer DB error" />
        <HoldPointsSection
          holdPoints={mockSupervisorData.hold_points}
          error={null}
        />
        <StranglerFigTracker
          stranglerFig={mockSupervisorData.strangler_fig}
          error={null}
        />
        <DaemonStatusSection
          daemons={mockSupervisorData.daemons}
          error={null}
        />
      </div>,
    )
    // Error for shadow observer
    expect(screen.getByText("Shadow observer DB error")).toBeInTheDocument()
    // But other sections still render
    expect(screen.getByText("active")).toBeInTheDocument()
    expect(
      screen.getByText("3/8 components on v2-supervisor"),
    ).toBeInTheDocument()
    // Scout appears in both StranglerFig and DaemonStatusSection
    expect(screen.getAllByText("Scout").length).toBeGreaterThanOrEqual(1)
  })

  // Full error
  it("renders full error card when API fetch fails", () => {
    const onRetry = vi.fn()
    render(
      <ErrorCard error="Failed to load supervisor data" onRetry={onRetry} />,
    )
    expect(
      screen.getByText("Failed to load supervisor data"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  // Daemon details display
  it("renders daemon details summary when available", () => {
    render(
      <DaemonStatusSection
        daemons={mockSupervisorData.daemons}
        error={null}
      />,
    )
    expect(screen.getByText("cycles: 42")).toBeInTheDocument()
  })

  // Hold point source field
  it("renders hold point event source", () => {
    render(
      <HoldPointsSection
        holdPoints={mockSupervisorData.hold_points}
        error={null}
      />,
    )
    expect(screen.getByText("Guardian")).toBeInTheDocument()
  })

  // Trigger percentage rounding
  it("renders trigger_pct with one decimal place", () => {
    const holdPoints = {
      state: "paused" as const,
      trigger_pct: 5.123,
      events: [],
    }
    render(<HoldPointsSection holdPoints={holdPoints} error={null} />)
    expect(screen.getByText("Trigger: 5.1%")).toBeInTheDocument()
  })

  // parseJsonSummary handles nested objects
  it("renders nested JSON values without [object Object]", () => {
    const events = [
      {
        id: 99,
        source: "shadow_observer",
        event_type: "test",
        data: '{"nested": {"key": "val"}, "count": 1}',
        created_at: "2026-04-04T06:30:00Z",
      },
    ]
    render(<ShadowObserverFeed events={events} error={null} />)
    // Should stringify nested object, not show [object Object]
    expect(screen.getByText(/nested: \{"key":"val"\}/)).toBeInTheDocument()
  })
})
