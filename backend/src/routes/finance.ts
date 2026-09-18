import { Router } from "express"
import { z } from "zod"
import { pool } from "../db/pool"
import { requireAuth, requireRole } from "../middleware/auth"

const router = Router()
router.use(requireAuth)
const saleSchema = z.object({ customerName: z.string().trim().min(1).max(160), total: z.number().positive().finite(), paymentMethod: z.enum(["pix", "card", "boleto", "cash"]), notes: z.string().max(1000).optional() })
router.get("/summary", async (_req, res) => { const { rows } = await pool.query("SELECT COALESCE((SELECT SUM(total) FROM sales WHERE status='paid' AND deleted_at IS NULL),0) revenue, COALESCE((SELECT SUM(amount) FROM expenses WHERE deleted_at IS NULL),0) expenses, (SELECT COUNT(*) FROM sales WHERE deleted_at IS NULL) sales") ; const row = rows[0]; res.json({ revenue: Number(row.revenue), expenses: Number(row.expenses), profit: Number(row.revenue) - Number(row.expenses), sales: Number(row.sales) }) })
router.get("/sales", async (_req, res) => { const { rows } = await pool.query("SELECT id, customer_name, total, payment_method, status, created_at FROM sales WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 100"); res.json(rows) })
router.post("/sales", requireRole("admin", "editor"), async (req, res) => { const parsed = saleSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Dados de venda inválidos" }); const { customerName, total, paymentMethod, notes } = parsed.data; const { rows } = await pool.query("INSERT INTO sales (customer_name,total,payment_method,notes,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, customer_name, total, payment_method, status, created_at", [customerName, total, paymentMethod, notes ?? null, req.user!.id]); res.status(201).json(rows[0]) })
router.get("/expenses", async (_req, res) => { const { rows } = await pool.query("SELECT id, description, category, amount, expense_date FROM expenses WHERE deleted_at IS NULL ORDER BY expense_date DESC LIMIT 100"); res.json(rows) })
router.post("/expenses", requireRole("admin"), async (req, res) => { const parsed = z.object({ description: z.string().trim().min(1).max(240), category: z.string().trim().min(1).max(80), amount: z.number().positive().finite(), expenseDate: z.string().date().optional() }).safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Dados de despesa inválidos" }); const { description, category, amount, expenseDate } = parsed.data; const { rows } = await pool.query("INSERT INTO expenses (description,category,amount,expense_date,created_by) VALUES ($1,$2,$3,COALESCE($4::date,CURRENT_DATE),$5) RETURNING *", [description, category, amount, expenseDate ?? null, req.user!.id]); res.status(201).json(rows[0]) })
export default router
