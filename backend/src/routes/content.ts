import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAdmin, requireAuth } from "../middleware/auth"

const router = Router()
const contentSchema = z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().min(1).max(100000), status: z.enum(["draft", "published"]).default("draft") })
router.get("/", requireAuth, async (_req, res, next) => { try { const result = await pool.query("SELECT id, title, status, created_at, updated_at FROM contents WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 100"); res.json({ items: result.rows }) } catch (error) { next(error) } })
router.post("/", requireAuth, requireAdmin, async (req, res, next) => { try { const input = contentSchema.parse(req.body); const result = await pool.query("INSERT INTO contents (title, body, status, created_by) VALUES ($1, $2, $3, $4) RETURNING id, title, status, created_at", [input.title, input.body, input.status, req.user?.id]); res.status(201).json(result.rows[0]) } catch (error) { next(error) } })
router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => { try { const id = z.string().uuid().parse(req.params.id); await pool.query("UPDATE contents SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL", [id]); res.status(204).send() } catch (error) { next(error) } })
export default router
