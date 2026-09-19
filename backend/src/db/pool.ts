import { Pool } from "pg"
import { env } from "../config/env"

// O Postgres do Railway usa certificado autoassinado, então a verificação da
// cadeia (rejectUnauthorized: true) falha com "self-signed certificate in
// certificate chain". Em produção a conexão continua CRIPTOGRAFADA (TLS), só
// não valida a autoridade do certificado — aceitável aqui porque a conexão vai
// entre serviços do próprio projeto no Railway.
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10, ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined })

// Sem esse handler, um erro numa conexão ociosa do pool (ex: o banco reiniciou)
// vira "unhandled error event" e derruba o processo inteiro.
pool.on("error", (err) => console.error("[db] erro em conexão ociosa do pool", err.message))

// Sem isso, CURRENT_DATE/NOW()/::date rodam no timezone do servidor Postgres
// (normalmente UTC), e "faturamento do dia" fica errado pra um negócio em
// horário de Brasília/Bahia (UTC-3) — uma venda às 22h local ainda é hoje
// pro caixa, mas já seria amanhã em UTC perto da meia-noite.
pool.on("connect", (client) => {
  client.query("SET TIME ZONE 'America/Bahia'").catch((err) => console.error("[db] falha ao definir timezone da conexão", err))
})
