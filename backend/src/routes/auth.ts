import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { z } from "zod"
import { pool } from "../db/pool"
import { env } from "../config/env"
import { requireAuth } from "../middleware/auth"

const router = Router()
const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(128) })
router.post("/login", async (req, res, next) => { try { const input = loginSchema.parse(req.body); const result = await pool.query("SELECT id, email, password_hash, role FROM users WHERE email = $1 AND deleted_at IS NULL", [input.email.toLowerCase()]); const user = result.rows[0]; if (!user || !(await bcrypt.compare(input.password, user.password_hash))) return res.status(401).json({ error: "Credenciais inválidas" }); const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"], issuer: "nucleo-api", audience: "nucleo-admin" }); res.json({ token, user: { id: user.id, email: user.email, role: user.role } }) } catch (error) { next(error) } })

// Usado pelo frontend pra validar, ao carregar a página, se o token salvo
// ainda é válido (e reidratar os dados do usuário sem pedir login de novo).
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT id, email, role FROM users WHERE id = $1 AND deleted_at IS NULL", [req.user!.id])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: "Usuário não encontrado" })
    res.json({ user })
  } catch (error) {
    next(error)
  }
})

export default router
