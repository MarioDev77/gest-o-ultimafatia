import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { REPORT_TYPES, getReportData, getWeekSalesReportData, type ReportType } from "../services/reportService"
import { buildExcelReport } from "../services/excelReportService"
import { buildPdfReport } from "../services/pdfReportService"

const router = Router()

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD")
const querySchema = z.object({
  from: dateStr,
  to: dateStr,
  format: z.enum(["pdf", "excel"]),
})
const weekQuerySchema = z.object({ format: z.enum(["pdf", "excel"]) })

// Relatório de vendas de uma semana específica (aba Semanas). Diferente da
// rota abaixo: aqui o filtro é o agrupamento manual da semana, não um
// intervalo de datas.
router.get("/semana/:weekId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const weekId = z.string().uuid().parse(req.params.weekId)
    const q = weekQuerySchema.parse(req.query)
    const data = await getWeekSalesReportData(pool, weekId)
    if (!data) return res.status(404).json({ error: "Semana não encontrada" })

    const safeName = data.weekName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
    const filename = `vendas_${safeName}`

    if (q.format === "excel") {
      const buffer = await buildExcelReport("vendas", data)
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`)
      res.send(buffer)
      return
    }

    const buffer = await buildPdfReport("vendas", data)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
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
