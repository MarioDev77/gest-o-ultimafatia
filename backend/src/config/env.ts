import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  FRONTEND_ORIGIN: z.string().url(),
  // Pasta onde os arquivos de upload (fotos de produto, comprovantes PIX)
  // são gravados em disco. Em produção, aponte pro caminho de um Volume do
  // Railway (ex: "/data/uploads") — sem isso, os arquivos somem a cada deploy.
  UPLOADS_DIR: z.string().min(1).default("uploads"),
  // URL pública do próprio backend, usada pra montar os links de visualização
  // das fotos (ex: https://sua-api.up.railway.app). Sem isso, cai no
  // localhost, que só funciona em desenvolvimento.
  PUBLIC_URL: z.string().url().optional(),
})

export const env = schema.parse(process.env)
