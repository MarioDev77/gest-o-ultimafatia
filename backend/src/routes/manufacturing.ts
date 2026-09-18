import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"

const router = Router()

const moneyCents = z.number().int().min(0).max(100_000_00)
const quantity = z.number().positive().max(1_000_000)

// ============================================================
// INGREDIENTES
// ============================================================
const ingredientCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  unit: z.string().trim().min(1).max(20),
  purchasedQuantity: quantity,
  purchasePriceCents: moneyCents,
})

const ingredientUpdateSchema = ingredientCreateSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: "Nenhum campo para atualizar",
})

router.get("/ingredients", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, unit, purchased_quantity, purchase_price_cents, unit_cost_cents, created_at, updated_at
       FROM manufacturing_ingredients WHERE deleted_at IS NULL ORDER BY name ASC`
    )
    res.json({ items: result.rows })
  } catch (error) {
    next(error)
  }
})

router.post("/ingredients", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = ingredientCreateSchema.parse(req.body)
    const result = await pool.query(
      `INSERT INTO manufacturing_ingredients (name, unit, purchased_quantity, purchase_price_cents, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, unit, purchased_quantity, purchase_price_cents, unit_cost_cents, created_at, updated_at`,
      [input.name, input.unit, input.purchasedQuantity, input.purchasePriceCents, req.user?.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
})

router.patch("/ingredients/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = ingredientUpdateSchema.parse(req.body)

    const columnMap: Record<string, string> = {
      name: "name",
      unit: "unit",
      purchasedQuantity: "purchased_quantity",
      purchasePriceCents: "purchase_price_cents",
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
      `UPDATE manufacturing_ingredients SET ${setClauses.join(", ")} WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id, name, unit, purchased_quantity, purchase_price_cents, unit_cost_cents, created_at, updated_at`,
      params
    )
    const ingredient = result.rows[0]
    if (!ingredient) return res.status(404).json({ error: "Ingrediente não encontrado" })
    res.json(ingredient)
  } catch (error) {
    next(error)
  }
})

router.delete("/ingredients/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const inUse = await pool.query("SELECT 1 FROM product_ingredients WHERE ingredient_id = $1 LIMIT 1", [id])
    if ((inUse.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: "Este ingrediente está vinculado a um produto e não pode ser excluído" })
    }
    const result = await pool.query(
      "UPDATE manufacturing_ingredients SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Ingrediente não encontrado" })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

// ============================================================
// CUSTO DE FABRICAÇÃO POR PRODUTO (ingredientes usados + quantidade)
// ============================================================
const productIngredientsSchema = z.object({
  items: z
    .array(z.object({ ingredientId: z.string().uuid(), quantityUsed: quantity }))
    .max(100),
  // Se true, além de salvar a lista, atualiza products.manufacturing_cost_cents
  // com a soma calculada. Fica opt-in porque o admin pode preferir digitar o
  // custo de fabricação direto no cadastro do produto, sem passar por ingredientes.
  applyCostToProduct: z.boolean().default(false),
})

router.get("/products/:productId/ingredients", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const productId = z.string().uuid().parse(req.params.productId)
    const result = await pool.query(
      `SELECT pi.id, pi.ingredient_id, mi.name, mi.unit, mi.unit_cost_cents, pi.quantity_used,
              ROUND(mi.unit_cost_cents * pi.quantity_used, 2) AS line_cost_cents
       FROM product_ingredients pi
       JOIN manufacturing_ingredients mi ON mi.id = pi.ingredient_id AND mi.deleted_at IS NULL
       WHERE pi.product_id = $1
       ORDER BY mi.name ASC`,
      [productId]
    )
    const totalCostCents = result.rows.reduce((sum, row) => sum + Number(row.line_cost_cents), 0)
    res.json({ items: result.rows, totalCostCents: Math.round(totalCostCents) })
  } catch (error) {
    next(error)
  }
})

// Substitui a lista inteira de ingredientes do produto (mais simples pra um
// formulário de "marcar ingredientes e quantidades" do que add/remove um a um).
router.put("/products/:productId/ingredients", requireAuth, requireAdmin, async (req, res, next) => {
  const client = await pool.connect()
  try {
    const productId = z.string().uuid().parse(req.params.productId)
    const input = productIngredientsSchema.parse(req.body)

    await client.query("BEGIN")

    const product = await client.query("SELECT id FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE", [productId])
    if (!product.rows[0]) {
      await client.query("ROLLBACK")
      return res.status(404).json({ error: "Produto não encontrado" })
    }

    await client.query("DELETE FROM product_ingredients WHERE product_id = $1", [productId])

    let totalCostCents = 0
    for (const item of input.items) {
      const ingredient = await client.query(
        "SELECT unit_cost_cents FROM manufacturing_ingredients WHERE id = $1 AND deleted_at IS NULL",
        [item.ingredientId]
      )
      if (!ingredient.rows[0]) {
        await client.query("ROLLBACK")
        return res.status(404).json({ error: `Ingrediente não encontrado (${item.ingredientId})` })
      }
      totalCostCents += Number(ingredient.rows[0].unit_cost_cents) * item.quantityUsed

      await client.query(
        "INSERT INTO product_ingredients (product_id, ingredient_id, quantity_used) VALUES ($1, $2, $3)",
        [productId, item.ingredientId, item.quantityUsed]
      )
    }

    const roundedTotal = Math.round(totalCostCents)
    if (input.applyCostToProduct) {
      await client.query("UPDATE products SET manufacturing_cost_cents = $1, updated_at = NOW() WHERE id = $2", [
        roundedTotal,
        productId,
      ])
    }

    await client.query("COMMIT")
    res.json({ totalCostCents: roundedTotal, appliedToProduct: input.applyCostToProduct })
  } catch (error) {
    await client.query("ROLLBACK")
    next(error)
  } finally {
    client.release()
  }
})

export default router
