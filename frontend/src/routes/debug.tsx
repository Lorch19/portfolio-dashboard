import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import {
  Bug,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react"
import { useDebugEvents, useDebugLogs, useDebugReplay } from "@/api/useDebug"
import { ErrorCard } from "@/components/ErrorCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { DebugEvent, LogEntry, ReplayStep } from "@/types/debug"

export const Route = createFileRoute("/debug")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || "events",
    source: (search.source as string) || "",
    type: (search.type as string) || "",
    since: (search.since as string) || "",
    agent: (search.agent as string) || "",
    date: (search.date as string) || "",
    severity: (search.severity as string) || "",
  }),
  component: DebugPage,
})

export { DebugPage as DebugPageComponent }

// ── Severity badge ──────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  ERROR: "bg-destructive/10 text-destructive",
  CRITICAL: "bg-destructive/10 text-destructive",
  WARNING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  INFO: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  DEBUG: "bg-muted text-muted-foreground",
}

const SEVERITY_ICONS: Record<string, typeof AlertCircle> = {
  ERROR: AlertCircle,
  CRITICAL: AlertCircle,
  WARNING: AlertTriangle,
  INFO: Info,
}

function SeverityBadge({ severity }: { severity: string }) {
  const Icon = SEVERITY_ICONS[severity]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.DEBUG
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {severity}
    </span>
  )
}

// ── Events Sub-tab ──────────────────────────────────────────────────────

const AGENT_SOURCES = ["", "Guardian", "Scout", "shadow_observer", "data_bridge", "Michael", "Radar", "Chronicler"]
const EVENT_TYPES = ["", "alert", "info", "sync_complete", "health_check", "hold_point_triggered", "drawdown_pause"]

