import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

interface ErrorCardProps {
  error: string
  onRetry?: () => void
}

export function ErrorCard({ error, onRetry }: ErrorCardProps) {
  return (
    <Card role="alert" className="border-destructive/50 bg-destructive-muted">
      <CardContent className="flex items-center gap-3 p-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        <p className="flex-1 text-sm text-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
