import { useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return ""
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

interface CalendarPopoverProps {
  value: string
  onChange: (date: string) => void
  placeholder?: string
}

export function CalendarPopover({
  value,
  onChange,
  placeholder = "Pick date",
}: CalendarPopoverProps) {
  const today = new Date()
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate())

  // Initialize viewed month from value or today
  const initial = value ? new Date(value + "T00:00:00") : today
  const [viewYear, setViewYear] = useState(initial.getFullYear())
  const [viewMonth, setViewMonth] = useState(initial.getMonth())
  const [open, setOpen] = useState(false)

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const selectDay = (day: number) => {
    onChange(toISODate(viewYear, viewMonth, day))
    setOpen(false)
  }

  // Build grid cells: leading empties + days
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:bg-muted/50",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <Calendar className="h-3 w-3" />
        {value ? formatDisplay(value) : placeholder}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4}>
          <Popover.Popup className="z-50 w-64 rounded-lg border border-border bg-card p-3 shadow-lg">
            {/* Month/year header */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={prevMonth}
                className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium">
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                onClick={nextMonth}
                className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0">
              {DAYS.map((d) => (
                <div key={d} className="py-1 text-center text-[10px] font-medium text-muted-foreground">
                  {d}
                </div>
              ))}

              {/* Day cells */}
              {cells.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} />
                }
                const iso = toISODate(viewYear, viewMonth, day)
                const isSelected = iso === value
                const isToday = iso === todayISO

                return (
                  <button
                    key={day}
                    onClick={() => selectDay(day)}
                    className={cn(
                      "mx-auto flex h-7 w-7 items-center justify-center rounded text-xs transition-colors",
                      "hover:bg-muted/50",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                      isToday && !isSelected && "border border-primary/50 text-primary",
                      !isSelected && !isToday && "text-foreground"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
