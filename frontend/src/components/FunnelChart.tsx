import type { FunnelStages } from "@/types/funnel"
import { cn } from "@/lib/utils"

const STAGE_LABELS: Record<keyof FunnelStages, string> = {
  scout_universe: "Scout Universe",
  scout_passed: "Scout Passed",
  guardian_approved: "Guardian Approved",
  guardian_modified: "Guardian Modified",
  guardian_rejected: "Guardian Rejected",
  michael_traded: "Michael Traded",
}

const STAGE_ORDER: (keyof FunnelStages)[] = [
  "scout_universe",
  "scout_passed",
  "guardian_approved",
  "guardian_modified",
  "guardian_rejected",
  "michael_traded",
]

interface FunnelChartProps {
  stages: FunnelStages
  selectedStage: string | null
  onStageClick: (stage: string) => void
}

export function FunnelChart({
  stages,
  selectedStage,
  onStageClick,
}: FunnelChartProps) {
  const maxCount = Math.max(stages.scout_universe, 1)

  return (
    <div className="space-y-2" role="group" aria-label="Funnel stages">
      {STAGE_ORDER.map((stage) => {
        const count = stages[stage]
        const widthPercent = (count / maxCount) * 100
        const isSelected = selectedStage === stage

        return (
          <button
            key={stage}
            type="button"
            onClick={() => onStageClick(stage)}
            aria-label={`${STAGE_LABELS[stage]}: ${count}`}
            aria-pressed={isSelected}
            className={cn(
              "flex w-full flex-col gap-1 rounded-lg p-2 text-left transition-colors hover:bg-muted/50 md:flex-row md:items-center md:gap-3",
              isSelected && "ring-2 ring-primary bg-muted/30"
            )}
          >
            <span className="shrink-0 text-sm text-muted-foreground md:w-44">
              {STAGE_LABELS[stage]}
            </span>
            <div className="flex w-full items-center gap-3 md:contents">
              <div className="flex-1">
                <div
                  className="h-6 rounded bg-primary transition-all"
                  style={{ width: `${Math.max(widthPercent, 1)}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-sm font-medium tabular-nums">
                {count.toLocaleString()}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
