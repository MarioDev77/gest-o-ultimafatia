import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { ApiError } from "../lib/errors"
import { assertOwnedKey, buildViewUrl, deleteUpload } from "../lib/localStorage"

const router = Router()

const moneyCents = z.number().int().min(0).max(100_000_00)

const createSchema = z.object({
  imageKey: z.string().trim().min(1).max(400),
  amountCents: moneyCents,
  receiptDatetime: z.string().datetime(),
  saleId: z.string().uuid().nullable().optional(),
})

const updateSchema = z
  .object({
    imageKey: z.string().trim().min(1).max(400),
    amountCents: moneyCents,
    receiptDatetime: z.string().datetime(),
    saleId: z.string().uuid().nullable(),
    status: z.enum(["pendente", "conferido", "divergente"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar" })

const listQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["pendente", "conferido", "divergente"]).optional(),
  saleId: z.string().uuid().optional(),
  minAmountCents: z.coerce.number().int().min(0).optional(),
  maxAmountCents: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

async function attachViewUrl(row: Record<string, unknown>) {
  return { ...row, viewUrl: buildViewUrl(row.image_key as string) }
}

async function attachViewUrls(rows: Record<string, unknown>[]) {
  return Promise.all(rows.map(attachViewUrl))
}

router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const q = listQuerySchema.parse(req.query)
    const conditions: string[] = ["pr.deleted_at IS NULL"]
    const params: unknown[] = []

    if (q.from) {
      params.push(q.from)
      conditions.push(`pr.receipt_datetime >= $${params.length}::date`)
    }
    if (q.to) {
      params.push(q.to)
      conditions.push(`pr.receipt_datetime < ($${params.length}::date + INTERVAL '1 day')`)
    }
    if (q.status) {
      params.push(q.status)
      conditions.push(`pr.status = $${params.length}`)
    }
    if (q.saleId) {
      params.push(q.saleId)
      conditions.push(`pr.sale_id = $${params.length}`)
    }
    if (q.minAmountCents !== undefined) {
      params.push(q.minAmountCents)
      conditions.push(`pr.amount_cents >= $${params.length}`)
    }
    if (q.maxAmountCents !== undefined) {
      params.push(q.maxAmountCents)
      conditions.push(`pr.amount_cents <= $${params.length}`)
    }

    params.push(q.limit)
    const limitIdx = params.length
    params.push(q.offset)
    const offsetIdx = params.length

    const result = await pool.query(
      `SELECT pr.id, pr.sale_id, pr.image_key, pr.amount_cents, pr.receipt_datetime, pr.status,
              pr.reviewed_by, pr.reviewed_at, pr.created_at, pr.updated_at,
              s.sale_number
       FROM pix_receipts pr
       LEFT JOIN sales s ON s.id = pr.sale_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY pr.receipt_datetime DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    )
    res.json({ items: await attachViewUrls(result.rows) })
  } catch (error) {
    next(error)
  }
})

router.get("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const result = await pool.query(
      `SELECT pr.*, s.sale_number FROM pix_receipts pr LEFT JOIN sales s ON s.id = pr.sale_id
       WHERE pr.id = $1 AND pr.deleted_at IS NULL`,
      [id]
    )
    const receipt = result.rows[0]
    if (!receipt) return res.status(404).json({ error: "Comprovante não encontrado" })
    res.json(await attachViewUrl(receipt))
  } catch (error) {
    next(error)
  }
})

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body)
    assertOwnedKey(req.user!.id, input.imageKey)

    if (input.saleId) {
      const sale = await pool.query("SELECT 1 FROM sales WHERE id = $1 AND deleted_at IS NULL", [input.saleId])
      if (sale.rowCount === 0) return res.status(404).json({ error: "Venda associada não encontrada" })
    }

    const result = await pool.query(
      `INSERT INTO pix_receipts (sale_id, image_key, amount_cents, receipt_datetime, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, sale_id, image_key, amount_cents, receipt_datetime, status, created_at, updated_at`,
      [input.saleId ?? null, input.imageKey, input.amountCents, input.receiptDatetime, req.user?.id]
    )
    res.status(201).json(await attachViewUrl(result.rows[0]))
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = updateSchema.parse(req.body)

    const current = await pool.query("SELECT image_key, status FROM pix_receipts WHERE id = $1 AND deleted_at IS NULL", [id])
    const existing = current.rows[0]
    if (!existing) return res.status(404).json({ error: "Comprovante não encontrado" })

    if (input.imageKey) assertOwnedKey(req.user!.id, input.imageKey)
    if (input.saleId) {
      const sale = await pool.query("SELECT 1 FROM sales WHERE id = $1 AND deleted_at IS NULL", [input.saleId])
      if (sale.rowCount === 0) return res.status(404).json({ error: "Venda associada não encontrada" })
    }

    const columnMap: Record<string, string> = {
      imageKey: "image_key",
      amountCents: "amount_cents",
      receiptDatetime: "receipt_datetime",
      saleId: "sale_id",
      status: "status",
    }

    const setClauses: string[] = []
    const params: unknown[] = []
    for (const [key, column] of Object.entries(columnMap)) {
      if (key in input) {
        params.push((input as Record<string, unknown>)[key])
        setClauses.push(`${column} = $${params.length}`)
      }
    }
    // Ao mudar o status pra algo diferente de "pendente", registra quem conferiu e quando.
    if (input.status && input.status !== "pendente") {
      params.push(req.user!.id)
      setClauses.push(`reviewed_by = $${params.length}`)
      setClauses.push("reviewed_at = NOW()")
    }
    setClauses.push("updated_at = NOW()")
    params.push(id)

    const result = await pool.query(
      `UPDATE pix_receipts SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    )
    const updated = result.rows[0]

    // Imagem substituída: apaga o arquivo antigo do disco (best-effort, não trava a resposta).
    if (input.imageKey && input.imageKey !== existing.image_key) {
      deleteUpload(existing.image_key).catch((err) =>
        console.error("[pix-receipts] falha ao apagar imagem antiga do disco", err)
      )
    }

    res.json(await attachViewUrl(updated))
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const result = await pool.query(
      "UPDATE pix_receipts SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING image_key",
      [id]
    )
    const deleted = result.rows[0]
    if (!deleted) return res.status(404).json({ error: "Comprovante não encontrado" })
    deleteUpload(deleted.image_key).catch((err) =>
      console.error("[pix-receipts] falha ao apagar imagem do disco", err)
    )
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