function EventsSection() {
  const { source, type, since } = Route.useSearch()
  const navigate = useNavigate({ from: "/debug" })
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const params = useMemo(
    () => ({ source: source || undefined, type: type || undefined, since: since || undefined }),
    [source, type, since]
  )

  const { data, isLoading, isError, error, refetch } = useDebugEvents(params)

  const updateFilter = (key: string, value: string) => {
    navigate({ search: (prev: Record<string, string>) => ({ ...prev, [key]: value }) })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={source}
            onChange={(e) => updateFilter("source", e.target.value)}
          >
            <option value="">All sources</option>
            {AGENT_SOURCES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Event Type</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={type}
            onChange={(e) => updateFilter("type", e.target.value)}
          >
            <option value="">All types</option>
            {EVENT_TYPES.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Since</label>
          <input
            type="date"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={since}
            onChange={(e) => updateFilter("since", e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8">
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {isLoading && <EventsSkeleton />}
      {isError && <ErrorCard error={error?.message ?? "Failed to load events"} onRetry={() => refetch()} />}
      {data?.events_error && <ErrorCard error={data.events_error} onRetry={() => refetch()} />}

      {data && !data.events_error && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Timestamp</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Source</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      isExpanded={expandedId === event.id}
                      onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
                    />
                  ))}
                  {data.events.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        No events found for the selected filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function EventRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: DebugEvent
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasPayload = event.payload != null && event.payload !== ""

  let formattedPayload: string | null = null
  if (hasPayload && isExpanded) {
    try {
      formattedPayload = JSON.stringify(JSON.parse(event.payload!), null, 2)
    } catch {
      formattedPayload = event.payload
    }
  }

  return (
    <>
      <tr
        className={cn(
          "h-10 border-b border-border/50 hover:bg-muted/50",
          hasPayload && "cursor-pointer"
        )}
        onClick={hasPayload ? onToggle : undefined}
      >
        <td className="px-3 py-1 text-xs tabular-nums text-muted-foreground">{event.timestamp}</td>
        <td className="px-3 py-1 font-medium">{event.source}</td>
        <td className="px-3 py-1">
          <span className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs">{event.event_type}</span>
        </td>
        <td className="px-3 py-1">
          {hasPayload && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {isExpanded ? "collapse" : "expand"}
            </span>
          )}
        </td>
      </tr>
      {isExpanded && formattedPayload && (
        <tr>
          <td colSpan={4} className="bg-muted/30 px-3 py-2">
            <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
              {formattedPayload}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Logs Sub-tab ────────────────────────────────────────────────────────

const AGENTS = ["", "scout", "radar", "guardian", "chronicler", "michael", "shadow_observer", "supervisor"]
const SEVERITIES = ["", "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

function LogsSection() {
  const { agent, date, severity } = Route.useSearch()
  const navigate = useNavigate({ from: "/debug" })
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const params = useMemo(
    () => ({ agent: agent || undefined, date: date || undefined, severity: severity || undefined }),
    [agent, date, severity]
  )

  const { data, isLoading, isError, error, refetch } = useDebugLogs(params)

  const updateFilter = (key: string, value: string) => {
    navigate({ search: (prev: Record<string, string>) => ({ ...prev, [key]: value }) })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Agent</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={agent}
            onChange={(e) => updateFilter("agent", e.target.value)}
          >
            <option value="">All agents</option>
            {AGENTS.filter(Boolean).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
          <input
            type="date"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={date}
            onChange={(e) => updateFilter("date", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Severity</label>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={severity}
            onChange={(e) => updateFilter("severity", e.target.value)}
          >
            <option value="">All levels</option>
            {SEVERITIES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8">
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      {isLoading && <LogsSkeleton />}
      {isError && <ErrorCard error={error?.message ?? "Failed to load logs"} onRetry={() => refetch()} />}
      {data?.logs_error && <ErrorCard error={data.logs_error} onRetry={() => refetch()} />}
      {data?.message && <p className="text-sm text-muted-foreground">{data.message}</p>}

      {data && !data.logs_error && (
        <div className="space-y-1">
          {data.logs.map((log, idx) => (
            <LogEntryRow
              key={`${log.timestamp}-${idx}`}
              log={log}
              isExpanded={expandedIdx === idx}
              onToggle={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            />
          ))}
          {data.logs.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No log entries found for the selected filters
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function LogEntryRow({
  log,
  isExpanded,
  onToggle,
}: {
  log: LogEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasTrace = log.trace != null && log.trace !== ""
  const isClickable = hasTrace || log.severity === "ERROR" || log.severity === "CRITICAL"

  return (
    <Card
      className={cn("overflow-hidden", isClickable && "cursor-pointer hover:bg-muted/50")}
      onClick={isClickable ? onToggle : undefined}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="flex shrink-0 items-center gap-2">
            {isClickable && (
              isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <SeverityBadge severity={log.severity} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="tabular-nums">{log.timestamp}</span>
              <span className="font-medium text-foreground">{log.agent}</span>
              <span className="text-muted-foreground/60">{log.source_file}</span>
            </div>
            <p className="mt-0.5 text-sm">{log.message}</p>
          </div>
        </div>
        {isExpanded && hasTrace && (
          <pre className="mt-3 max-h-64 overflow-auto rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
            {log.trace}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}

// ── Replay Sub-tab ──────────────────────────────────────────────────────

function ReplaySection() {
  const { date } = Route.useSearch()
  const navigate = useNavigate({ from: "/debug" })
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  const { data, isLoading, isError, error, refetch } = useDebugReplay(date, !!date)

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Pipeline Date</label>
          <input
            type="date"
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={date}
            onChange={(e) => navigate({ search: (prev: Record<string, string>) => ({ ...prev, date: e.target.value }) })}
          />
        </div>
        {date && (
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-8">
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </div>

      {!date && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Select a date to view the pipeline replay
          </CardContent>
        </Card>
      )}

      {date && isLoading && <ReplaySkeleton />}
      {isError && <ErrorCard error={error?.message ?? "Failed to load replay"} onRetry={() => refetch()} />}
      {data?.replay_error && <ErrorCard error={data.replay_error} onRetry={() => refetch()} />}

      {data && !data.replay_error && data.message && data.steps.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {data.message}
          </CardContent>
        </Card>
      )}

      {data && !data.replay_error && data.steps.length > 0 && (
        <div className="relative ml-4 border-l-2 border-border pl-6">
          {data.steps.map((step, idx) => (
            <ReplayStepCard
              key={step.step}
              step={step}
              isLast={idx === data.steps.length - 1}
              isExpanded={expandedStep === step.step}
              onToggle={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const STEP_COLORS: Record<string, string> = {
  scout_scan: "bg-blue-500",
  guardian_decisions: "bg-amber-500",
  trade_events: "bg-green-500",
  portfolio_snapshot: "bg-purple-500",
}

function ReplayStepCard({
  step,
  isLast,
  isExpanded,
  onToggle,
}: {
  step: ReplayStep
  isLast: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn("relative", !isLast && "pb-6")}>
      {/* Timeline dot */}
      <div
        className={cn(
          "absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background",
          STEP_COLORS[step.step] ?? "bg-muted-foreground"
        )}
      />

      <Card className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            {isExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
            <h3 className="text-sm font-semibold">{step.label}</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>

          {isExpanded && (
            <pre className="mt-3 max-h-80 overflow-auto rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(step.detail, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Skeletons ───────────────────────────────────────────────────────────

function EventsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  )
}

function LogsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-lg" />
      ))}
    </div>
  )
}

function ReplaySkeleton() {
  return (
    <div className="ml-4 space-y-4 border-l-2 border-border pl-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────

function DebugPage() {
  const { tab } = Route.useSearch()
  const navigate = useNavigate({ from: "/debug" })

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Debug</h1>

      <Tabs
        value={tab}
        onValueChange={(value: string | number | null) => {
          if (typeof value === "string") {
            navigate({ search: (prev: Record<string, string>) => ({ ...prev, tab: value }) })
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="replay">Replay</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <EventsSection />
        </TabsContent>

        <TabsContent value="logs">
          <LogsSection />
        </TabsContent>

        <TabsContent value="replay">
          <ReplaySection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
