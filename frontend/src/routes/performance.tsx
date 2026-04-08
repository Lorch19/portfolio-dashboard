import { createFileRoute } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  ComposedChart,
  Bar,
  BarChart,
  Cell,
} from "recharts"
import {
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
  ArrowUpDown,
  AlertTriangle,
  Target,
  Users,
} from "lucide-react"
import { usePerformance } from "@/api/usePerformance"
import { useStrategies } from "@/api/useStrategies"
import { ErrorCard } from "@/components/ErrorCard"
import { ChartCard } from "@/components/ChartCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type {
  PortfolioSummary,
  Snapshot,
  PredictionAccuracy,
  Calibration,
  ArenaEntry,
  StrategyComparison,
} from "@/types/performance"

export const Route = createFileRoute("/performance")({
  validateSearch: (search: Record<string, unknown>) => ({
    session: (search.session as string) || "",
  }),
  component: PerformancePage,
})

export { PerformancePage as PerformancePageComponent }

// --- Chart configs ---

const pnlChartConfig = {
  portfolio_pct: {
    label: "Portfolio",
    color: "hsl(215, 70%, 55%)",
  },
  spy_pct: {
    label: "SPY",
    color: "hsl(215, 15%, 55%)",
  },
} satisfies ChartConfig

const calibrationChartConfig = {
  brier_score: {
    label: "Brier Score",
    color: "hsl(215, 70%, 55%)",
  },
  target: {
    label: "Target",
    color: "hsl(215, 15%, 55%)",
  },
} satisfies ChartConfig

// --- Formatters ---

