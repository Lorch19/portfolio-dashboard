import { useMemo, useState } from "react"
import {
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import type { HoldingsPosition } from "@/types/holdings"

type SortKey = keyof HoldingsPosition
type SortDirection = "asc" | "desc"

interface HoldingsTableProps {
  positions: HoldingsPosition[]
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "sleeve", label: "Sleeve" },
  { key: "entry_price", label: "Entry" },
  { key: "current_price", label: "Current" },
  { key: "unrealized_pnl", label: "P&L ($)" },
  { key: "unrealized_pnl_pct", label: "P&L (%)" },
  { key: "days_held", label: "Days" },
  { key: "conviction", label: "Conviction" },
  { key: "exit_stage", label: "Exit Stage" },
  { key: "stop_loss", label: "Stop Loss" },
]

function formatCurrency(value: number | null): string {
  if (value == null) return "—"
  return value < 0
    ? `-$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPct(value: number | null): string {
  if (value == null) return "—"
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`
}

function PnlCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>0</span>
      </span>
    )
  }
  const isPositive = value > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        isPositive ? "text-success" : "text-destructive"
      )}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>{formatCurrency(value)}</span>
    </span>
  )
}

function PnlPctCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        <span>0.00%</span>
      </span>
    )
  }
  const isPositive = value > 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        isPositive ? "text-success" : "text-destructive"
      )}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>{formatPct(value)}</span>
    </span>
  )
}

function SleeveBadge({ sleeve }: { sleeve: number }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary-muted px-1.5 py-0.5 text-xs font-medium text-primary">
      Sleeve {sleeve}
    </span>
  )
}

function RiskBadge({
  position,
}: {
  position: HoldingsPosition
}) {
  const { portfolio_heat_contribution, sector_concentration_status } = position

  const badges: { label: string; color: string }[] = []

  if (position.stop_loss != null && position.current_price != null && position.current_price > 0) {
    const distanceToStop = ((position.current_price - position.stop_loss) / position.current_price) * 100
    if (distanceToStop < 0) {
      badges.push({ label: "Below Stop", color: "bg-destructive-muted text-destructive" })
    } else if (distanceToStop < 5) {
      badges.push({ label: "Near Stop", color: "bg-warning-muted text-warning" })
    }
  }

  if (portfolio_heat_contribution != null && portfolio_heat_contribution > 0.2) {
    badges.push({ label: "High Heat", color: "bg-destructive-muted text-destructive" })
  }

  if (sector_concentration_status === "warning") {
    badges.push({ label: "Sector Warning", color: "bg-warning-muted text-warning" })
  } else if (sector_concentration_status === "critical") {
    badges.push({ label: "Sector Critical", color: "bg-destructive-muted text-destructive" })
  }

  const hasAnyRiskData = portfolio_heat_contribution != null || sector_concentration_status != null
  if (badges.length === 0 && hasAnyRiskData) {
    badges.push({ label: "OK", color: "bg-success-muted text-success" })
  }

  if (badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={cn(
            "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
            badge.color
          )}
        >
          {badge.label}
        </span>
      ))}
    </div>
  )
}

function sortPositions(
  positions: HoldingsPosition[],
  sortKey: SortKey,
  sortDirection: SortDirection
): HoldingsPosition[] {
  return [...positions].sort((a, b) => {
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
}

function MobileCardView({
  positions,
  sortKey,
  sortDirection,
}: {
  positions: HoldingsPosition[]
  sortKey: SortKey
  sortDirection: SortDirection
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const sorted = useMemo(() => sortPositions(positions, sortKey, sortDirection), [positions, sortKey, sortDirection])

  return (
    <div className="space-y-3 md:hidden">
      {sorted.map((pos) => {
        const cardKey = `${pos.ticker}-${pos.sleeve}`
        const isExpanded = expandedKey === cardKey
        return (
          <Card key={cardKey} size="sm">
            <CardContent
              className="cursor-pointer p-3"
              onClick={() =>
                setExpandedKey(isExpanded ? null : cardKey)
              }
              role="button"
              aria-expanded={isExpanded}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setExpandedKey(isExpanded ? null : cardKey)
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{pos.ticker}</span>
                  <SleeveBadge sleeve={pos.sleeve} />
                </div>
                <div className="flex items-center gap-2">
                  <PnlCell value={pos.unrealized_pnl} />
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Entry Price</span>
                      <p>{formatCurrency(pos.entry_price)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current Price</span>
                      <p>{formatCurrency(pos.current_price)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">P&L (%)</span>
                      <p><PnlPctCell value={pos.unrealized_pnl_pct} /></p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Days Held</span>
                      <p>{pos.days_held}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Conviction</span>
                      <p className="capitalize">{pos.conviction}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Exit Stage</span>
                      <p className="capitalize">{pos.exit_stage ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Stop Loss</span>
                      <p>{formatCurrency(pos.stop_loss)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Shares</span>
                      <p>{pos.shares}</p>
                    </div>
                  </div>
                  <RiskBadge position={pos} />
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function HoldingsTable({ positions }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("ticker")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("asc")
    }
  }

  const sorted = useMemo(() => sortPositions(positions, sortKey, sortDirection), [positions, sortKey, sortDirection])

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none px-2 py-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
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
              <th className="px-2 py-2 text-left text-sm font-semibold text-muted-foreground">
                Risk
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((pos, i) => (
              <tr
                key={`${pos.ticker}-${pos.sleeve}`}
                className={cn(
                  "h-10 border-b border-border/50",
                  i % 2 === 1 && "bg-muted/50"
                )}
              >
                <td className="px-2 py-1 font-medium">{pos.ticker}</td>
                <td className="px-2 py-1">
                  <SleeveBadge sleeve={pos.sleeve} />
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {formatCurrency(pos.entry_price)}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {formatCurrency(pos.current_price)}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  <PnlCell value={pos.unrealized_pnl} />
                </td>
                <td className="px-2 py-1 tabular-nums">
                  <PnlPctCell value={pos.unrealized_pnl_pct} />
                </td>
                <td className="px-2 py-1 tabular-nums">{pos.days_held}</td>
                <td className="px-2 py-1 capitalize">{pos.conviction}</td>
                <td className="px-2 py-1 capitalize">
                  {pos.exit_stage ?? "—"}
                </td>
                <td className="px-2 py-1 tabular-nums">
                  {formatCurrency(pos.stop_loss)}
                </td>
                <td className="px-2 py-1">
                  <RiskBadge position={pos} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <MobileCardView
        positions={positions}
        sortKey={sortKey}
        sortDirection={sortDirection}
      />
    </>
  )
}
