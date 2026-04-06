import type { FunnelDrilldownEntry } from "@/types/funnel"
import { Card, CardContent } from "@/components/ui/card"

interface DrilldownTableProps {
  entries: FunnelDrilldownEntry[]
  selectedStage: string
}

export function DrilldownTable({ entries, selectedStage }: DrilldownTableProps) {
  const filtered = entries.filter((e) => e.stage === selectedStage)

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            No drill-down entries for this stage.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Stage drill-down details">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-2 font-medium">Ticker</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((entry, i) => (
              <tr key={`${entry.ticker}-${i}`}>
                <td className="whitespace-nowrap px-4 py-2 font-medium">
                  {entry.ticker}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                  {entry.stage}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {entry.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
