import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowUp, ArrowDown, Minus } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string | number
  trend?: "positive" | "negative" | "neutral"
  subtext?: string
}

const trendConfig = {
  positive: { icon: ArrowUp, color: "text-success", valueColor: "text-success" },
  negative: { icon: ArrowDown, color: "text-destructive", valueColor: "text-destructive" },
  neutral: { icon: Minus, color: "text-muted-foreground", valueColor: "" },
} as const

export function KpiCard({ label, value, trend, subtext }: KpiCardProps) {
  return (
    <Card aria-label={`${label}: ${value}`}>
      <CardContent className="p-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`text-2xl font-bold ${trend ? trendConfig[trend].valueColor : ""}`}>{value}</span>
          {trend && <TrendIcon trend={trend} />}
        </div>
        {subtext && (
          <p className="mt-1 text-xs text-faint-foreground">{subtext}</p>
        )}
      </CardContent>
    </Card>
  )
}

function TrendIcon({ trend }: { trend: "positive" | "negative" | "neutral" }) {
  const { icon: Icon, color } = trendConfig[trend]
  return <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
}

export function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-2 h-8 w-16" />
      </CardContent>
    </Card>
  )
}