function formatDollar(value: number | null): string {
  if (value == null) return "—"
  return value < 0
    ? `-$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPct(value: number | null): string {
  if (value == null) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatHitRate(value: number | null): string {
  if (value == null) return "—"
  return `${(value * 100).toFixed(1)}%`
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// --- KPI Card ---

interface KpiItem {
  label: string
  value: string
  rawValue: number | null
  subtext?: string
}

function PerformanceKpiCards({ summary }: { summary: PortfolioSummary }) {
  const kpis: KpiItem[] = [
    {
      label: "Total P&L",
      value: summary.total_pnl != null ? formatDollar(summary.total_pnl) : "—",
      rawValue: summary.total_pnl,
      subtext: summary.total_pnl_pct != null ? formatPct(summary.total_pnl_pct) : undefined,
    },
    {
      label: "CAGR",
      value: summary.cagr != null ? formatPct(summary.cagr) : "—",
      rawValue: summary.cagr,
    },
    {
      label: "SPY Return",
      value: summary.spy_return != null ? formatPct(summary.spy_return) : "—",
      rawValue: summary.spy_return,
    },
    {
      label: "Alpha",
      value: summary.alpha != null ? formatPct(summary.alpha) : "—",
      rawValue: summary.alpha,
    },
    {
      label: "Win Rate",
      value: summary.win_rate != null ? `${(summary.win_rate * 100).toFixed(0)}%` : "—",
      rawValue: summary.win_rate,
    },
    {
      label: "Total Trades",
      value: String(summary.total_trades),
      rawValue: summary.total_trades,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={cn(
                  "text-2xl font-bold",
                  kpi.rawValue != null && kpi.rawValue > 0 && "text-success",
                  kpi.rawValue != null && kpi.rawValue < 0 && "text-destructive"
                )}
                aria-label={`${kpi.label}: ${kpi.value}`}
              >
                {kpi.value}
              </span>
              {kpi.rawValue != null && kpi.rawValue > 0 && (
                <ArrowUp className="h-4 w-4 text-success" />
              )}
              {kpi.rawValue != null && kpi.rawValue < 0 && (
                <ArrowDown className="h-4 w-4 text-destructive" />
              )}
              {kpi.rawValue != null && kpi.rawValue === 0 && (
                <Minus className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {kpi.subtext && (
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.subtext}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// --- Strategy Comparison Table ---

function StrategyComparisonTable({
  strategies,
}: {
  strategies: StrategyComparison[]
}) {
  return (
    <section aria-label="Strategy Comparison">
      <h2 className="mb-3 text-base font-semibold">Multi-Portfolio Comparison</h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-muted-foreground">Strategy</th>
                  <th className="px-3 py-2 text-left text-sm font-semibold text-muted-foreground">Since</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-muted-foreground">Value</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-muted-foreground">Return</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-muted-foreground">SPY</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-muted-foreground">Alpha</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-muted-foreground">Win Rate</th>
                  <th className="px-3 py-2 text-right text-sm font-semibold text-muted-foreground">Trades</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s, i) => (
                  <tr
                    key={s.strategy_id}
                    className={cn(
                      "h-10 border-b border-border/50",
                      i % 2 === 1 && "bg-muted/50"
                    )}
                  >
                    <td className="px-3 py-1 font-medium">{s.strategy_id}</td>
                    <td className="px-3 py-1 text-muted-foreground">{s.start_date}</td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {s.latest_value != null ? `$${s.latest_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      <span className={cn(
                        s.return_pct != null && s.return_pct > 0 && "text-success",
                        s.return_pct != null && s.return_pct < 0 && "text-destructive"
                      )}>
                        {formatPct(s.return_pct)}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      <span className={cn(
                        s.spy_return_pct != null && s.spy_return_pct > 0 && "text-success",
                        s.spy_return_pct != null && s.spy_return_pct < 0 && "text-destructive"
                      )}>
                        {formatPct(s.spy_return_pct)}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      <span className={cn(
                        s.alpha_pct != null && s.alpha_pct > 0 && "text-success",
                        s.alpha_pct != null && s.alpha_pct < 0 && "text-destructive"
                      )}>
                        {formatPct(s.alpha_pct)}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">
                      {s.win_rate != null ? `${(s.win_rate * 100).toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{s.total_trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

// --- Prediction Accuracy Section ---

function PredictionAccuracySection({
  accuracy,
}: {
  accuracy: PredictionAccuracy
}) {
  const cards: KpiItem[] = [
    {
      label: "Total Predictions",
      value: String(accuracy.total_predictions),
      rawValue: null,
    },
    {
      label: "Resolved",
      value: String(accuracy.resolved_count),
      rawValue: null,
      subtext: accuracy.total_predictions > 0
        ? `${((accuracy.resolved_count / accuracy.total_predictions) * 100).toFixed(0)}% resolved`
        : undefined,
    },
    {
      label: "Overall Hit Rate",
      value: formatHitRate(accuracy.hit_rate),
      rawValue: accuracy.hit_rate != null ? accuracy.hit_rate - 0.5 : null,
    },
    {
      label: "T+5 Hit Rate",
      value: formatHitRate(accuracy.hit_rate_by_window.t_5),
      rawValue: accuracy.hit_rate_by_window.t_5 != null ? accuracy.hit_rate_by_window.t_5 - 0.5 : null,
    },
    {
      label: "T+10 Hit Rate",
      value: formatHitRate(accuracy.hit_rate_by_window.t_10),
      rawValue: accuracy.hit_rate_by_window.t_10 != null ? accuracy.hit_rate_by_window.t_10 - 0.5 : null,
    },
    {
      label: "T+20 Hit Rate",
      value: formatHitRate(accuracy.hit_rate_by_window.t_20),
      rawValue: accuracy.hit_rate_by_window.t_20 != null ? accuracy.hit_rate_by_window.t_20 - 0.5 : null,
    },
    {
      label: "Avg Brier Score",
      value: accuracy.average_brier_score != null ? accuracy.average_brier_score.toFixed(3) : "—",
      rawValue: accuracy.average_brier_score != null ? -(accuracy.average_brier_score - 0.25) : null,
    },
  ]

  return (
    <section aria-label="Prediction Accuracy">
      <h2 className="mb-3 text-base font-semibold">Prediction Accuracy</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-2xl font-bold",
                    kpi.rawValue != null && kpi.rawValue > 0 && "text-success",
                    kpi.rawValue != null && kpi.rawValue < 0 && "text-destructive"
                  )}
                  aria-label={`${kpi.label}: ${kpi.value}`}
                >
                  {kpi.value}
                </span>
                {kpi.rawValue != null && kpi.rawValue > 0 && (
                  <ArrowUp className="h-4 w-4 text-success" />
                )}
                {kpi.rawValue != null && kpi.rawValue < 0 && (
                  <ArrowDown className="h-4 w-4 text-destructive" />
                )}
              </div>
              {kpi.subtext && (
                <p className="mt-0.5 text-xs text-muted-foreground">{kpi.subtext}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

// --- Calibration Card ---

function CalibrationCard({
  calibration,
}: {
  calibration: Calibration
}) {
  const brierData = useMemo(() => {
    if (calibration.average_brier_score == null) return []
    return [
      {
        name: "Actual",
        value: calibration.average_brier_score,
        fill: calibration.beating_random ? "hsl(152, 60%, 48%)" : "hsl(0, 70%, 55%)",
      },
      {
        name: "Target",
        value: calibration.target_brier,
        fill: "hsl(215, 15%, 55%)",
      },
    ]
  }, [calibration])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Prediction Calibration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Brier Score Bar Chart */}
        {brierData.length > 0 && (
          <ChartContainer config={calibrationChartConfig} className="h-[120px] w-full">
            <BarChart data={brierData} layout="vertical" accessibilityLayer>
              <XAxis type="number" domain={[0, 0.5]} hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: "hsl(215, 15%, 40%)" }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span>{(value as number).toFixed(3)}</span>
                    )}
                  />
                }
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {brierData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}

        {/* Calibration Metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Brier Score</p>
            <p
              className={cn(
                "font-semibold",
                calibration.beating_random ? "text-success" : "text-destructive"
              )}
              aria-label={`Brier Score: ${calibration.average_brier_score?.toFixed(3) ?? "N/A"}`}
            >
              {calibration.average_brier_score?.toFixed(3) ?? "—"}
              {calibration.beating_random != null && (
                calibration.beating_random ? (
                  <ArrowUp className="ml-1 inline h-3 w-3" />
                ) : (
                  <ArrowDown className="ml-1 inline h-3 w-3" />
                )
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Target</p>
            <p className="font-semibold">
              <Target className="mr-1 inline h-3 w-3 text-muted-foreground" />
              {calibration.target_brier.toFixed(3)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Agreement Rate</p>
            <p className="font-semibold" aria-label={`Agreement Rate: ${formatHitRate(calibration.agreement_rate)}`}>
              <Users className="mr-1 inline h-3 w-3 text-muted-foreground" />
              {formatHitRate(calibration.agreement_rate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Sycophancy Flag</p>
            <p
              className={cn(
                "font-semibold",
                calibration.sycophancy_flag && "text-destructive"
              )}
              aria-label={`Sycophancy Flag: ${calibration.sycophancy_flag ? "Warning" : "OK"}`}
            >
              {calibration.sycophancy_flag ? (
                <>
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Warning
                </>
              ) : (
                "OK"
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Arena Comparison Table ---

type ArenaSortKey = keyof ArenaEntry
type SortDirection = "asc" | "desc"

const ARENA_COLUMNS: { key: ArenaSortKey; label: string }[] = [
  { key: "model_id", label: "Model" },
  { key: "session", label: "Session" },
  { key: "total_decisions", label: "Decisions" },
  { key: "hit_rate", label: "Hit Rate" },
  { key: "average_alpha", label: "Avg Alpha" },
  { key: "total_cost", label: "Cost" },
]

function ArenaComparisonTable({
  entries,
  sessionFilter,
  onSessionChange,
}: {
  entries: ArenaEntry[]
  sessionFilter: string
  onSessionChange: (session: string) => void
}) {
  const [sortKey, setSortKey] = useState<ArenaSortKey>("hit_rate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const sessions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.session))).sort(),
    [entries]
  )

  const filtered = useMemo(() => {
    if (!sessionFilter) return entries
    return entries.filter((e) => e.session === sessionFilter)
  }, [entries, sessionFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      let cmp = 0
      if (typeof aVal === "string" && typeof bVal === "string") {
        cmp = aVal.localeCompare(bVal)
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      }
      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDirection])

  const handleSort = (key: ArenaSortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("desc")
    }
  }

  return (
    <section aria-label="Arena Model Comparison">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">Arena Model Comparison</h2>
        {sessions.length > 1 && (
          <select
            value={sessionFilter}
            onChange={(e) => onSessionChange(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            aria-label="Filter by session"
          >
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr>
                  {ARENA_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="cursor-pointer select-none px-3 py-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortKey === col.key
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr
                    key={`${entry.model_id}-${entry.session}-${i}`}
                    className={cn(
                      "h-10 border-b border-border/50",
                      i % 2 === 1 && "bg-muted/50"
                    )}
                  >
                    <td className="px-3 py-1 font-medium">{entry.model_id}</td>
                    <td className="px-3 py-1 text-muted-foreground">{entry.session}</td>
                    <td className="px-3 py-1 tabular-nums">{entry.total_decisions}</td>
                    <td className="px-3 py-1 tabular-nums">
                      <span
                        className={cn(
                          entry.hit_rate != null && entry.hit_rate > 0.5 && "text-success",
                          entry.hit_rate != null && entry.hit_rate < 0.5 && "text-destructive"
                        )}
                      >
                        {formatHitRate(entry.hit_rate)}
                      </span>
                    </td>
                    <td className="px-3 py-1 tabular-nums">
                      <span
                        className={cn(
                          entry.average_alpha != null && entry.average_alpha > 0 && "text-success",
                          entry.average_alpha != null && entry.average_alpha < 0 && "text-destructive"
                        )}
                      >
                        {formatPct(entry.average_alpha)}
                      </span>
                    </td>
                    <td className="px-3 py-1 tabular-nums">{formatDollar(entry.total_cost)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      {sessionFilter ? "No data for selected session" : "No arena comparison data available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

// --- P&L Chart (normalized to % returns) ---

interface PnlDataPoint {
  date: string
  portfolio_pct: number
  spy_pct: number | null
  alpha: number | null
}

function PnlChart({ snapshots }: { snapshots: Snapshot[] }) {
  const data = useMemo<PnlDataPoint[]>(() => {
    if (snapshots.length === 0) return []
    const basePortfolio = snapshots[0].portfolio_value
    const baseSpy = snapshots[0].spy_value
    return snapshots.map((s) => {
      const portfolioPct = basePortfolio > 0
        ? ((s.portfolio_value - basePortfolio) / basePortfolio) * 100
        : 0
      const spyPct = baseSpy != null && baseSpy > 0 && s.spy_value != null
        ? ((s.spy_value - baseSpy) / baseSpy) * 100
        : null
      return {
        date: s.snapshot_date,
        portfolio_pct: Math.round(portfolioPct * 100) / 100,
        spy_pct: spyPct != null ? Math.round(spyPct * 100) / 100 : null,
        alpha: spyPct != null ? Math.round((portfolioPct - spyPct) * 100) / 100 : null,
      }
    })
  }, [snapshots])

  return (
    <ChartContainer config={pnlChartConfig} className="min-h-[180px] w-full md:min-h-[240px]">
      <ComposedChart data={data} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(230, 14%, 14%)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: "hsl(215, 15%, 40%)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
          tick={{ fontSize: 11, fill: "hsl(215, 15%, 40%)" }}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                if (payload?.[0]?.payload?.date) {
                  return formatShortDate(payload[0].payload.date)
                }
                return ""
              }}
              formatter={(value, name, item) => {
                const point = item?.payload as PnlDataPoint | undefined
                if (name === "portfolio_pct") {
                  return <span>Portfolio: {formatPct(value as number)}</span>
                }
                if (name === "spy_pct") {
                  return (
                    <span>
                      SPY: {formatPct(value as number)}
                      {point?.alpha != null && (
                        <span className="ml-2 text-muted-foreground">
                          Alpha: {formatPct(point.alpha)}
                        </span>
                      )}
                    </span>
                  )
                }
                return <span>{formatPct(value as number)}</span>
              }}
            />
          }
        />
        <defs>
          <linearGradient id="fillPortfolio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(215, 70%, 55%)" stopOpacity={0.1} />
            <stop offset="95%" stopColor="hsl(215, 70%, 55%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillSpy" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(215, 15%, 55%)" stopOpacity={0.1} />
            <stop offset="95%" stopColor="hsl(215, 15%, 55%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="portfolio_pct"
          fill="url(#fillPortfolio)"
          stroke="none"
        />
        <Area
          type="monotone"
          dataKey="spy_pct"
          fill="url(#fillSpy)"
          stroke="none"
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="portfolio_pct"
          stroke="var(--color-portfolio_pct)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="spy_pct"
          stroke="var(--color-spy_pct)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  )
}

// --- Performance Page ---

function PerformancePage() {
  const [strategyId, setStrategyId] = useState<string>("")
  const { data: strategiesData } = useStrategies()
  const { data, isLoading, isError, error, refetch } = usePerformance(strategyId || undefined)
  const { session } = Route.useSearch()
  const navigate = Route.useNavigate()

  const strategies = strategiesData?.strategies ?? []

  if (isLoading) return <PerformanceSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load performance data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const summary = data?.portfolio_summary
  const snapshots = data?.snapshots

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Performance</h1>

        {strategies.length > 1 && (
          <select
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
            aria-label="Filter by strategy"
          >
            <option value="">All Strategies</option>
            {strategies.map((s) => (
              <option key={s.strategy_id} value={s.strategy_id}>
                {s.strategy_id} (since {s.start_date})
              </option>
            ))}
          </select>
        )}
      </div>

      {data?.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}

      {/* Strategy Comparison Table */}
      {!strategyId && data?.strategy_comparison && data.strategy_comparison.length > 1 && (
        <StrategyComparisonTable strategies={data.strategy_comparison} />
      )}

      {/* KPI Summary Cards */}
      <div aria-live="polite">
        {data?.portfolio_summary_error ? (
          <ErrorCard error={data.portfolio_summary_error} onRetry={() => refetch()} />
        ) : summary ? (
          <PerformanceKpiCards summary={summary} />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Prediction Accuracy */}
      <div aria-live="polite">
        {data?.prediction_accuracy_error ? (
          <ErrorCard error={data.prediction_accuracy_error} onRetry={() => refetch()} />
        ) : data?.prediction_accuracy ? (
          <PredictionAccuracySection accuracy={data.prediction_accuracy} />
        ) : (
          <PredictionEmptyState />
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Portfolio P&L vs SPY"
          subtitle={
            summary?.start_date && summary?.end_date
              ? `${formatShortDate(summary.start_date)} — ${formatShortDate(summary.end_date)}`
              : undefined
          }
          isLoading={false}
          error={data?.snapshots_error}
          isEmpty={!snapshots || snapshots.length === 0}
          onRetry={() => refetch()}
        >
          {snapshots && snapshots.length > 0 && (
            <PnlChart snapshots={snapshots} />
          )}
        </ChartCard>

        {/* Calibration Card */}
        {data?.calibration_error ? (
          <ChartCard
            title="Prediction Calibration"
            isLoading={false}
            error={data.calibration_error}
            onRetry={() => refetch()}
          >
            <div />
          </ChartCard>
        ) : data?.calibration ? (
          <CalibrationCard calibration={data.calibration} />
        ) : (
          <ChartCard
            title="Prediction Calibration"
            isLoading={false}
            isEmpty={true}
          >
            <div />
          </ChartCard>
        )}
      </div>

      {/* Arena Comparison */}
      <div aria-live="polite">
        {data?.arena_comparison_error ? (
          <ErrorCard error={data.arena_comparison_error} onRetry={() => refetch()} />
        ) : data?.arena_comparison && data.arena_comparison.length > 0 ? (
          <ArenaComparisonTable
            entries={data.arena_comparison}
            sessionFilter={session}
            onSessionChange={(s) => navigate({ search: { session: s } })}
          />
        ) : (
          <ArenaEmptyState />
        )}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <TrendingUp className="mb-3 h-12 w-12 text-muted-foreground" />
      <h2 className="text-base font-medium">No performance data available</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Performance metrics will appear here when portfolio data is available.
      </p>
    </div>
  )
}

function PredictionEmptyState() {
  return (
    <section aria-label="Prediction Accuracy">
      <h2 className="mb-3 text-base font-semibold">Prediction Accuracy</h2>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Target className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">No prediction data available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Prediction accuracy will appear when evaluation results are available.
        </p>
      </div>
    </section>
  )
}

function ArenaEmptyState() {
  return (
    <section aria-label="Arena Model Comparison">
      <h2 className="mb-3 text-base font-semibold">Arena Model Comparison</h2>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">No arena comparison data available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Arena comparison will appear when model competition data is available.
        </p>
      </div>
    </section>
  )
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-7 w-32" />
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Prediction accuracy skeleton */}
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
      {/* Arena table skeleton */}
      <div>
        <Skeleton className="mb-3 h-6 w-48" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    </div>
  )
}
