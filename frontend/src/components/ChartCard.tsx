import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorCard } from "@/components/ErrorCard"
import { BarChart3 } from "lucide-react"

interface ChartCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  isLoading: boolean
  error?: string | null
  isEmpty?: boolean
  onRetry?: () => void
}

export function ChartCard({
  title,
  subtitle,
  children,
  isLoading,
  error,
  isEmpty,
  onRetry,
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full rounded-lg max-md:h-[180px]" />
        ) : error ? (
          <ErrorCard error={error} onRetry={onRetry} />
        ) : isEmpty ? (
          <div className="flex h-[240px] flex-col items-center justify-center text-center max-md:h-[180px]">
            <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No data for this period</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Data will appear when portfolio snapshots are available.
            </p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
