import type { Pool } from "pg"

export type Period = { from: string; to: string } // YYYY-MM-DD, "to" é inclusivo

function dateConditionSQL(column: string, params: unknown[], period: Period) {
  params.push(period.from)
  const fromIdx = params.length
  params.push(period.to)
  const toIdx = params.length
  return `${column} >= $${fromIdx}::date AND ${column} < ($${toIdx}::date + INTERVAL '1 day')`
}

export type FinancialSummary = {
  salesCount: number
  revenueCents: number
  totalCostCents: number
  grossProfitCents: number
  expensesCents: number
  netProfitCents: number
  profitMarginPct: number | null
  averageTicketCents: number | null
  averageCostPerSaleCents: number | null
  cashRevenueCents: number
  pixRevenueCents: number
  cardRevenueCents: number
  cashReceivedGrossCents: number
  changeGivenCents: number
  hasData: boolean
}

// Todo o financeiro do período parte daqui: vendas concluídas somadas ao lado
// das despesas do mesmo intervalo. "hasData" existe pra regra 15 do pedido —
// se não há vendas nem despesas no período, o frontend mostra o aviso de
// "sem dados", em vez de exibir zeros que parecem um cálculo real.
export async function getSummary(pool: Pool, period: Period): Promise<FinancialSummary> {
  const salesParams: unknown[] = []
  const salesCondition = dateConditionSQL("sale_datetime", salesParams, period)
  const salesResult = await pool.query(
    `SELECT
       COUNT(*)::int AS sales_count,
       COALESCE(SUM(total_cents), 0)::int AS revenue_cents,
       COALESCE(SUM(total_cost_cents), 0)::int AS total_cost_cents,
       COALESCE(SUM(total_cents) FILTER (WHERE payment_method = 'dinheiro'), 0)::int AS cash_revenue_cents,
       COALESCE(SUM(total_cents) FILTER (WHERE payment_method = 'pix'), 0)::int AS pix_revenue_cents,
       COALESCE(SUM(total_cents) FILTER (WHERE payment_method = 'cartao'), 0)::int AS card_revenue_cents,
       COALESCE(SUM(amount_received_cents) FILTER (WHERE payment_method = 'dinheiro'), 0)::int AS cash_received_gross_cents,
       COALESCE(SUM(change_cents), 0)::int AS change_given_cents
     FROM sales
     WHERE status = 'concluida' AND deleted_at IS NULL AND ${salesCondition}`,
    salesParams
  )
  const s = salesResult.rows[0]

  const expensesParams: unknown[] = []
  const expensesCondition = dateConditionSQL("expense_date", expensesParams, period)
  const expensesResult = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS expenses_cents
     FROM expenses WHERE deleted_at IS NULL AND ${expensesCondition}`,
    expensesParams
  )
  const expensesCents = expensesResult.rows[0].expenses_cents as number

  const revenueCents = s.revenue_cents as number
  const totalCostCents = s.total_cost_cents as number
  const salesCount = s.sales_count as number
  const grossProfitCents = revenueCents - totalCostCents
  const netProfitCents = grossProfitCents - expensesCents

  return {
    salesCount,
    revenueCents,
    totalCostCents,
    grossProfitCents,
    expensesCents,
    netProfitCents,
    profitMarginPct: revenueCents > 0 ? Math.round((netProfitCents / revenueCents) * 10000) / 100 : null,
    averageTicketCents: salesCount > 0 ? Math.round(revenueCents / salesCount) : null,
    averageCostPerSaleCents: salesCount > 0 ? Math.round(totalCostCents / salesCount) : null,
    cashRevenueCents: s.cash_revenue_cents,
    pixRevenueCents: s.pix_revenue_cents,
    cardRevenueCents: s.card_revenue_cents,
    cashReceivedGrossCents: s.cash_received_gross_cents,
    changeGivenCents: s.change_given_cents,
    hasData: salesCount > 0 || expensesCents > 0,
  }
}

export async function getQuickStats(pool: Pool) {
  const result = await pool.query(
    `SELECT
       COALESCE(SUM(total_cents) FILTER (WHERE sale_datetime::date = CURRENT_DATE), 0)::int AS revenue_today_cents,
       COALESCE(SUM(total_cents) FILTER (WHERE sale_datetime >= date_trunc('week', CURRENT_DATE)), 0)::int AS revenue_week_cents,
       COALESCE(SUM(total_cents) FILTER (WHERE sale_datetime >= date_trunc('month', CURRENT_DATE)), 0)::int AS revenue_month_cents
     FROM sales WHERE status = 'concluida' AND deleted_at IS NULL`
  )
  const r = result.rows[0]
  return {
    revenueTodayCents: r.revenue_today_cents as number,
    revenueWeekCents: r.revenue_week_cents as number,
    revenueMonthCents: r.revenue_month_cents as number,
  }
}

export type ProductBreakdownRow = {
  productId: string
  name: string
  status: "ativo" | "inativo"
  quantitySold: number
  revenueCents: number
  profitCents: number
}

export async function getProductBreakdown(pool: Pool, period: Period): Promise<ProductBreakdownRow[]> {
  const params: unknown[] = []
  const condition = dateConditionSQL("s.sale_datetime", params, period)
  const result = await pool.query(
    `SELECT p.id, p.name, p.status,
            COALESCE(SUM(si.quantity), 0)::int AS quantity_sold,
            COALESCE(SUM(si.line_total_cents), 0)::int AS revenue_cents,
            COALESCE(SUM(si.line_total_cents - si.unit_cost_cents * si.quantity), 0)::int AS profit_cents
     FROM products p
     LEFT JOIN sale_items si ON si.product_id = p.id
     LEFT JOIN sales s ON s.id = si.sale_id AND s.status = 'concluida' AND s.deleted_at IS NULL AND ${condition}
     WHERE p.deleted_at IS NULL
     GROUP BY p.id, p.name, p.status
     ORDER BY revenue_cents DESC`,
    params
  )
  return result.rows.map((r) => ({
    productId: r.id,
    name: r.name,
    status: r.status,
    quantitySold: r.quantity_sold,
    revenueCents: r.revenue_cents,
    profitCents: r.profit_cents,
  }))
}

export type DailyPoint = {
  date: string
  revenueCents: number
  costCents: number
  expensesCents: number
  grossProfitCents: number
  netProfitCents: number
}

// Série do período agrupada por dia ou por mês, já cruzando vendas e despesas
// pela mesma data — alimenta os gráficos de "vendas por período", "lucro por
// período" e "faturamento x despesas/lucro" com uma única consulta de cada lado.
export async function getDailySeries(pool: Pool, period: Period, groupBy: "day" | "month" = "day"): Promise<DailyPoint[]> {
  const trunc = groupBy === "month" ? "month" : "day"

  const salesParams: unknown[] = []
  const salesCondition = dateConditionSQL("sale_datetime", salesParams, period)
  const salesResult = await pool.query(
    `SELECT date_trunc('${trunc}', sale_datetime)::date AS bucket,
            COALESCE(SUM(total_cents), 0)::int AS revenue_cents,
            COALESCE(SUM(total_cost_cents), 0)::int AS cost_cents
     FROM sales
     WHERE status = 'concluida' AND deleted_at IS NULL AND ${salesCondition}
     GROUP BY bucket ORDER BY bucket`,
    salesParams
  )

  const expensesParams: unknown[] = []
  const expensesCondition = dateConditionSQL("expense_date", expensesParams, period)
  const expensesResult = await pool.query(
    `SELECT date_trunc('${trunc}', expense_date)::date AS bucket,
            COALESCE(SUM(amount_cents), 0)::int AS expenses_cents
     FROM expenses
     WHERE deleted_at IS NULL AND ${expensesCondition}
     GROUP BY bucket ORDER BY bucket`,
    expensesParams
  )

  const byDate = new Map<string, DailyPoint>()
  for (const row of salesResult.rows) {
    const date = (row.bucket as Date).toISOString().slice(0, 10)
    byDate.set(date, {
      date,
      revenueCents: row.revenue_cents,
      costCents: row.cost_cents,
      expensesCents: 0,
      grossProfitCents: row.revenue_cents - row.cost_cents,
      netProfitCents: row.revenue_cents - row.cost_cents,
    })
  }
  for (const row of expensesResult.rows) {
    const date = (row.bucket as Date).toISOString().slice(0, 10)
    const existing = byDate.get(date)
    if (existing) {
      existing.expensesCents = row.expenses_cents
      existing.netProfitCents = existing.grossProfitCents - row.expenses_cents
    } else {
      byDate.set(date, {
        date,
        revenueCents: 0,
        costCents: 0,
        expensesCents: row.expenses_cents,
        grossProfitCents: 0,
        netProfitCents: -row.expenses_cents,
      })
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getExpensesByCategory(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("expense_date", params, period)
  const result = await pool.query(
    `SELECT category, COALESCE(SUM(amount_cents), 0)::int AS amount_cents, COUNT(*)::int AS count
     FROM expenses WHERE deleted_at IS NULL AND ${condition}
     GROUP BY category ORDER BY amount_cents DESC`,
    params
  )
  return result.rows as Array<{ category: string; amount_cents: number; count: number }>
}

export async function getPaymentMethodBreakdown(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("sale_datetime", params, period)
  const result = await pool.query(
    `SELECT payment_method, COALESCE(SUM(total_cents), 0)::int AS revenue_cents, COUNT(*)::int AS count
     FROM sales WHERE status = 'concluida' AND deleted_at IS NULL AND ${condition}
     GROUP BY payment_method ORDER BY revenue_cents DESC`,
    params
  )
  return result.rows as Array<{ payment_method: string; revenue_cents: number; count: number }>
}

export async function getPixReceiptsSummary(pool: Pool, period: Period) {
  const params: unknown[] = []
  const condition = dateConditionSQL("receipt_datetime", params, period)
  const result = await pool.query(
    `SELECT status, COALESCE(SUM(amount_cents), 0)::int AS amount_cents, COUNT(*)::int AS count
     FROM pix_receipts WHERE deleted_at IS NULL AND ${condition}
     GROUP BY status ORDER BY status`,
    params
  )
  return result.rows as Array<{ status: string; amount_cents: number; count: number }>
}

export { dateConditionSQL }
