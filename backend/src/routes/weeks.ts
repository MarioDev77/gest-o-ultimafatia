import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { ApiError } from "../lib/errors"

const router = Router()

const nameSchema = z.string().trim().min(1, "Informe o nome da semana").max(80)
const bodySchema = z.object({ name: nameSchema })

// 23505 = unique_violation (índice sale_weeks_name_unique_idx)
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505"
}

// Lista as semanas na ordem em que foram criadas (primeira semana primeiro),
// já com a quantidade de vendas concluídas e o faturamento de cada uma.
router.get("/", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.name, w.created_at,
              COUNT(s.id) FILTER (WHERE s.status = 'concluida')::int AS sales_count,
              COALESCE(SUM(s.total_cents) FILTER (WHERE s.status = 'concluida'), 0)::int AS revenue_cents
       FROM sale_weeks w
       LEFT JOIN sales s ON s.week_id = w.id AND s.deleted_at IS NULL
       WHERE w.deleted_at IS NULL
       GROUP BY w.id
       ORDER BY w.created_at ASC`
    )
    res.json({ items: result.rows })
  } catch (error) {
    next(error)
  }
})

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const input = bodySchema.parse(req.body)
    const result = await pool.query(
      `INSERT INTO sale_weeks (name, created_by) VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [input.name, req.user!.id]
    )
    res.status(201).json({ ...result.rows[0], sales_count: 0, revenue_cents: 0 })
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: "Já existe uma semana com esse nome" })
    next(error)
  }
})

router.patch("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const input = bodySchema.parse(req.body)
    const result = await pool.query(
      `UPDATE sale_weeks SET name = $1, updated_at = NOW()
       WHERE id = $2 AND deleted_at IS NULL RETURNING id, name, created_at`,
      [input.name, id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Semana não encontrada" })
    res.json(result.rows[0])
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: "Já existe uma semana com esse nome" })
    next(error)
  }
})

// Só exclui semana vazia: excluir uma semana com vendas faria elas perderem
// a referência e sumirem do agrupamento. Pra remover, mova ou cancele as
// vendas antes.
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id)
    const used = await pool.query("SELECT 1 FROM sales WHERE week_id = $1 AND deleted_at IS NULL LIMIT 1", [id])
    if (used.rows[0]) {
      throw new ApiError("Esta semana tem vendas registradas. Mova as vendas para outra semana antes de excluir.", 409)
    }
    const result = await pool.query(
      "UPDATE sale_weeks SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    )
    if (!result.rows[0]) return res.status(404).json({ error: "Semana não encontrada" })
    res.status(204).send()
  } catch (error) {
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

export default router
