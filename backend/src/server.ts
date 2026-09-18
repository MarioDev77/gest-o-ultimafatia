import express from "express"
import cors from "cors"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import { env } from "./config/env"
import authRoutes from "./routes/auth"
import contentRoutes from "./routes/content"
import uploadRoutes from "./routes/uploads"
import productRoutes from "./routes/products"
import salesRoutes from "./routes/sales"
import pixReceiptRoutes from "./routes/pixReceipts"
import expenseRoutes from "./routes/expenses"
import manufacturingRoutes from "./routes/manufacturing"
import dashboardRoutes from "./routes/dashboard"
import cashFlowRoutes from "./routes/cashFlow"
import reportRoutes from "./routes/reports"

const app = express()
app.disable("x-powered-by")
app.use(helmet())
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE"] }))
app.use(express.json({ limit: "100kb" }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: "draft-8", legacyHeaders: false }))

// O limite geral acima (100/15min) é compartilhado com TODAS as rotas — não
// protege de verdade contra tentativa de adivinhar senha, já que dashboard e
// listagens consomem essa mesma cota. O login recebe um limite próprio, mais
// apertado, por IP.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
})

app.get("/health", (_req, res) => res.json({ status: "ok", service: "nucleo-api" }))
app.use("/api/auth/login", loginRateLimit)
app.use("/api/auth", authRoutes)
app.use("/api/contents", contentRoutes)
app.use("/api/uploads", uploadRoutes)
app.use("/api/products", productRoutes)
app.use("/api/sales", salesRoutes)
app.use("/api/pix-receipts", pixReceiptRoutes)
app.use("/api/expenses", expenseRoutes)
app.use("/api/manufacturing", manufacturingRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/cash-flow", cashFlowRoutes)
app.use("/api/reports", reportRoutes)
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }))
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error("[api]", error.message); res.status(500).json({ error: "Erro interno do servidor" }) })
app.listen(env.PORT, () => console.log(`[api] listening on ${env.PORT}`))
