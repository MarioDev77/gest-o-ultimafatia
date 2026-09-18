import { Router } from "express"
import { z } from "zod"
import { randomUUID } from "node:crypto"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { env } from "../config/env"
import { requireAdmin, requireAuth } from "../middleware/auth"

const router = Router()
const s3 = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT, forcePathStyle: Boolean(env.S3_ENDPOINT), credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } })
const schema = z.object({ filename: z.string().regex(/^[\w.-]+$/).max(120), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]), size: z.number().int().positive().max(10 * 1024 * 1024) })
router.post("/presign", requireAuth, requireAdmin, async (req, res, next) => { try { const input = schema.parse(req.body); const key = `private/${req.user?.id}/${randomUUID()}-${input.filename}`; const command = new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: input.contentType, ContentLength: input.size, ServerSideEncryption: "AES256" }); const url = await getSignedUrl(s3, command, { expiresIn: 300 }); res.json({ url, key, expiresIn: 300 }) } catch (error) { next(error) } })
export default router
