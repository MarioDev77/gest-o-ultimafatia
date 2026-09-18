"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PERIOD_PRESET_LABELS, type PeriodPreset, type DateRange } from "@/lib/period"

const PRESETS: PeriodPreset[] = ["hoje", "ontem", "7dias", "mes-atual", "mes-anterior", "personalizado"]

export function PeriodFilter({
  preset,
  custom,
  onPresetChange,
  onCustomChange,
}: {
  preset: PeriodPreset
  custom: DateRange
  onPresetChange: (preset: PeriodPreset) => void
  onCustomChange: (range: DateRange) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p}
          type="button"
          size="sm"
          variant={preset === p ? "default" : "outline"}
          onClick={() => onPresetChange(p)}
        >
          {PERIOD_PRESET_LABELS[p]}
        </Button>
      ))}
      {preset === "personalizado" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={custom.from}
            max={custom.to}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            className={cn(
              "h-7 rounded-lg border border-input bg-background px-2 text-xs outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50"
            )}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <input
            type="date"
            value={custom.to}
            min={custom.from}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            className={cn(
              "h-7 rounded-lg border border-input bg-background px-2 text-xs outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50"
            )}
          />
        </div>
      )}
    </div>
  )
}
