import { createHmac, timingSafeEqual } from "node:crypto"
import path from "node:path"
import { unlink } from "node:fs/promises"
import { env } from "../config/env"
import { ApiError } from "./errors"

// Pasta raiz onde os arquivos ficam. Em produção, aponte UPLOADS_DIR pro
// caminho onde um Volume do Railway está montado (ex: "/data/uploads") —
// sem isso, os arquivos somem a cada novo deploy, porque o filesystem do
// container é descartado.
export const UPLOADS_ROOT = path.resolve(env.UPLOADS_DIR)

// "key" é sempre no formato private/<userId>/<arquivo> (mesmo formato que já
// era usado com o S3). Resolve pro caminho absoluto em disco, garantindo que
// a chave nunca escape da pasta de uploads (ex: "../../etc/passwd").
export function resolveUploadPath(key: string): string {
  const resolved = path.resolve(UPLOADS_ROOT, key)
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) {
    throw new ApiError("Chave de upload inválida", 400)
  }
  return resolved
}

// Mesma regra de posse que existia com S3: cada usuário só pode referenciar
// chaves dentro da própria pasta private/<userId>/.
export function assertOwnedKey(userId: string, key: string): void {
  const prefix = `private/${userId}/`
  if (!key.startsWith(prefix)) {
    throw new ApiError("Chave de arquivo inválida para este usuário", 403)
  }
}

function sign(key: string, exp: number): string {
  return createHmac("sha256", env.JWT_SECRET).update(`${key}:${exp}`).digest("base64url")
}

// Gera um link de visualização assinado, com validade curta (300s por
// padrão) — mesmo espírito de uma presigned URL do S3. Como um <img src> não
// consegue mandar o header Authorization, a "autenticação" desse link é a
// própria assinatura, não o token de sessão.
export function buildViewUrl(key: string, expiresInSeconds = 300): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
  const sig = sign(key, exp)
  const base = env.PUBLIC_URL ?? `http://localhost:${env.PORT}`
  return `${base}/api/uploads/view/${key}?exp=${exp}&sig=${sig}`
}

export function verifyUploadSignature(key: string, exp: number, sig: string): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  if (!sig) return false
  const expected = sign(key, exp)
  const a = Buffer.from(expected)
  const b = Buffer.from(sig)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function deleteUpload(key: string): Promise<void> {
  try {
    await unlink(resolveUploadPath(key))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
  }
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
}

export function guessContentType(filename: string): string {
  return CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream"
}
