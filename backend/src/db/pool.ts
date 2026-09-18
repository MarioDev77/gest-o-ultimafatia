import { Pool } from "pg"
import { env } from "../config/env"

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10, ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined })

// Sem isso, CURRENT_DATE/NOW()/::date rodam no timezone do servidor Postgres
// (normalmente UTC), e "faturamento do dia" fica errado pra um negócio em
// horário de Brasília/Bahia (UTC-3) — uma venda às 22h local ainda é hoje
// pro caixa, mas já seria amanhã em UTC perto da meia-noite.
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'America/Bahia'").catch((err) => console.error("[db] falha ao definir timezone da conexão", err))
})
