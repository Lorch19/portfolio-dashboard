import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useRef, useEffect } from "react"
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Brain,
  ChevronDown,
  ChevronRight,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
} from "lucide-react"
import { useDecisions } from "@/api/useDecisions"
import { ErrorCard } from "@/components/ErrorCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  Decision,
  Prediction,
  CounterfactualEntry,
} from "@/types/decisions"

export const Route = createFileRoute("/decisions")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticker: (search.ticker as string) || "",
  }),
  component: DecisionsPage,
})

export { DecisionsPage as DecisionsPageComponent }

// --- Formatters ---

function formatPct(value: number | null): string {
  if (value == null) return "\u2014"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatNum(value: number | null, decimals = 2): string {
  if (value == null) return "\u2014"
  return value.toFixed(decimals)
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return "\u2014"
  return text.length > maxLen ? text.slice(0, maxLen) + "\u2026" : text
}

// --- Decision Detail Panel ---

function ScoringGrid({ decision }: { decision: Decision }) {
  const items = [
    { label: "F-Score", value: formatNum(decision.fundamental_score, 0) },
    { label: "ROIC", value: formatPct(decision.roic_at_scan) },
    { label: "Prev ROIC", value: formatPct(decision.prev_roic) },
    { label: "ROIC Delta", value: formatPct(decision.roic_delta) },
    { label: "RSI", value: formatNum(decision.rsi, 1) },
    { label: "P/E", value: formatNum(decision.pe_at_scan, 1) },
    { label: "Median P/E", value: formatNum(decision.median_pe, 1) },
    { label: "P/E Discount", value: formatPct(decision.pe_discount_pct) },
    { label: "Rel Strength", value: formatNum(decision.relative_strength, 2) },
    { label: "Valuation", value: decision.valuation_verdict ?? "\u2014" },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-muted-foreground">{item.label}</p>
          <p className="font-medium tabular-nums">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

function PredictionsList({ predictions }: { predictions: Prediction[] }) {
  if (predictions.length === 0) {
    return <p className="text-sm text-muted-foreground">No predictions for this ticker.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left text-xs font-semibold text-muted-foreground">Date</th>
            <th className="px-2 py-1 text-left text-xs font-semibold text-muted-foreground">Predicted</th>
            <th className="px-2 py-1 text-left text-xs font-semibold text-muted-foreground">Prob</th>
            <th className="px-2 py-1 text-left text-xs font-semibold text-muted-foreground">Actual</th>
            <th className="px-2 py-1 text-left text-xs font-semibold text-muted-foreground">Brier</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((p, i) => (
            <tr key={`${p.ticker}-${p.scan_date}-${i}`} className={cn(i % 2 === 1 && "bg-muted/50")}>
              <td className="px-2 py-1 text-muted-foreground">{p.scan_date}</td>
              <td className="px-2 py-1">{p.predicted_outcome}</td>
              <td className="px-2 py-1 tabular-nums">{p.probability != null ? `${(p.probability * 100).toFixed(0)}%` : "\u2014"}</td>
              <td className="px-2 py-1">
                {p.resolved ? (
                  <span className={cn(
                    p.actual_outcome === p.predicted_outcome ? "text-success" : "text-destructive"
                  )}>
                    {p.actual_outcome ?? "\u2014"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">pending</span>
                )}
              </td>
              <td className="px-2 py-1 tabular-nums">
                {p.brier_score != null ? (
                  <span className={cn(p.brier_score < 0.25 ? "text-success" : "text-destructive")}>
                    {p.brier_score.toFixed(3)}
                  </span>
                ) : "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DecisionDetail({
  decision,
  predictions,
}: {
  decision: Decision
  predictions: Prediction[]
}) {
  const tickerPredictions = useMemo(
    () => predictions.filter((p) => p.ticker === decision.ticker),
    [predictions, decision.ticker]
  )

  return (
    <div className="space-y-4 border-t border-border/50 bg-muted/30 px-3 py-4">
      {/* Full Thesis */}
      {decision.thesis_full_text && (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Thesis</p>
          <p className="text-sm">{decision.thesis_full_text}</p>
        </div>
      )}

      {/* Catalyst & Invalidation */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {decision.primary_catalyst && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Primary Catalyst</p>
            <p className="text-sm">{decision.primary_catalyst}</p>
          </div>
        )}
        {decision.invalidation_trigger && (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Invalidation Trigger</p>
            <p className="text-sm">{decision.invalidation_trigger}</p>
          </div>
        )}
      </div>

      {/* Scoring Inputs */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Scoring Inputs</p>
        <ScoringGrid decision={decision} />
      </div>

      {/* Prediction Log */}
      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">Prediction Log</p>
        <PredictionsList predictions={tickerPredictions} />
      </div>
    </div>
  )
}

// --- Decisions Table ---

type DecisionSortKey = "ticker" | "scan_date" | "decision_tier" | "conviction" | "decision"
type SortDirection = "asc" | "desc"

const DECISION_COLUMNS: { key: DecisionSortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "scan_date", label: "Date" },
  { key: "decision", label: "Decision" },
  { key: "decision_tier", label: "Tier" },
  { key: "conviction", label: "Conviction" },
]

function DecisionsTable({
  decisions,
  predictions,
}: {
  decisions: Decision[]
  predictions: Prediction[]
}) {
  const [sortKey, setSortKey] = useState<DecisionSortKey>("scan_date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const sorted = useMemo(() => {
    return [...decisions].sort((a, b) => {
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
  }, [decisions, sortKey, sortDirection])

  const handleSort = (key: DecisionSortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("desc")
    }
  }

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx)
  }

  return (
    <section aria-label="Recent Decisions">
      <h2 className="mb-3 text-base font-semibold">Recent Decisions</h2>
      <Card>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr>
                  <th className="w-8 px-2 py-2" />
                  {DECISION_COLUMNS.map((col) => (
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
                  <th className="px-3 py-2 text-left text-sm font-semibold text-muted-foreground">
                    Thesis
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d, i) => (
                  <DesktopRow
                    key={`${d.ticker}-${d.scan_date}-${i}`}
                    decision={d}
                    predictions={predictions}
                    index={i}
                    isExpanded={expandedIdx === i}
                    onToggle={() => toggleExpand(i)}
                  />
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      No decisions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="space-y-0 md:hidden">
            {sorted.map((d, i) => (
              <MobileCard
                key={`${d.ticker}-${d.scan_date}-${i}`}
                decision={d}
                predictions={predictions}
                isExpanded={expandedIdx === i}
                onToggle={() => toggleExpand(i)}
              />
            ))}
            {sorted.length === 0 && (
              <div className="px-3 py-8 text-center text-muted-foreground">
                No decisions found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function DesktopRow({
  decision,
  predictions,
  index,
  isExpanded,
  onToggle,
}: {
  decision: Decision
  predictions: Prediction[]
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const decisionColor = decision.decision === "approve"
    ? "bg-success/10 text-success"
    : decision.decision === "reject"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-foreground"

  return (
    <>
      <tr
        className={cn(
          "h-10 cursor-pointer border-b border-border/50 hover:bg-muted/30",
          index % 2 === 1 && "bg-muted/50"
        )}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <td className="px-2 py-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-3 py-1 font-medium">{decision.ticker}</td>
        <td className="px-3 py-1 text-muted-foreground">{decision.scan_date}</td>
        <td className="px-3 py-1">
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", decisionColor)}>
            {decision.decision}
          </span>
        </td>
        <td className="px-3 py-1">{decision.decision_tier ?? "\u2014"}</td>
        <td className="px-3 py-1">{decision.conviction ?? "\u2014"}</td>
        <td className="max-w-[200px] truncate px-3 py-1 text-muted-foreground">
          {truncate(decision.thesis_full_text, 80)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <DecisionDetail decision={decision} predictions={predictions} />
          </td>
        </tr>
      )}
    </>
  )
}

function MobileCard({
  decision,
  predictions,
  isExpanded,
  onToggle,
}: {
  decision: Decision
  predictions: Prediction[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const decisionColor = decision.decision === "approve"
    ? "bg-success/10 text-success"
    : decision.decision === "reject"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-foreground"

  return (
    <div className="border-b border-border/50">
      <button
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{decision.ticker}</span>
            <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", decisionColor)}>
              {decision.decision}
            </span>
            {decision.conviction && (
              <span className="text-xs text-muted-foreground">{decision.conviction}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {decision.scan_date} {decision.decision_tier ? `\u00B7 ${decision.decision_tier}` : ""}
          </p>
        </div>
      </button>
      {isExpanded && (
        <DecisionDetail decision={decision} predictions={predictions} />
      )}
    </div>
  )
}

// --- Counterfactual Tables (Story 6.3) ---

function CounterfactualTable({
  entries,
  label,
  emptyText,
  colorFn,
}: {
  entries: CounterfactualEntry[]
  label: string
  emptyText: string
  colorFn: (val: number) => string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Ticker</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Gate</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Reason</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">T+20 Return</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={`${e.ticker}-${e.scan_date}-${i}`}
                  className={cn("h-10 border-b border-border/50", i % 2 === 1 && "bg-muted/50")}
                >
                  <td className="px-3 py-1 font-medium">{e.ticker}</td>
                  <td className="px-3 py-1 text-muted-foreground">{e.scan_date}</td>
                  <td className="px-3 py-1">{e.rejection_gate}</td>
                  <td className="max-w-[250px] truncate px-3 py-1 text-muted-foreground">{e.rejection_reason}</td>
                  <td className={cn("px-3 py-1 tabular-nums font-medium", colorFn(e.forward_return_pct))}>
                    {formatPct(e.forward_return_pct)}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-0 md:hidden">
          {entries.map((e, i) => (
            <div key={`${e.ticker}-${e.scan_date}-${i}`} className="border-b border-border/50 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{e.ticker}</span>
                <span className={cn("tabular-nums font-medium", colorFn(e.forward_return_pct))}>
                  {formatPct(e.forward_return_pct)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.scan_date} &middot; {e.rejection_gate}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{e.rejection_reason}</p>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="px-3 py-8 text-center text-muted-foreground">
              {emptyText}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CounterfactualSection({
  topMisses,
  topGoodRejections,
}: {
  topMisses: CounterfactualEntry[]
  topGoodRejections: CounterfactualEntry[]
}) {
  // Gate accuracy metrics
  const gateStats = useMemo(() => {
    const allEntries = [...topMisses, ...topGoodRejections]
    const byGate = new Map<string, { total: number; misses: number; validated: number }>()

    for (const e of allEntries) {
      const gate = e.rejection_gate
      if (!byGate.has(gate)) {
        byGate.set(gate, { total: 0, misses: 0, validated: 0 })
      }
      const stats = byGate.get(gate)!
      stats.total++
      if (e.forward_return_pct > 10) stats.misses++
      if (e.forward_return_pct < 0) stats.validated++
    }

    return Array.from(byGate.entries())
      .map(([gate, stats]) => ({
        gate,
        total: stats.total,
        miss_rate: stats.total > 0 ? (stats.misses / stats.total) * 100 : 0,
        validate_rate: stats.total > 0 ? (stats.validated / stats.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }, [topMisses, topGoodRejections])

  return (
    <section aria-label="Counterfactual Analysis">
      <h2 className="mb-3 text-base font-semibold">Counterfactual Analysis</h2>

      {/* Gate Accuracy Metrics */}
      {gateStats.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {gateStats.map((gs) => (
            <Card key={gs.gate}>
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground">{gs.gate}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{gs.total} rejections</p>
                <div className="mt-1 flex gap-3 text-xs">
                  <span className="text-destructive">
                    <AlertTriangle className="mr-0.5 inline h-3 w-3" />
                    {gs.miss_rate.toFixed(0)}% miss
                  </span>
                  <span className="text-success">
                    <CheckCircle className="mr-0.5 inline h-3 w-3" />
                    {gs.validate_rate.toFixed(0)}% valid
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CounterfactualTable
          entries={topMisses}
          label="Top Misses (T+20 > 10%)"
          emptyText="No missed opportunities found"
          colorFn={() => "text-destructive"}
        />
        <CounterfactualTable
          entries={topGoodRejections}
          label="Good Rejections (T+20 < 0%)"
          emptyText="No validated rejections found"
          colorFn={() => "text-success"}
        />
      </div>
    </section>
  )
}

// --- Ticker Search Bar ---

function TickerSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (ticker: string) => void
}) {
  const [input, setInput] = useState(value)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange(val.trim().toUpperCase())
    }, 300)
  }

  const handleClear = () => {
    setInput("")
    if (timerRef.current) clearTimeout(timerRef.current)
    onChange("")
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={input}
          onChange={handleChange}
          placeholder="Filter by ticker..."
          className={cn(
            "h-9 w-44 rounded-md border border-border bg-card pl-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
            value ? "pr-8" : "pr-3"
          )}
          aria-label="Filter by ticker"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear ticker filter"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// --- Decisions Page ---

function DecisionsPage() {
  const { ticker } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isLoading, isError, error, refetch } = useDecisions(ticker || undefined)

  if (isLoading) return <DecisionsSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load decisions data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Decisions</h1>
        <TickerSearch
          value={ticker}
          onChange={(t) => navigate({ search: { ticker: t } })}
        />
      </div>

      {data?.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}

      {/* Reasoning Log & Scoring Breakdown (Story 6.2) */}
      <div aria-live="polite">
        {data?.decisions_error ? (
          <ErrorCard error={data.decisions_error} onRetry={() => refetch()} />
        ) : data?.decisions && data.decisions.length > 0 ? (
          <DecisionsTable
            decisions={data.decisions}
            predictions={data?.predictions ?? []}
          />
        ) : (
          <DecisionsEmptyState />
        )}
      </div>

      {/* Predictions error (independent section) */}
      {data?.predictions_error && (
        <div aria-live="polite">
          <ErrorCard error={data.predictions_error} onRetry={() => refetch()} />
        </div>
      )}

      {/* Counterfactual Analysis (Story 6.3) */}
      <div aria-live="polite">
        {data?.counterfactuals_error ? (
          <ErrorCard error={data.counterfactuals_error} onRetry={() => refetch()} />
        ) : data?.counterfactuals ? (
          <CounterfactualSection
            topMisses={data.counterfactuals.top_misses}
            topGoodRejections={data.counterfactuals.top_good_rejections}
          />
        ) : null}
      </div>
    </div>
  )
}

function DecisionsEmptyState() {
  return (
    <section aria-label="Recent Decisions">
      <h2 className="mb-3 text-base font-semibold">Recent Decisions</h2>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Brain className="mb-3 h-12 w-12 text-muted-foreground" />
        <h3 className="text-base font-medium">No decisions available</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Decision reasoning will appear here when guardian decisions data is available.
        </p>
      </div>
    </section>
  )
}

function DecisionsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-9 w-44" />
      </div>
      {/* Table skeleton */}
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
      {/* Counterfactual skeleton */}
      <div>
        <Skeleton className="mb-3 h-6 w-48" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-[250px] rounded-lg" />
          <Skeleton className="h-[250px] rounded-lg" />
        </div>
      </div>
    </div>
  )
}
