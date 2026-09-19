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
import weekRoutes from "./routes/weeks"
import pixReceiptRoutes from "./routes/pixReceipts"
import expenseRoutes from "./routes/expenses"
import manufacturingRoutes from "./routes/manufacturing"
import dashboardRoutes from "./routes/dashboard"
import cashFlowRoutes from "./routes/cashFlow"
import reportRoutes from "./routes/reports"

const app = express()
app.disable("x-powered-by")
// O Railway coloca um proxy na frente do app (1 salto). Sem isso, o rate limit
// enxerga o IP do proxy pra todo mundo, e o limite do login vira compartilhado
// entre todos os usuários.
app.set("trust proxy", 1)
app.use(helmet())
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE"] }))
app.use(express.json({ limit: "100kb" }))
// Limite geral por IP, compartilhado por todas as rotas. Precisa ser folgado:
// o painel faz várias chamadas por tela (listas, dashboard, recarregamentos
// depois de salvar), e 100 por 15 min estourava em uso normal, devolvendo 429.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Muitas requisições. Aguarde alguns minutos e tente novamente." },
  })
)

// O limite geral acima não protege de verdade contra tentativa de adivinhar
// senha, já que dashboard e listagens consomem essa mesma cota. O login recebe
// um limite próprio, mais apertado, por IP — e só conta as tentativas que
// FALHAM (skipSuccessfulRequests), pra entrar corretamente não gastar a cota.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
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
app.use("/api/weeks", weekRoutes)
app.use("/api/pix-receipts", pixReceiptRoutes)
app.use("/api/expenses", expenseRoutes)
app.use("/api/manufacturing", manufacturingRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api/cash-flow", cashFlowRoutes)
app.use("/api/reports", reportRoutes)
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }))
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error("[api]", error.message); res.status(500).json({ error: "Erro interno do servidor" }) })
app.listen(env.PORT, () => console.log(`[api] listening on ${env.PORT}`))
