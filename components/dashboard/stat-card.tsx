import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  tone = "default",
  hint,
}: {
  label: string
  value: string
  icon?: LucideIcon
  isLoading?: boolean
  tone?: "default" | "positive" | "negative"
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
        <CardTitle>{label}</CardTitle>
        {Icon && <Icon className="size-4 text-muted-foreground/60" />}
      </CardHeader>
      <CardContent className="pt-1.5">
        {isLoading ? (
          <Skeleton className="h-7 w-28" />
        ) : (
          <p
            className={cn(
              "text-xl font-semibold tracking-tight tabular-nums md:text-2xl",
              tone === "positive" && "text-emerald-600 dark:text-emerald-400",
              tone === "negative" && "text-destructive"
            )}
          >
            {value}
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
