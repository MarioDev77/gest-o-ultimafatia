"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type UploadResponse = { key: string }

export function PhotoUploadField({
  previewUrl,
  onUploaded,
  onCleared,
}: {
  previewUrl: string | null
  onUploaded: (key: string, previewUrl: string) => void
  onCleared: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("A imagem deve ter até 10MB")
      return
    }

    setError(null)
    setIsUploading(true)
    const localPreview = URL.createObjectURL(file)

    try {
      const formData = new FormData()
      formData.append("file", file)
      // apiFetch detecta FormData e não força Content-Type: application/json,
      // deixando o navegador definir o boundary do multipart sozinho.
      const uploaded = await apiFetch<UploadResponse>("/api/uploads", {
        method: "POST",
        body: formData,
      })

      onUploaded(uploaded.key, localPreview)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a foto")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <div
        className={cn(
          "relative flex aspect-square w-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40"
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Foto do produto" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground/50" />
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {previewUrl && !isUploading && (
          <button
            type="button"
            onClick={onCleared}
            aria-label="Remover foto"
            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow hover:text-destructive"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading}>
        {previewUrl ? "Trocar foto" : "Selecionar foto"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
