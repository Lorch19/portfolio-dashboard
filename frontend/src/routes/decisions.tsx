import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo, useRef, useEffect } from "react"
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowLeft,
  Brain,
  ChevronDown,
  ChevronRight,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  BarChart3,
  Users,
} from "lucide-react"
import { useDecisions, useTickerDeepDive } from "@/api/useDecisions"
import { ErrorCard } from "@/components/ErrorCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  Decision,
  Prediction,
  CounterfactualEntry,
  ScoringHistoryEntry,
  RejectionHistoryEntry,
} from "@/types/decisions"

export const Route = createFileRoute("/decisions")({
  validateSearch: (search: Record<string, unknown>) => ({
    ticker: (search.ticker as string) || "",
  }),
  component: DecisionsPage,
})

export { DecisionsPage as DecisionsPageComponent }

// --- Formatters ---

function formatPct(value: number | null | undefined): string {
  if (value == null) return "\u2014"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatNum(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "\u2014"
  return value.toFixed(decimals)
}

function formatUsd(value: number | null | undefined): string {
  if (value == null) return "\u2014"
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

function pnlColor(value: number | null | undefined): string {
  if (value == null) return "text-muted-foreground"
  return value >= 0 ? "text-success" : "text-destructive"
}

// --- Decision Detail Sections (outcome-first) ---

function OutcomeSection({ decision }: { decision: Decision }) {
  if (decision.pnl_pct == null) return null

  const alpha =
    decision.pnl_pct != null && decision.sp500_return_same_period != null
      ? decision.pnl_pct - decision.sp500_return_same_period
      : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">Outcome</p>
      </div>

      <div className="flex flex-wrap items-baseline gap-6">
        <div>
          <p className="text-xs text-muted-foreground">P&L</p>
          <p className={cn("text-2xl font-bold tabular-nums", pnlColor(decision.pnl_pct))}>
            {formatPct(decision.pnl_pct)}
          </p>
        </div>
        {alpha != null && (
          <div>
            <p className="text-xs text-muted-foreground">Alpha vs SPY</p>
            <p className={cn("text-lg font-semibold tabular-nums", pnlColor(alpha))}>
              {formatPct(alpha)}
            </p>
          </div>
        )}
        {decision.realized_rr != null && (
          <div>
            <p className="text-xs text-muted-foreground">Risk:Reward</p>
            <p className="text-lg font-semibold tabular-nums">{formatNum(decision.realized_rr, 1)}x</p>
          </div>
        )}
        {decision.max_favorable_excursion_pct != null && (
          <div>
            <p className="text-xs text-muted-foreground">Max Favorable</p>
            <p className="text-lg font-semibold tabular-nums text-success">
              {formatPct(decision.max_favorable_excursion_pct)}
            </p>
          </div>
        )}
        {decision.days_held != null && (
          <div>
            <p className="text-xs text-muted-foreground">Days Held</p>
            <p className="text-lg font-semibold tabular-nums">{decision.days_held}</p>
          </div>
        )}
      </div>

      {(decision.exit_trigger || decision.exit_reason) && (
        <div className="flex flex-wrap gap-4 text-sm">
          {decision.exit_trigger && (
            <div>
              <span className="text-muted-foreground">Exit trigger: </span>
              <span className="font-medium">{decision.exit_trigger}</span>
            </div>
          )}
          {decision.exit_reason && (
            <div>
              <span className="text-muted-foreground">Reason: </span>
              <span>{decision.exit_reason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ThesisSection({ decision }: { decision: Decision }) {
  const hasContent = decision.thesis_full_text || decision.primary_catalyst || decision.invalidation_trigger || decision.moat_thesis
  if (!hasContent) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Investment Thesis</p>

      {decision.thesis_full_text && (
        <p className="max-h-32 overflow-y-auto text-sm leading-relaxed">{decision.thesis_full_text}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decision.primary_catalyst && (
          <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2">
            <p className="text-xs font-medium text-success">Primary Catalyst</p>
            <p className="mt-0.5 text-sm">{decision.primary_catalyst}</p>
          </div>
        )}
        {decision.invalidation_trigger && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
            <p className="text-xs font-medium text-destructive">Invalidation Trigger</p>
            <p className="mt-0.5 text-sm">{decision.invalidation_trigger}</p>
          </div>
        )}
        {decision.moat_thesis && (
          <div className="rounded-md border border-border/50 bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Moat</p>
            <p className="mt-0.5 text-sm">{decision.moat_thesis}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ScoringDashboard({ decision }: { decision: Decision }) {
  const [showMore, setShowMore] = useState(false)

  const fScore = decision.fundamental_score
  const fScoreColor =
    fScore != null ? (fScore >= 7 ? "text-success" : fScore >= 5 ? "text-warning" : "text-destructive") : ""

  const rsiColor =
    decision.rsi != null ? (decision.rsi < 30 ? "text-success" : decision.rsi > 70 ? "text-destructive" : "") : ""

  const primaryItems = [
    {
      label: "F-Score",
      value: formatNum(fScore, 0),
      color: fScoreColor,
    },
    {
      label: "ROIC",
      value: formatPct(decision.roic_at_scan),
      trend: decision.roic_delta,
    },
    {
      label: "RSI",
      value: formatNum(decision.rsi, 1),
      color: rsiColor,
    },
    {
      label: "P/E Discount",
      value: formatPct(decision.pe_discount_pct),
      color: decision.pe_discount_pct != null && decision.pe_discount_pct < 0 ? "text-success" : "",
    },
    {
      label: "Rel Strength",
      value: formatNum(decision.relative_strength, 2),
    },
    {
      label: "Valuation",
      value: decision.valuation_verdict ?? "\u2014",
      isBadge: true,
    },
  ]

  const secondaryItems = [
    { label: "M-Score", value: formatNum(decision.beneish_m_score, 1) },
    { label: "Z-Score", value: formatNum(decision.altman_z_score, 1) },
    { label: "Michael Quality", value: formatNum(decision.michael_quality_score, 1) },
    { label: "Momentum", value: formatNum(decision.momentum_at_scan, 1) },
    { label: "ATR", value: formatNum(decision.atr, 2) },
    { label: "Volume Ratio", value: formatNum(decision.volume_ratio, 2) },
  ]

  const hasSecondary = secondaryItems.some((item) => item.value !== "\u2014")
  const hasPrimary = primaryItems.some((item) => item.value !== "\u2014")
  if (!hasPrimary) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">Scoring Dashboard</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {primaryItems.map((item) => (
          <div key={item.label}>
            <p className="text-muted-foreground">{item.label}</p>
            <div className="flex items-center gap-1">
              {item.isBadge && item.value !== "\u2014" ? (
                <span className={cn(
                  "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                  item.value === "undervalued" ? "bg-success/10 text-success" :
                  item.value === "overvalued" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-foreground"
                )}>{item.value}</span>
              ) : (
                <p className={cn("font-medium tabular-nums", item.color)}>{item.value}</p>
              )}
              {"trend" in item && item.trend != null && (
                item.trend > 0 ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : item.trend < 0 ? (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {hasSecondary && (
        <>
          <button
            onClick={() => setShowMore(!showMore)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {showMore ? "Show less" : "Show more metrics"}
          </button>
          {showMore && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {secondaryItems.map((item) => (
                <div key={item.label}>
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className="font-medium tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DecisionQualitySection({ decision }: { decision: Decision }) {
  const hasContent =
    decision.critique_quality_score != null ||
    decision.critique_changed_decision != null ||
    decision.decided_by_model
  if (!hasContent) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">Decision Quality</p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        {decision.critique_quality_score != null && (
          <div className="min-w-[120px]">
            <p className="text-xs text-muted-foreground">Critique Score</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(decision.critique_quality_score / 10) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums">{decision.critique_quality_score}/10</span>
            </div>
          </div>
        )}

        {decision.critique_changed_decision != null && (
          <div>
            <p className="text-xs text-muted-foreground">Critique Effect</p>
            <span
              className={cn(
                "mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                decision.critique_changed_decision
                  ? "bg-warning/10 text-warning"
                  : "bg-success/10 text-success"
              )}
            >
              {decision.critique_changed_decision ? "Changed Decision" : "Confirmed"}
            </span>
          </div>
        )}

        {decision.decided_by_model && (
          <div>
            <p className="text-xs text-muted-foreground">Model</p>
            <p className="mt-1 font-mono text-sm">{decision.decided_by_model}</p>
          </div>
        )}

        {decision.challenge_gate_result && (
          <div>
            <p className="text-xs text-muted-foreground">Challenge Gate</p>
            <span
              className={cn(
                "mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                decision.challenge_gate_result === "passed"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {decision.challenge_gate_result}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function BearCaseSection({ decision }: { decision: Decision }) {
  const hasContent = decision.bear_case_text || decision.pre_mortem_text
  if (!hasContent) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">Bear Case & Pre-Mortem</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {decision.bear_case_text && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
            <p className="text-xs font-medium text-destructive">Bear Case</p>
            <p className="mt-0.5 text-sm">{decision.bear_case_text}</p>
          </div>
        )}
        {decision.pre_mortem_text && (
          <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2">
            <p className="text-xs font-medium text-warning">Pre-Mortem</p>
            <p className="mt-0.5 text-sm">{decision.pre_mortem_text}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InsiderSignalsSection({ decision }: { decision: Decision }) {
  if (!decision.insider_signal) return null

  const signalColor =
    decision.insider_signal === "buy"
      ? "bg-success/10 text-success"
      : decision.insider_signal === "sell"
        ? "bg-destructive/10 text-destructive"
        : "bg-muted text-foreground"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground">Insider Signals</p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Signal</p>
          <span className={cn("mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium", signalColor)}>
            {decision.insider_signal}
          </span>
        </div>
        {decision.insider_net_value_usd != null && (
          <div>
            <p className="text-xs text-muted-foreground">Net Value</p>
            <p className="mt-1 text-sm font-medium tabular-nums">{formatUsd(decision.insider_net_value_usd)}</p>
          </div>
        )}
        {decision.insider_buy_cluster != null && (
          <div>
            <p className="text-xs text-muted-foreground">Buy Cluster</p>
            <span
              className={cn(
                "mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                decision.insider_buy_cluster ? "bg-success/10 text-success" : "bg-muted text-foreground"
              )}
            >
              {decision.insider_buy_cluster ? "Yes" : "No"}
            </span>
          </div>
        )}
      </div>
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

// --- Decision Detail Panel (outcome-first ordering) ---

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

  const hasClosed = decision.pnl_pct != null

  return (
    <div className="space-y-5 border-t border-border/50 bg-muted/30 px-4 py-5">
      {/* Order: Outcome first for closed, Thesis first for open */}
      {hasClosed ? (
        <>
          <OutcomeSection decision={decision} />
          <ThesisSection decision={decision} />
        </>
      ) : (
        <ThesisSection decision={decision} />
      )}

      <ScoringDashboard decision={decision} />
      <DecisionQualitySection decision={decision} />
      <BearCaseSection decision={decision} />
      <InsiderSignalsSection decision={decision} />

      {/* Prediction Log */}
      {tickerPredictions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Prediction Log</p>
          <PredictionsList predictions={tickerPredictions} />
        </div>
      )}
    </div>
  )
}

// --- Decisions Table ---

type DecisionSortKey = "ticker" | "scan_date" | "decision_tier" | "conviction" | "decision" | "pnl_pct"
type SortDirection = "asc" | "desc"

const DECISION_COLUMNS: { key: DecisionSortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "scan_date", label: "Date" },
  { key: "decision", label: "Decision" },
  { key: "conviction", label: "Conv" },
  { key: "decision_tier", label: "Sleeve" },
  { key: "pnl_pct", label: "P&L" },
]

function DecisionsTable({
  decisions,
  predictions,
  onTickerClick,
}: {
  decisions: Decision[]
  predictions: Prediction[]
  onTickerClick?: (ticker: string) => void
}) {
  const [sortKey, setSortKey] = useState<DecisionSortKey>("scan_date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const sorted = useMemo(() => {
    return [...decisions].sort((a, b) => {
      const aVal = sortKey === "pnl_pct" ? a.pnl_pct : a[sortKey]
      const bVal = sortKey === "pnl_pct" ? b.pnl_pct : b[sortKey]
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
                    Alpha
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
                    onTickerClick={onTickerClick}
                  />
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
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
                onTickerClick={onTickerClick}
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
  onTickerClick,
}: {
  decision: Decision
  predictions: Prediction[]
  index: number
  isExpanded: boolean
  onToggle: () => void
  onTickerClick?: (ticker: string) => void
}) {
  const decisionColor = decision.decision === "approve" || decision.decision === "trade_entry"
    ? "bg-success/10 text-success"
    : decision.decision === "reject"
      ? "bg-destructive/10 text-destructive"
      : "bg-muted text-foreground"

  const alpha =
    decision.pnl_pct != null && decision.sp500_return_same_period != null
      ? decision.pnl_pct - decision.sp500_return_same_period
      : null

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
        <td className="px-3 py-1">
          {onTickerClick ? (
            <button
              className="font-medium text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                onTickerClick(decision.ticker)
              }}
            >
              {decision.ticker}
            </button>
          ) : (
            <span className="font-medium">{decision.ticker}</span>
          )}
        </td>
        <td className="px-3 py-1 text-muted-foreground">{decision.scan_date}</td>
        <td className="px-3 py-1">
          <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", decisionColor)}>
            {decision.decision}
          </span>
        </td>
        <td className="px-3 py-1 tabular-nums">{decision.conviction ?? "\u2014"}</td>
        <td className="px-3 py-1 text-xs text-muted-foreground">{decision.sleeve ?? "\u2014"}</td>
        <td className={cn("px-3 py-1 tabular-nums font-medium", pnlColor(decision.pnl_pct))}>
          {formatPct(decision.pnl_pct)}
        </td>
        <td className={cn("px-3 py-1 tabular-nums font-medium", pnlColor(alpha))}>
          {formatPct(alpha)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
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
  onTickerClick,
}: {
  decision: Decision
  predictions: Prediction[]
  isExpanded: boolean
  onToggle: () => void
  onTickerClick?: (ticker: string) => void
}) {
  const decisionColor = decision.decision === "approve" || decision.decision === "trade_entry"
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
            {onTickerClick ? (
              <span
                role="link"
                tabIndex={0}
                className="font-medium text-primary hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  onTickerClick(decision.ticker)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation()
                    onTickerClick(decision.ticker)
                  }
                }}
              >
                {decision.ticker}
              </span>
            ) : (
              <span className="font-medium">{decision.ticker}</span>
            )}
            <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-medium", decisionColor)}>
              {decision.decision}
            </span>
            {decision.pnl_pct != null && (
              <span className={cn("ml-auto text-sm font-medium tabular-nums", pnlColor(decision.pnl_pct))}>
                {formatPct(decision.pnl_pct)}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {decision.scan_date}
            {decision.sleeve ? ` \u00B7 ${decision.sleeve}` : ""}
            {decision.conviction ? ` \u00B7 Conv ${decision.conviction}` : ""}
          </p>
        </div>
      </button>
      {isExpanded && (
        <DecisionDetail decision={decision} predictions={predictions} />
      )}
    </div>
  )
}

// --- Counterfactual Tables ---

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
  pendingCount,
}: {
  topMisses: CounterfactualEntry[]
  topGoodRejections: CounterfactualEntry[]
  pendingCount?: number
}) {
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

      {topMisses.length === 0 && topGoodRejections.length === 0 && pendingCount != null && pendingCount > 0 && (
        <p className="mb-4 text-sm text-muted-foreground">
          {pendingCount.toLocaleString()} rejections awaiting forward return data (T+20 not yet computed).
        </p>
      )}

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

// --- Ticker Deep-Dive View ---

function TickerDeepDiveView({
  ticker,
  onBack,
}: {
  ticker: string
  onBack: () => void
}) {
  const { data, isLoading, isError, error, refetch } = useTickerDeepDive(ticker)

  if (isLoading) return <DeepDiveSkeleton ticker={ticker} onBack={onBack} />
  if (isError) {
    return (
      <div className="space-y-4 p-6">
        <DeepDiveHeader ticker={ticker} onBack={onBack} />
        <ErrorCard error={error?.message ?? "Failed to load ticker data"} onRetry={() => refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <DeepDiveHeader ticker={ticker} onBack={onBack} />

      {data?.error && <ErrorCard error={data.error} onRetry={() => refetch()} />}

      {/* Decision Timeline */}
      {data?.decisions && data.decisions.length > 0 && (
        <section aria-label="Decision Timeline">
          <h2 className="mb-3 text-base font-semibold">Decision Timeline</h2>
          <div className="space-y-4">
            {data.decisions.map((d, i) => (
              <Card key={`${d.scan_date}-${i}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{d.scan_date}</span>
                    <span className={cn(
                      "rounded px-1.5 py-0.5 text-xs font-medium",
                      d.decision === "approve" || d.decision === "trade_entry"
                        ? "bg-success/10 text-success"
                        : d.decision === "reject"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-muted text-foreground"
                    )}>{d.decision}</span>
                    {d.pnl_pct != null && (
                      <span className={cn("ml-auto tabular-nums font-medium", pnlColor(d.pnl_pct))}>
                        {formatPct(d.pnl_pct)}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {d.pnl_pct != null && <OutcomeSection decision={d} />}
                  <ThesisSection decision={d} />
                  <ScoringDashboard decision={d} />
                  <DecisionQualitySection decision={d} />
                  <BearCaseSection decision={d} />
                  <InsiderSignalsSection decision={d} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Scoring History + Rejection History (two-column) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {data?.scoring_history && data.scoring_history.length > 0 && (
          <section aria-label="Scoring History">
            <h2 className="mb-3 text-base font-semibold">Scoring History</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <ScoringHistoryTable entries={data.scoring_history} />
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {data?.rejection_history && data.rejection_history.length > 0 && (
          <section aria-label="Rejection History">
            <h2 className="mb-3 text-base font-semibold">Rejection History</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <RejectionHistoryTable entries={data.rejection_history} />
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </div>

      {/* Predictions */}
      {data?.predictions && data.predictions.length > 0 && (
        <section aria-label="Predictions">
          <h2 className="mb-3 text-base font-semibold">Predictions</h2>
          <Card>
            <CardContent className="p-3">
              <PredictionsList predictions={data.predictions} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

function DeepDiveHeader({ ticker, onBack }: { ticker: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Decisions
      </button>
      <h1 className="text-xl font-semibold">{ticker}</h1>
    </div>
  )
}

function ScoringHistoryTable({ entries }: { entries: ScoringHistoryEntry[] }) {
  return (
    <table className="w-full text-sm" role="table">
      <thead>
        <tr>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">F-Score</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">ROIC</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">RSI</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">P/E</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">RS</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr
            key={`${e.scan_date}-${i}`}
            className={cn("h-9 border-b border-border/50", i % 2 === 1 && "bg-muted/50")}
          >
            <td className="px-3 py-1 text-muted-foreground">{e.scan_date}</td>
            <td className={cn(
              "px-3 py-1 tabular-nums font-medium",
              e.fundamental_score != null
                ? e.fundamental_score >= 7 ? "text-success" : e.fundamental_score <= 4 ? "text-destructive" : ""
                : ""
            )}>{formatNum(e.fundamental_score, 0)}</td>
            <td className="px-3 py-1 tabular-nums">{formatPct(e.roic_at_scan)}</td>
            <td className={cn(
              "px-3 py-1 tabular-nums",
              e.rsi != null ? (e.rsi < 30 ? "text-success" : e.rsi > 70 ? "text-destructive" : "") : ""
            )}>{formatNum(e.rsi, 1)}</td>
            <td className="px-3 py-1 tabular-nums">{formatNum(e.pe_at_scan, 1)}</td>
            <td className="px-3 py-1 tabular-nums">{formatNum(e.relative_strength, 2)}</td>
            <td className="px-3 py-1">
              {e.valuation_verdict ? (
                <span className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  e.valuation_verdict === "undervalued" ? "bg-success/10 text-success" :
                  e.valuation_verdict === "overvalued" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-foreground"
                )}>{e.valuation_verdict}</span>
              ) : "\u2014"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function RejectionHistoryTable({ entries }: { entries: RejectionHistoryEntry[] }) {
  return (
    <table className="w-full text-sm" role="table">
      <thead>
        <tr>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Date</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Gate</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Reason</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">T+5</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">T+10</th>
          <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">T+20</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr
            key={`${e.scan_date}-${i}`}
            className={cn("h-9 border-b border-border/50", i % 2 === 1 && "bg-muted/50")}
          >
            <td className="px-3 py-1 text-muted-foreground">{e.scan_date}</td>
            <td className="px-3 py-1">{e.rejected_at_gate}</td>
            <td className="max-w-[180px] truncate px-3 py-1 text-muted-foreground">{e.rejection_reason}</td>
            <td className={cn("px-3 py-1 tabular-nums", pnlColor(e.t_plus_5))}>{formatPct(e.t_plus_5)}</td>
            <td className={cn("px-3 py-1 tabular-nums", pnlColor(e.t_plus_10))}>{formatPct(e.t_plus_10)}</td>
            <td className={cn("px-3 py-1 tabular-nums font-medium", pnlColor(e.t_plus_20))}>{formatPct(e.t_plus_20)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DeepDiveSkeleton({ ticker, onBack }: { ticker: string; onBack: () => void }) {
  return (
    <div className="space-y-6 p-6">
      <DeepDiveHeader ticker={ticker} onBack={onBack} />
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-[300px] rounded-lg" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    </div>
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

  // Deep-dive mode: ticker is set via URL search param
  if (ticker) {
    return (
      <TickerDeepDiveView
        ticker={ticker}
        onBack={() => navigate({ search: { ticker: "" } })}
      />
    )
  }

  return <DecisionsListView />
}

function DecisionsListView() {
  const { ticker } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data, isLoading, isError, error, refetch } = useDecisions(undefined)

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

      {/* Decisions Table */}
      <div aria-live="polite">
        {data?.decisions_error ? (
          <ErrorCard error={data.decisions_error} onRetry={() => refetch()} />
        ) : data?.decisions && data.decisions.length > 0 ? (
          <DecisionsTable
            decisions={data.decisions}
            predictions={data?.predictions ?? []}
            onTickerClick={(t) => navigate({ search: { ticker: t } })}
          />
        ) : (
          <DecisionsEmptyState />
        )}
      </div>

      {/* Predictions error */}
      {data?.predictions_error && (
        <div aria-live="polite">
          <ErrorCard error={data.predictions_error} onRetry={() => refetch()} />
        </div>
      )}

      {/* Counterfactual Analysis */}
      <div aria-live="polite">
        {data?.counterfactuals_error ? (
          <ErrorCard error={data.counterfactuals_error} onRetry={() => refetch()} />
        ) : data?.counterfactuals ? (
          <CounterfactualSection
            topMisses={data.counterfactuals.top_misses}
            topGoodRejections={data.counterfactuals.top_good_rejections}
            pendingCount={data.counterfactuals.pending_count}
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
      <div>
        <Skeleton className="mb-3 h-6 w-40" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
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
