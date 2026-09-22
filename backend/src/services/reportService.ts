import type { Pool } from "pg"
import {
  type Period,
  dateConditionSQL,
  getExpensesByCategory,
  getPixReceiptsSummary,
  getProductBreakdown,
  getSummary,
} from "./financeQueries"

export const REPORT_TYPES = ["vendas", "despesas", "lucro", "custos", "pix", "trocos", "completo"] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export async function getSalesRows(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("sale_datetime", params, period)
  const result = await pool.query(
    `SELECT sale_number, sale_datetime, customer_name, payment_method, subtotal_cents, discount_cents,
            total_cents, total_cost_cents, status
     FROM sales WHERE deleted_at IS NULL AND ${condition} ORDER BY sale_datetime ASC`,
    params
  )
  return result.rows
}

export async function getExpenseRows(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("expense_date", params, period)
  const result = await pool.query(
    `SELECT description, category, amount_cents, expense_date, payment_method, note
     FROM expenses WHERE deleted_at IS NULL AND ${condition} ORDER BY expense_date ASC`,
    params
  )
  return result.rows
}

export async function getPixRows(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("receipt_datetime", params, period)
  const result = await pool.query(
    `SELECT pr.amount_cents, pr.receipt_datetime, pr.status, s.sale_number
     FROM pix_receipts pr LEFT JOIN sales s ON s.id = pr.sale_id
     WHERE pr.deleted_at IS NULL AND ${condition} ORDER BY pr.receipt_datetime ASC`,
    params
  )
  return result.rows
}

export async function getChangeRows(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("sale_datetime", params, period)
  const result = await pool.query(
    `SELECT sale_number, sale_datetime, customer_name, total_cents, amount_received_cents, change_cents
     FROM sales
     WHERE status = 'concluida' AND deleted_at IS NULL AND payment_method = 'dinheiro' AND change_cents > 0 AND ${condition}
     ORDER BY sale_datetime ASC`,
    params
  )
  return result.rows
}

export async function getReportData(pool: Pool, type: ReportType, period: Period) {
  switch (type) {
    case "vendas": {
      const [summary, sales] = await Promise.all([getSummary(pool, period), getSalesRows(pool, period)])
      return { type, period, summary, sales }
    }
    case "despesas": {
      const [byCategory, expenses] = await Promise.all([getExpensesByCategory(pool, period), getExpenseRows(pool, period)])
      const totalCents = expenses.reduce((sum, e) => sum + e.amount_cents, 0)
      return { type, period, totalCents, byCategory, expenses }
    }
    case "lucro": {
      const summary = await getSummary(pool, period)
      return { type, period, summary }
    }
    case "custos": {
      const [summary, products] = await Promise.all([getSummary(pool, period), getProductBreakdown(pool, period)])
      return {
        type,
        period,
        totalCostCents: summary.totalCostCents,
        products: products
          .filter((p) => p.quantitySold > 0)
          .map((p) => ({ ...p, costCents: p.revenueCents - p.profitCents })),
      }
    }
    case "pix": {
      const [byStatus, receipts] = await Promise.all([getPixReceiptsSummary(pool, period), getPixRows(pool, period)])
      return { type, period, byStatus, receipts }
    }
    case "trocos": {
      const sales = await getChangeRows(pool, period)
      const totalChangeCents = sales.reduce((sum, s) => sum + s.change_cents, 0)
      return { type, period, totalChangeCents, sales }
    }
    case "completo": {
      const [summary, expensesByCategory, pixByStatus, products] = await Promise.all([
        getSummary(pool, period),
        getExpensesByCategory(pool, period),
        getPixReceiptsSummary(pool, period),
        getProductBreakdown(pool, period),
      ])
      return {
        type,
        period,
        summary,
        expensesByCategory,
        pixByStatus,
        topProducts: products.filter((p) => p.quantitySold > 0).slice(0, 10),
      }
    }
  }
}

export async function getWeekSalesReportData(pool: Pool, weekId: string) {
  const weekResult = await pool.query(
    `SELECT id, name, created_at FROM sale_weeks WHERE id = $1 AND deleted_at IS NULL`,
    [weekId]
  )
  const week = weekResult.rows[0]
  if (!week) return null

  const salesResult = await pool.query(
    `SELECT sale_number, sale_datetime, customer_name, payment_method, subtotal_cents, discount_cents,
            total_cents, total_cost_cents, status
     FROM sales WHERE week_id = $1 AND deleted_at IS NULL ORDER BY sale_datetime ASC`,
    [weekId]
  )
  const sales = salesResult.rows

  // "Período" aqui é só pra exibir no cabeçalho do relatório (a semana não é
  // um intervalo de datas fixo, é um agrupamento manual de vendas): usa a
  // data da primeira e da última venda da semana, e cai pra data de criação
  // da semana quando ainda não há nenhuma venda registrada nela.
  const rangeResult = await pool.query(
    `SELECT MIN(sale_datetime)::date AS from_date, MAX(sale_datetime)::date AS to_date
     FROM sales WHERE week_id = $1 AND deleted_at IS NULL`,
    [weekId]
  )
  const range = rangeResult.rows[0]
  const toDateStr = (value: Date) => value.toISOString().slice(0, 10)
  const from = range.from_date ? toDateStr(range.from_date) : toDateStr(week.created_at)
  const to = range.to_date ? toDateStr(range.to_date) : toDateStr(week.created_at)

  const completed = sales.filter((s) => s.status === "concluida")
  const revenueCents = completed.reduce((sum, s) => sum + s.total_cents, 0)
  const totalCostCents = completed.reduce((sum, s) => sum + s.total_cost_cents, 0)
  const grossProfitCents = revenueCents - totalCostCents
  const salesCount = completed.length
  const cashRevenueCents = completed.filter((s) => s.payment_method === "dinheiro").reduce((sum, s) => sum + s.total_cents, 0)
  const pixRevenueCents = completed.filter((s) => s.payment_method === "pix").reduce((sum, s) => sum + s.total_cents, 0)
  const cardRevenueCents = completed.filter((s) => s.payment_method === "cartao").reduce((sum, s) => sum + s.total_cents, 0)

  const summary = {
    salesCount,
    revenueCents,
    totalCostCents,
    grossProfitCents,
    // Semana não carrega despesas próprias (só vendas), então lucro líquido
    // aqui é igual ao lucro bruto — não é um "esquecimento", é o escopo do
    // relatório por semana.
    expensesCents: 0,
    netProfitCents: grossProfitCents,
    profitMarginPct: revenueCents > 0 ? Math.round((grossProfitCents / revenueCents) * 10000) / 100 : null,
    averageTicketCents: salesCount > 0 ? Math.round(revenueCents / salesCount) : null,
    averageCostPerSaleCents: salesCount > 0 ? Math.round(totalCostCents / salesCount) : null,
    cashRevenueCents,
    pixRevenueCents,
    cardRevenueCents,
    cashReceivedGrossCents: 0,
    changeGivenCents: 0,
    hasData: salesCount > 0,
  }

  return { type: "vendas" as const, weekName: week.name as string, period: { from, to }, summary, sales }
}

export const REPORT_TITLES: Record<ReportType, string> = {
  vendas: "Relatório de Vendas",
  despesas: "Relatório de Despesas",
  lucro: "Relatório de Lucro",
  custos: "Relatório de Custos",
  pix: "Relatório de Comprovantes PIX",
  trocos: "Relatório de Trocos",
  completo: "Relatório Financeiro Completo",
}
