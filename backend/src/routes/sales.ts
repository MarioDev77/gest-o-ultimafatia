import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { SalesServiceError, cancelSale, createSale, deleteAllSales } from "../services/salesService"

const router = Router()

const moneyCents = z.number().int().min(0).max(100_000_00)

const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(9999),
  unitPriceCents: moneyCents.optional(),
})

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1).max(50),
  customerName: z.string().trim().min(1).max(160).optional(),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao"]),
  amountReceivedCents: moneyCents.optional(),
  discountCents: moneyCents.default(0),
  notes: z.string().trim().min(1).max(500).optional(),
  weekId: z.string().uuid().optional(),
})

// customerName/notes/amountReceivedCents são nullable pra permitir limpar o
// campo explicitamente (diferente de "não enviar", que mantém o valor atual).
const updateSaleMetaSchema = z
  .object({
    customerName: z.string().trim().max(160).nullable(),
    notes: z.string().trim().max(500).nullable(),
    discountCents: moneyCents,
    paymentMethod: z.enum(["dinheiro", "pix", "cartao"]),
    amountReceivedCents: moneyCents.nullable(),
    weekId: z.string().uuid().nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar" })

const listQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["concluida", "cancelada"]).optional(),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao"]).optional(),
  search: z.string().trim().max(160).optional(),
  // "none" = só vendas sem semana
  weekId: z.union([z.literal("none"), z.string().uuid()]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query)
    const conditions: string[] = ["s.deleted_at IS NULL"]
    const params: unknown[] = []

    if (q.from) {
      params.push(q.from)
      conditions.push(`s.sale_datetime >= $${params.length}::date`)
    }
    if (q.to) {
      params.push(q.to)
      conditions.push(`s.sale_datetime < ($${params.length}::date + INTERVAL '1 day')`)
    }
    if (q.status) {
      params.push(q.status)
      conditions.push(`s.status = $${params.length}`)
    }
    if (q.paymentMethod) {
      params.push(q.paymentMethod)
      conditions.push(`s.payment_method = $${params.length}`)
    }
    if (q.search) {
      params.push(`%${q.search}%`)
      conditions.push(`s.customer_name ILIKE $${params.length}`)
    }

    if (q.weekId === "none") {
      conditions.push("s.week_id IS NULL")
    } else if (q.weekId) {
      params.push(q.weekId)
      conditions.push(`s.week_id = $${params.length}`)
    }

    params.push(q.limit)
    const limitIdx = params.length
    params.push(q.offset)
    const offsetIdx = params.length

    const result = await pool.query(
      `SELECT s.id, s.sale_number, s.sale_datetime, s.customer_name, s.payment_method,
              s.amount_received_cents, s.change_cents, s.discount_cents, s.subtotal_cents,
              s.total_cents, s.total_cost_cents, s.status, s.notes, s.week_id, w.name AS week_name
       FROM sales s
       LEFT JOIN sale_weeks w ON w.id = s.week_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.sale_datetime DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )
    res.json({ items: result.rows })
  } catch (error) {
    next(error)
  }
})

router.get("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const saleResult = await pool.query(
      `SELECT s.id, s.sale_number, s.sale_datetime, s.customer_name, s.payment_method, s.amount_received_cents,
              s.change_cents, s.discount_cents, s.subtotal_cents, s.total_cents, s.total_cost_cents, s.status, s.notes,
              s.week_id, w.name AS week_name, s.created_at, s.updated_at
       FROM sales s
       LEFT JOIN sale_weeks w ON w.id = s.week_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [id]
    )
    const sale = saleResult.rows[0]
    if (!sale) return res.status(404).json({ error: "Venda não encontrada" })

    const itemsResult = await pool.query(
      `SELECT id, product_id, product_name_snapshot, quantity, unit_price_cents, unit_cost_cents, line_total_cents
       FROM sale_items WHERE sale_id = $1 ORDER BY created_at ASC`,
      [id]
    )
    res.json({ ...sale, items: itemsResult.rows })
  } catch (error) {
    next(error)
  }
})

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = createSaleSchema.parse(req.body)
    const sale = await createSale(pool, {
      items: input.items,
      customerName: input.customerName ?? null,
      paymentMethod: input.paymentMethod,
      amountReceivedCents: input.amountReceivedCents ?? null,
      discountCents: input.discountCents,
      notes: input.notes ?? null,
      weekId: input.weekId ?? null,
      createdBy: req.user!.id,
    })
    res.status(201).json(sale)
  } catch (error) {
    if (error instanceof SalesServiceError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

// Edita só os metadados da venda (cliente, observação, desconto, forma de
// pagamento, valor recebido). Trocar os produtos de uma venda já registrada
// não é permitido por aqui de propósito: mexeria em estoque e custo já
// contabilizados. Pra isso, cancele a venda e registre uma nova — mantém o
// histórico financeiro íntegro e auditável.
router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = updateSaleMetaSchema.parse(req.body)

    const current = await pool.query(
      "SELECT status, subtotal_cents, discount_cents, payment_method, amount_received_cents FROM sales WHERE id = $1 AND deleted_at IS NULL",
      [id]
    )
    const sale = current.rows[0]
    if (!sale) return res.status(404).json({ error: "Venda não encontrada" })
    if (sale.status === "cancelada") return res.status(409).json({ error: "Venda cancelada não pode ser editada" })

    const discountCents = input.discountCents ?? sale.discount_cents
    if (discountCents > sale.subtotal_cents) {
      return res.status(400).json({ error: "Desconto não pode ser maior que o subtotal" })
    }
    const totalCents = sale.subtotal_cents - discountCents

    const paymentMethod = input.paymentMethod ?? sale.payment_method
    const amountReceivedCents: number | null =
      "amountReceivedCents" in input ? (input.amountReceivedCents as number | null) : sale.amount_received_cents

    let changeCents = 0
    let finalAmountReceivedCents = amountReceivedCents
    if (paymentMethod === "dinheiro") {
      if (finalAmountReceivedCents === null) {
        return res.status(400).json({ error: "Informe o valor recebido em dinheiro" })
      }
      if (finalAmountReceivedCents < totalCents) {
        return res.status(400).json({ error: "Valor recebido é menor que o total da venda" })
      }
      changeCents = finalAmountReceivedCents - totalCents
    } else {
      finalAmountReceivedCents = null
    }

    const setClauses: string[] = [
      "discount_cents = $1",
      "total_cents = $2",
      "payment_method = $3",
      "amount_received_cents = $4",
      "change_cents = $5",
      "updated_at = NOW()",
    ]
    const params: unknown[] = [discountCents, totalCents, paymentMethod, finalAmountReceivedCents, changeCents]

    if ("customerName" in input) {
      params.push(input.customerName)
      setClauses.push(`customer_name = $${params.length}`)
    }
    if ("notes" in input) {
      params.push(input.notes)
      setClauses.push(`notes = $${params.length}`)
    }
    if ("weekId" in input) {
      if (input.weekId) {
        const week = await pool.query("SELECT id FROM sale_weeks WHERE id = $1 AND deleted_at IS NULL", [input.weekId])
        if (!week.rows[0]) return res.status(404).json({ error: "Semana não encontrada" })
      }
      params.push(input.weekId)
      setClauses.push(`week_id = $${params.length}`)
    }

    params.push(id)
    const result = await pool.query(
      `UPDATE sales SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    )
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.post("/:id/cancel", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    await cancelSale(pool, id)
    res.json({ status: "cancelada" })
  } catch (error) {
    if (error instanceof SalesServiceError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

// Apaga de vez TODAS as vendas do sistema (não respeita os filtros da tela —
// é um reset completo), devolvendo o estoque reservado por cada uma antes de
// apagar. Ação irreversível, usada pelo botão "Apagar todas as vendas".
router.delete("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const deleted = await deleteAllSales(pool)
    res.json({ deleted })
  } catch (error) {
    next(error)
  }
})

export default router
