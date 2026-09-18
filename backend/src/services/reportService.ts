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

export const REPORT_TITLES: Record<ReportType, string> = {
  vendas: "Relatório de Vendas",
  despesas: "Relatório de Despesas",
  lucro: "Relatório de Lucro",
  custos: "Relatório de Custos",
  pix: "Relatório de Comprovantes PIX",
  trocos: "Relatório de Trocos",
  completo: "Relatório Financeiro Completo",
}
