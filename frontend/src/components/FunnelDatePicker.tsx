import { Input } from "@/components/ui/input"

interface FunnelDatePickerProps {
  value: string
  onChange: (date: string) => void
}

export function FunnelDatePicker({ value, onChange }: FunnelDatePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="scan-date" className="text-sm text-muted-foreground">
        Scan Date
      </label>
      <Input
        id="scan-date"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </div>
  )
}
