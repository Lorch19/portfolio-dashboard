import { createFileRoute } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis, Cell } from "recharts"
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  DollarSign,
} from "lucide-react"
import { useCosts } from "@/api/useCosts"
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
  BrokerageTrade,
  ApiCostModel,
} from "@/types/costs"

export const Route = createFileRoute("/costs")({
  component: CostsPage,
})

export { CostsPage as CostsPageComponent }

// --- Chart config ---

const apiCostChartConfig = {
  total_cost: {
    label: "Cost",
    color: "hsl(215, 70%, 55%)",
  },
} satisfies ChartConfig

const MODEL_COLORS = [
  "hsl(215, 70%, 55%)",
  "hsl(152, 60%, 48%)",
  "hsl(35, 90%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(180, 50%, 50%)",
]

// --- Formatters ---

function formatDollar(value: number | null): string {
  if (value == null) return "—"
  return value < 0
    ? `-$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// --- KPI Cards ---

interface KpiItem {
  label: string
  value: string
  rawValue: number | null
  subtext?: string
}

function CostsKpiCards({
  totalCost,
  costPerTrade,
  totalTrades,
  netReturn,
  costAsPct,
  portfolioReturn,
}: {
  totalCost: number
  costPerTrade: number | null
  totalTrades: number
  netReturn: number | null
  costAsPct: number | null
  portfolioReturn: number | null
}) {
  const kpis: KpiItem[] = [
    {
      label: "Total System Cost",
      value: formatDollar(totalCost),
      rawValue: totalCost > 0 ? -totalCost : null,
    },
    {
      label: "Cost per Trade",
      value: formatDollar(costPerTrade),
      rawValue: null,
    },
    {
      label: "Total Trades",
      value: String(totalTrades),
      rawValue: null,
    },
    {
      label: "Portfolio Return",
      value: portfolioReturn != null ? formatDollar(portfolioReturn) : "—",
      rawValue: portfolioReturn,
    },
    {
      label: "Net Return After Costs",
      value: formatDollar(netReturn),
      rawValue: netReturn,
    },
    {
      label: "Cost as % of Returns",
      value: costAsPct != null ? `${costAsPct.toFixed(2)}%` : "—",
      rawValue: costAsPct != null ? -costAsPct : null,
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
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// --- Date Range Picker ---

function DateRangePicker({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
}: {
  startDate: string
  endDate: string
  onStartChange: (v: string) => void
  onEndChange: (v: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-muted-foreground">From</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
      />
      <label className="text-sm text-muted-foreground">To</label>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
      />
      {(startDate || endDate) && (
        <button
          onClick={onClear}
          className="rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  )
}

// --- Brokerage Trades Table ---

type TradeSortKey = "ticker" | "trade_date" | "action" | "estimated_cost"
type SortDirection = "asc" | "desc"

const TRADE_COLUMNS: { key: TradeSortKey; label: string }[] = [
  { key: "ticker", label: "Ticker" },
  { key: "trade_date", label: "Date" },
  { key: "action", label: "Entry/Exit" },
  { key: "estimated_cost", label: "Est. Cost ($)" },
]

function BrokerageTable({
  trades,
  cumulativeTotal,
}: {
  trades: BrokerageTrade[]
  cumulativeTotal: number
}) {
  const [sortKey, setSortKey] = useState<TradeSortKey>("trade_date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const sorted = useMemo(() => {
    return [...trades].sort((a, b) => {
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
  }, [trades, sortKey, sortDirection])

  const handleSort = (key: TradeSortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDirection("desc")
    }
  }

  return (
    <section aria-label="Brokerage Fees">
      <h2 className="mb-3 text-base font-semibold">
        Brokerage Fees
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          Cumulative: {formatDollar(cumulativeTotal)}
        </span>
      </h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr>
                  {TRADE_COLUMNS.map((col) => (
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
                {sorted.map((trade, i) => (
                  <tr
                    key={`${trade.ticker}-${trade.trade_date}-${i}`}
                    className={cn(
                      "h-10 border-b border-border/50",
                      i % 2 === 1 && "bg-muted/50"
                    )}
                  >
                    <td className="px-3 py-1 font-medium">{trade.ticker}</td>
                    <td className="px-3 py-1 text-muted-foreground">{trade.trade_date}</td>
                    <td className="px-3 py-1">
                      <span
                        className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                          trade.action === "buy"
                            ? "bg-success/10 text-success"
                            : "bg-destructive/10 text-destructive"
                        )}
                      >
                        {trade.action}
                      </span>
                    </td>
                    <td className="px-3 py-1 tabular-nums">{formatDollar(trade.estimated_cost)}</td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No brokerage trades recorded
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

// --- API Cost Chart ---

function ApiCostChart({
  models,
  cumulativeTotal,
}: {
  models: ApiCostModel[]
  cumulativeTotal: number
}) {
  const data = useMemo(
    () =>
      models.map((m) => ({
        name: m.model_id,
        total_cost: m.total_cost,
        decisions: m.total_decisions,
      })),
    [models]
  )

  return (
    <ChartCard
      title="API Costs by Model"
      subtitle={`Cumulative: ${formatDollar(cumulativeTotal)}`}
      isLoading={false}
      isEmpty={data.length === 0}
    >
      <ChartContainer config={apiCostChartConfig} className="min-h-[180px] w-full md:min-h-[240px]">
        <BarChart data={data} accessibilityLayer>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "hsl(215, 15%, 40%)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            tick={{ fontSize: 11, fill: "hsl(215, 15%, 40%)" }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, props) => (
                  <span>
                    {formatDollar(value as number)} ({props.payload?.decisions ?? 0} decisions)
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="total_cost" radius={[4, 4, 0, 0]}>
            {data.map((_entry, idx) => (
              <Cell key={idx} fill={MODEL_COLORS[idx % MODEL_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  )
}

// --- VPS Cost Card ---

function VpsCostCard({
  monthly,
  cumulative,
}: {
  monthly: number
  cumulative: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">VPS Cost</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Monthly</p>
            <p className="text-2xl font-bold">{formatDollar(monthly)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cumulative</p>
            <p className="text-2xl font-bold">{formatDollar(cumulative)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Costs Page ---

function CostsPage() {
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [strategyId, setStrategyId] = useState("")
  const { data: strategiesData } = useStrategies()
  const { data, isLoading, isError, error, refetch } = useCosts(
    startDate || undefined,
    endDate || undefined,
    strategyId || undefined,
  )

  const strategies = strategiesData?.strategies ?? []

  if (isLoading) return <CostsSkeleton />
  if (isError) {
    return (
      <div className="p-6">
        <ErrorCard
          error={error?.message ?? "Failed to load costs data"}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  if (!data) return <CostsEmptyState />

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Costs</h1>
        <div className="flex flex-wrap items-center gap-3">
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
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onClear={() => {
            setStartDate("")
            setEndDate("")
          }}
        />
        </div>
      </div>

      {data.message && (
        <p className="text-sm text-muted-foreground">{data.message}</p>
      )}

      {/* KPI Summary Cards */}
      <div aria-live="polite">
        <CostsKpiCards
          totalCost={data.total_system_cost}
          costPerTrade={data.cost_per_trade}
          totalTrades={data.total_trades}
          netReturn={data.net_return_after_costs}
          costAsPct={data.cost_as_pct_of_returns}
          portfolioReturn={data.portfolio_return?.total_return ?? null}
        />
      </div>

      {/* Charts Grid: API Costs + VPS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div aria-live="polite">
          {data.api_costs_error ? (
            <ChartCard
              title="API Costs by Model"
              isLoading={false}
              error={data.api_costs_error}
              onRetry={() => refetch()}
            >
              <div />
            </ChartCard>
          ) : data.api_costs ? (
            <ApiCostChart
              models={data.api_costs.per_model}
              cumulativeTotal={data.api_costs.cumulative_total}
            />
          ) : (
            <ChartCard title="API Costs by Model" isLoading={false} isEmpty>
              <div />
            </ChartCard>
          )}
        </div>

        <VpsCostCard
          monthly={data.vps_monthly_cost}
          cumulative={data.vps_cumulative}
        />
      </div>

      {/* Brokerage Fees Table */}
      <div aria-live="polite">
        {data.brokerage_error ? (
          <ErrorCard error={data.brokerage_error} onRetry={() => refetch()} />
        ) : data.brokerage ? (
          <BrokerageTable
            trades={data.brokerage.trades}
            cumulativeTotal={data.brokerage.cumulative_total}
          />
        ) : (
          <BrokerageEmptyState />
        )}
      </div>
    </div>
  )
}

function CostsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <DollarSign className="mb-3 h-12 w-12 text-muted-foreground" />
      <h2 className="text-base font-medium">No cost data available</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cost metrics will appear here when trade and API data is available.
      </p>
    </div>
  )
}

function BrokerageEmptyState() {
  return (
    <section aria-label="Brokerage Fees">
      <h2 className="mb-3 text-base font-semibold">Brokerage Fees</h2>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <DollarSign className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">No brokerage data available</p>
      </div>
    </section>
  )
}

function CostsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-7 w-24" />
      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[180px] rounded-lg" />
      </div>
      {/* Table skeleton */}
      <div>
        <Skeleton className="mb-3 h-6 w-36" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    </div>
  )
}
