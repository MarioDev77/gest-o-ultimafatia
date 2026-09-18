import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { env } from "../config/env"

declare global { namespace Express { interface Request { user?: { id: string; role: "admin" | "editor" } } } }

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "")
  if (!token) return res.status(401).json({ error: "Autenticação obrigatória" })
  try {
    req.user = jwt.verify(token, env.JWT_SECRET, { issuer: "nucleo-api", audience: "nucleo-admin" }) as Express.Request["user"]
    return next()
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito a administradores" })
  return next()
}
