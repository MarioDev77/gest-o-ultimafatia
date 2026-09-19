import { Router } from "express"
import multer from "multer"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { requireAdmin, requireAuth } from "../middleware/auth"
import { ApiError } from "../lib/errors"
import { UPLOADS_ROOT, guessContentType, resolveUploadPath, verifyUploadSignature } from "../lib/localStorage"

const router = Router()

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOADS_ROOT, "private", req.user!.id)
      mkdir(dir, { recursive: true })
        .then(() => cb(null, dir))
        .catch((err) => cb(err as Error, dir))
    },
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] ?? path.extname(file.originalname).slice(0, 10)
      cb(null, `${randomUUID()}${ext}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new ApiError("Tipo de arquivo não permitido", 400))
    cb(null, true)
  },
})

// Recebe o arquivo direto (multipart/form-data, campo "file") e grava no
// volume local. Antes isso devolvia uma URL assinada pra o navegador enviar
// o arquivo direto pro S3; agora o próprio backend recebe e salva o arquivo.
router.post("/", requireAuth, requireAdmin, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const apiError = err instanceof ApiError ? err : new ApiError("Falha ao processar o arquivo enviado", 400)
      return res.status(apiError.status).json({ error: apiError.message })
    }
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" })
    const key = `private/${req.user!.id}/${req.file.filename}`
    res.status(201).json({ key })
  })
})

// Serve o arquivo do disco. Protegido por assinatura HMAC com validade curta
// (gerada em lib/localStorage.buildViewUrl), não pelo token de sessão — um
// <img src> não consegue mandar o header Authorization.
router.get("/view/:scope/:userId/:filename", async (req, res, next) => {
  try {
    const { scope, userId, filename } = req.params
    if (scope !== "private") throw new ApiError("Link inválido", 400)
    const key = `${scope}/${userId}/${filename}`

    const exp = Number(req.query.exp)
    const sig = String(req.query.sig ?? "")
    if (!verifyUploadSignature(key, exp, sig)) throw new ApiError("Link expirado ou inválido", 403)

    // path.join ingênuo aqui deixaria escapar da pasta de uploads com
    // segmentos "..": um GET pra /view/private/../.. (scope/userId/filename)
    // batia certinho nesse padrão de rota e vazava arquivo fora do volume.
    // resolveUploadPath recusa qualquer resultado que saia de UPLOADS_ROOT.
    const filePath = resolveUploadPath(key)
    await stat(filePath)
    res.setHeader("Content-Type", guessContentType(filename))
    res.setHeader("Cache-Control", "private, max-age=60")
    createReadStream(filePath).pipe(res)
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return res.status(404).json({ error: "Arquivo não encontrado" })
    if (error instanceof ApiError) return res.status(error.status).json({ error: error.message })
    next(error)
  }
})

export default router
