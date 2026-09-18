import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import {
  getDailySeries,
  getExpensesByCategory,
  getPaymentMethodBreakdown,
  getProductBreakdown,
  getQuickStats,
  getSummary,
} from "../services/financeQueries"

const router = Router()

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD")

const periodQuerySchema = z.object({ from: dateStr, to: dateStr })
const chartsQuerySchema = periodQuerySchema.extend({ groupBy: z.enum(["day", "month"]).default("day") })

// Cards fixos "Faturamento do dia / semana / mês": sempre relativos a hoje,
// independentes do filtro de período escolhido no resto do dashboard.
router.get("/quick-stats", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    res.json(await getQuickStats(pool))
  } catch (error) {
    next(error)
  }
})

router.get("/summary", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const period = periodQuerySchema.parse(req.query)
    res.json(await getSummary(pool, period))
  } catch (error) {
    next(error)
  }
})

router.get("/products", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const period = periodQuerySchema.parse(req.query)
    const rows = await getProductBreakdown(pool, period)

    const withSales = rows.filter((r) => r.quantitySold > 0)
    const bestByQuantity = withSales.length ? withSales.reduce((a, b) => (b.quantitySold > a.quantitySold ? b : a)) : null
    const bestByRevenue = withSales.length ? withSales.reduce((a, b) => (b.revenueCents > a.revenueCents ? b : a)) : null
    const bestByProfit = withSales.length ? withSales.reduce((a, b) => (b.profitCents > a.profitCents ? b : a)) : null

    res.json({
      items: rows,
      bestSellerByQuantity: bestByQuantity?.name ?? null,
      topRevenueProduct: bestByRevenue?.name ?? null,
      topProfitProduct: bestByProfit?.name ?? null,
      hasData: withSales.length > 0,
    })
  } catch (error) {
    next(error)
  }
})

// Um só endpoint alimenta todos os gráficos pedidos (vendas por dia/mês, lucro
// por período, despesas por categoria, faturamento x despesas, faturamento x
// lucro, formas de pagamento, PIX x dinheiro, produtos mais vendidos): a série
// diária/mensal e as duas quebras (categoria, forma de pagamento) cobrem todos
// eles sem duplicar consulta — o frontend escolhe como desenhar cada um.
router.get("/charts", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const q = chartsQuerySchema.parse(req.query)
    const period = { from: q.from, to: q.to }

    const [daily, expensesByCategory, paymentMethods, products] = await Promise.all([
      getDailySeries(pool, period, q.groupBy),
      getExpensesByCategory(pool, period),
      getPaymentMethodBreakdown(pool, period),
      getProductBreakdown(pool, period),
    ])

    const topProducts = [...products]
      .filter((p) => p.quantitySold > 0)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 10)

    res.json({
      daily,
      expensesByCategory,
      paymentMethods,
      topProducts,
      hasData: daily.length > 0 || expensesByCategory.length > 0,
    })
  } catch (error) {
    next(error)
  }
})

export default router
