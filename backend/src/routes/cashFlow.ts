import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { getSummary } from "../services/financeQueries"

const router = Router()

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato YYYY-MM-DD")

const flowQuerySchema = z
  .object({ date: dateStr.optional(), from: dateStr.optional(), to: dateStr.optional() })
  .refine((v) => v.date || (v.from && v.to), { message: "Informe 'date' ou 'from' e 'to'" })

// GET /?date=YYYY-MM-DD  -> fluxo de um único dia
// GET /?from=...&to=...  -> fluxo do período (saldo inicial = abertura do dia "from", se houver)
router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const q = flowQuerySchema.parse(req.query)
    const from = q.date ?? q.from!
    const to = q.date ?? q.to!

    const [summary, openingResult] = await Promise.all([
      getSummary(pool, { from, to }),
      pool.query("SELECT opening_balance_cents FROM cash_openings WHERE opening_date = $1", [from]),
    ])

    const openingBalanceCents = openingResult.rows[0]?.opening_balance_cents ?? 0

    // Entradas: vendas em dinheiro (valor líquido), PIX e cartão. Saídas: despesas e troco entregue.
    const inflows = {
      cashSalesCents: summary.cashRevenueCents,
      pixCents: summary.pixRevenueCents,
      cardCents: summary.cardRevenueCents,
      totalCents: summary.cashRevenueCents + summary.pixRevenueCents + summary.cardRevenueCents,
    }
    const outflows = {
      expensesCents: summary.expensesCents,
      changeGivenCents: summary.changeGivenCents,
      totalCents: summary.expensesCents + summary.changeGivenCents,
    }
    const closingBalanceCents = openingBalanceCents + inflows.totalCents - outflows.totalCents

    res.json({
      from,
      to,
      openingBalanceCents,
      inflows,
      outflows,
      closingBalanceCents,
      hasData: summary.hasData,
    })
  } catch (error) {
    next(error)
  }
})

const openingSchema = z.object({
  date: dateStr,
  openingBalanceCents: z.number().int().min(0).max(1_000_000_00),
  note: z.string().trim().max(500).optional(),
})

router.put("/opening", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = openingSchema.parse(req.body)
    const result = await pool.query(
      `INSERT INTO cash_openings (opening_date, opening_balance_cents, note, created_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (opening_date) DO UPDATE
         SET opening_balance_cents = EXCLUDED.opening_balance_cents, note = EXCLUDED.note, updated_at = NOW()
       RETURNING id, opening_date, opening_balance_cents, note, updated_at`,
      [input.date, input.openingBalanceCents, input.note ?? null, req.user?.id]
    )
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

export default router
