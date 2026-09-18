import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { REPORT_TYPES, getReportData, type ReportType } from "../services/reportService"
import { buildExcelReport } from "../services/excelReportService"
import { buildPdfReport } from "../services/pdfReportService"

const router = Router()

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD")
const querySchema = z.object({
  from: dateStr,
  to: dateStr,
  format: z.enum(["pdf", "excel"]),
})

router.get("/:type", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const type = z.enum(REPORT_TYPES).parse(req.params.type) as ReportType
    const q = querySchema.parse(req.query)
    const data = await getReportData(pool, type, { from: q.from, to: q.to })

    const filename = `${type}_${q.from}_a_${q.to}`

    if (q.format === "excel") {
      const buffer = await buildExcelReport(type, data)
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`)
      res.send(buffer)
      return
    }

    const buffer = await buildPdfReport(type, data)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
})

export default router
