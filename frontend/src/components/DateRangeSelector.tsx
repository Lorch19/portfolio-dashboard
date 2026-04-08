import { useState } from "react"
import { cn } from "@/lib/utils"
import { CalendarPopover } from "./CalendarPopover"

const PRESETS = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "YTD", days: -1 },
  { label: "All", days: 0 },
] as const

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getPresetStartDate(days: number): string {
  if (days === 0) return ""
  const now = new Date()
  if (days === -1) {
    return `${now.getFullYear()}-01-01`
  }
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  return toISODate(start)
}

interface DateRangeSelectorProps {
  startDate: string
  endDate: string
  onStartChange: (v: string) => void
  onEndChange: (v: string) => void
  onClear: () => void
}

export function DateRangeSelector({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClear,
}: DateRangeSelectorProps) {
  const [showCustom, setShowCustom] = useState(false)

  const handlePreset = (days: number) => {
    if (days === 0) {
      onClear()
    } else {
      onStartChange(getPresetStartDate(days))
      onEndChange("")
    }
    setShowCustom(false)
  }

  const activePreset = PRESETS.find((p) => {
    if (p.days === 0) return !startDate && !endDate
    return startDate === getPresetStartDate(p.days) && !endDate
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-md border border-border bg-card">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.days)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium transition-colors",
              "first:rounded-l-md last:rounded-r-md",
              "hover:bg-muted/50",
              activePreset?.label === p.label
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowCustom(!showCustom)}
        className={cn(
          "rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50",
          showCustom || (startDate && !activePreset)
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground"
        )}
      >
        Custom
      </button>

      {(showCustom || (startDate && !activePreset)) && (
        <div className="flex items-center gap-2">
          <CalendarPopover
            value={startDate}
            onChange={onStartChange}
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <CalendarPopover
            value={endDate}
            onChange={onEndChange}
            placeholder="To"
          />
        </div>
      )}
    </div>
  )
}
