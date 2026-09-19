import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { ApiError } from "../lib/errors"
import { assertOwnedKey, buildViewUrl } from "../lib/localStorage"

const router = Router()

// products.photo_key aponta pra pasta privada de uploads — sem isso o
// frontend não tem como exibir a foto (mesma solução já usada em pix-receipts).
async function attachPhotoUrl<T extends { photo_key: string | null }>(row: T): Promise<T & { photo_url: string | null }> {
  if (!row.photo_key) return { ...row, photo_url: null }
  return { ...row, photo_url: buildViewUrl(row.photo_key) }
}

async function attachPhotoUrls<T extends { photo_key: string | null }>(rows: T[]): Promise<Array<T & { photo_url: string | null }>> {
  return Promise.all(rows.map(attachPhotoUrl))
}

const moneyCents = z.number().int().min(0).max(100_000_00) // até R$ 100.000,00 por unidade

const productCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(80).optional(),
  photoKey: z.string().trim().max(300).optional(),
  unit: z.string().trim().min(1).max(20).default("unidade"),
  salePriceCents: moneyCents.nullable().optional(),
  manufacturingCostCents: moneyCents.nullable().optional(),
  stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
  status: z.enum(["ativo", "inativo"]).default("ativo"),
})

const productUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).nullable(),
    category: z.string().trim().max(80).nullable(),
    photoKey: z.string().trim().max(300).nullable(),
    unit: z.string().trim().min(1).max(20),
    salePriceCents: moneyCents.nullable(),
    manufacturingCostCents: moneyCents.nullable(),
    stockQuantity: z.number().int().min(0).max(1_000_000),
    status: z.enum(["ativo", "inativo"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nenhum campo para atualizar" })

const PRODUCT_LIST_QUERY = `
  SELECT
    p.id, p.name, p.description, p.category, p.photo_key, p.unit,
    p.sale_price_cents, p.manufacturing_cost_cents, p.stock_quantity, p.status,
    p.created_at, p.updated_at,
    COALESCE(sold.quantity_sold, 0)::int AS quantity_sold,
    COALESCE(sold.revenue_cents, 0)::int AS revenue_cents,
    CASE WHEN p.sale_price_cents IS NOT NULL AND p.manufacturing_cost_cents IS NOT NULL
      THEN p.sale_price_cents - p.manufacturing_cost_cents END AS unit_profit_cents,
    CASE WHEN p.sale_price_cents IS NOT NULL AND p.manufacturing_cost_cents IS NOT NULL AND p.sale_price_cents > 0
      THEN ROUND(((p.sale_price_cents - p.manufacturing_cost_cents)::numeric / p.sale_price_cents) * 100, 2) END AS profit_margin_pct
  FROM products p
  LEFT JOIN (
    SELECT si.product_id, SUM(si.quantity) AS quantity_sold, SUM(si.line_total_cents) AS revenue_cents
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id AND s.status = 'concluida' AND s.deleted_at IS NULL
    GROUP BY si.product_id
  ) sold ON sold.product_id = p.id
  WHERE p.deleted_at IS NULL
`

router.get("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = z.enum(["ativo", "inativo"]).optional().parse(req.query.status)
    const params: unknown[] = []
    let query = PRODUCT_LIST_QUERY
    if (status) {
      params.push(status)
      query += ` AND p.status = $${params.length}`
    }
    query += " ORDER BY p.status ASC, p.name ASC"
    const result = await pool.query(query, params)
    res.json({ items: await attachPhotoUrls(result.rows) })
  } catch (error) {
    next(error)
  }
})

router.get("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const result = await pool.query(`${PRODUCT_LIST_QUERY} AND p.id = $1`, [id])
    const product = result.rows[0]
    if (!product) return res.status(404).json({ error: "Produto não encontrado" })
    res.json(await attachPhotoUrl(product))
  } catch (error) {
    next(error)
  }
})

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = productCreateSchema.parse(req.body)
    if (input.photoKey) assertOwnedKey(req.user!.id, input.photoKey)
    const result = await pool.query(
      `INSERT INTO products (name, description, category, photo_key, unit, sale_price_cents, manufacturing_cost_cents, stock_quantity, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, description, category, photo_key, unit, sale_price_cents, manufacturing_cost_cents, stock_quantity, status, created_at, updated_at`,
      [
        input.name,
        input.description ?? null,
        input.category ?? null,
        input.photoKey ?? null,
        input.unit,
        input.salePriceCents ?? null,
        input.manufacturingCostCents ?? null,
        input.stockQuantity,
        input.status,
        req.user?.id,
      ]
    )
    res.status(201).json(await attachPhotoUrl(result.rows[0]))
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = productUpdateSchema.parse(req.body)
    if (input.photoKey) assertOwnedKey(req.user!.id, input.photoKey)

    const columnMap: Record<string, string> = {
      name: "name",
      description: "description",
      category: "category",
      photoKey: "photo_key",
      unit: "unit",
      salePriceCents: "sale_price_cents",
      manufacturingCostCents: "manufacturing_cost_cents",
      stockQuantity: "stock_quantity",
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
    setClauses.push("updated_at = NOW()")
    params.push(id)

    const result = await pool.query(
      `UPDATE products SET ${setClauses.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id, name, description, category, photo_key, unit, sale_price_cents, manufacturing_cost_cents, stock_quantity, status, created_at, updated_at`,
      params
    )
    const product = result.rows[0]
    if (!product) return res.status(404).json({ error: "Produto não encontrado" })
    res.json(await attachPhotoUrl(product))
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const usedInSales = await pool.query("SELECT 1 FROM sale_items WHERE product_id = $1 LIMIT 1", [id])
    if ((usedInSales.rowCount ?? 0) > 0) {
      return res.status(409).json({
        error: "Este produto já possui vendas registradas e não pode ser excluído. Use o status \"inativo\" para preservar o histórico financeiro.",
      })
    }
    const result = await pool.query(
      "UPDATE products SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Produto não encontrado" })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export default router
