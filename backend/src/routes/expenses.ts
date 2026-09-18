import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { ApiError } from "../lib/errors"

const router = Router()

const CATEGORIES = ["materia_prima", "embalagens", "transporte", "marketing", "equipamentos", "taxas", "outros"] as const
const moneyCents = z.number().int().min(1).max(100_000_00)

function assertOwnedKey(userId: string, key: string) {
  const prefix = `private/${userId}/`
  if (!key.startsWith(prefix)) {
    throw new ApiError("Chave de comprovante inválida para este usuário", 403)
  }
}

const createSchema = z.object({
  description: z.string().trim().min(1).max(200),
  category: z.enum(CATEGORIES),
  amountCents: moneyCents,
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: z.enum(["dinheiro", "pix", "cartao"]),
  note: z.string().trim().max(1000).optional(),
  receiptKey: z.string().trim().max(400).optional(),
})

const updateSchema = z
  .object({
    description: z.string().trim().min(1).max(200),
    category: z.enum(CATEGORIES),
    amountCents: moneyCents,
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    paymentMethod: z.enum(["dinheiro", "pix", "cartao"]),
    note: z.string().trim().max(1000).nullable(),
    receiptKey: z.string().trim().max(400).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar" })

const listQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.enum(CATEGORIES).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query)
    const conditions: string[] = ["deleted_at IS NULL"]
    const params: unknown[] = []

    if (q.from) {
      params.push(q.from)
      conditions.push(`expense_date >= $${params.length}`)
    }
    if (q.to) {
      params.push(q.to)
      conditions.push(`expense_date <= $${params.length}`)
    }
    if (q.category) {
      params.push(q.category)
      conditions.push(`category = $${params.length}`)
    }
    if (q.search) {
      params.push(`%${q.search}%`)
      conditions.push(`description ILIKE $${params.length}`)
    }

    params.push(q.limit)
    const limitIdx = params.length
    params.push(q.offset)
    const offsetIdx = params.length

    const result = await pool.query(
      `SELECT id, description, category, amount_cents, expense_date, payment_method, note, receipt_key, created_at, updated_at
       FROM expenses WHERE ${conditions.join(" AND ")}
       ORDER BY expense_date DESC, created_at DESC
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
    const result = await pool.query("SELECT * FROM expenses WHERE id = $1 AND deleted_at IS NULL", [id])
    const expense = result.rows[0]
    if (!expense) return res.status(404).json({ error: "Despesa não encontrada" })
    res.json(expense)
  } catch (error) {
    next(error)
  }
})

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body)
    if (input.receiptKey) assertOwnedKey(req.user!.id, input.receiptKey)

    const result = await pool.query(
      `INSERT INTO expenses (description, category, amount_cents, expense_date, payment_method, note, receipt_key, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, description, category, amount_cents, expense_date, payment_method, note, receipt_key, created_at, updated_at`,
      [input.description, input.category, input.amountCents, input.expenseDate, input.paymentMethod, input.note ?? null, input.receiptKey ?? null, req.user?.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = updateSchema.parse(req.body)
    if (input.receiptKey) assertOwnedKey(req.user!.id, input.receiptKey)

    const columnMap: Record<string, string> = {
      description: "description",
      category: "category",
      amountCents: "amount_cents",
      expenseDate: "expense_date",
      paymentMethod: "payment_method",
      note: "note",
      receiptKey: "receipt_key",
    }

    const setClauses: string[] = []
    const params: unknown[] = []
    for (const [key, column] of Object.entries(columnMap)) {
      if (key in input) {
        params.push((input as Record<string, unknown>)[key])
        setClauses.push(`${column} = $${params.length}`)
      }
    }
    setClauses.push("updated_at = NOW()")
    params.push(id)

    const result = await pool.query(
      `UPDATE expenses SET ${setClauses.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    )
    const expense = result.rows[0]
    if (!expense) return res.status(404).json({ error: "Despesa não encontrada" })
    res.json(expense)
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const result = await pool.query(
      "UPDATE expenses SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Despesa não encontrada" })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
