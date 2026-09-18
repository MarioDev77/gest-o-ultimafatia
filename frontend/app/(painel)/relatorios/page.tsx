"use client"

import { useState } from "react"
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import { resolvePeriod, type DateRange, type PeriodPreset } from "@/lib/period"
import { downloadFile } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { REPORT_TYPE_OPTIONS, type ReportType } from "@/lib/types"

export default function RelatoriosPage() {
  const [preset, setPreset] = useState<PeriodPreset>("mes-atual")
  const [customRange, setCustomRange] = useState<DateRange>(() => resolvePeriod("mes-atual"))
  const [pending, setPending] = useState<string | null>(null)
  const toast = useToast()

  const period = preset === "personalizado" ? customRange : resolvePeriod(preset)

  async function handleDownload(type: ReportType, format: "pdf" | "excel") {
    const key = `${type}-${format}`
    setPending(key)
    try {
      const ext = format === "pdf" ? "pdf" : "xlsx"
      await downloadFile(
        `/api/reports/${type}?from=${period.from}&to=${period.to}&format=${format}`,
        `${type}_${period.from}_a_${period.to}.${ext}`
      )
    } catch {
      toast.add({ title: "Não foi possível gerar o relatório", type: "error" })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Período do relatório</h2>
        <PeriodFilter preset={preset} custom={customRange} onPresetChange={setPreset} onCustomChange={setCustomRange} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPE_OPTIONS.map((report) => (
          <Card key={report.value}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">{report.label}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={pending === `${report.value}-pdf`}
                onClick={() => handleDownload(report.value, "pdf")}
              >
                {pending === `${report.value}-pdf` ? <Loader2 className="size-3.5 animate-spin" /> : <FileDown className="size-3.5" />}
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={pending === `${report.value}-excel`}
                onClick={() => handleDownload(report.value, "excel")}
              >
                {pending === `${report.value}-excel` ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
                Excel
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
