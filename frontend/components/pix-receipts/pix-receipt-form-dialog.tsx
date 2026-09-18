"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { PhotoUploadField } from "@/components/shared/photo-upload-field"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { formatCentsBRL } from "@/lib/format"
import type { PixReceipt, Sale } from "@/lib/types"

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}
function inputToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function nowDatetimeLocal(): string {
  return toDatetimeLocal(new Date().toISOString())
}

export function PixReceiptFormDialog({
  open,
  onOpenChange,
  receipt,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receipt: PixReceipt | null
  onSaved: () => void
}) {
  const [imageKey, setImageKey] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [datetime, setDatetime] = useState(nowDatetimeLocal())
  const [saleId, setSaleId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  const { data: recentSales } = useApiQuery<{ items: Sale[] }>(open ? "/api/sales?limit=50" : null)

  useEffect(() => {
    if (open) {
      setImageKey(receipt?.image_key ?? null)
      setPreview(receipt?.viewUrl ?? null)
      setAmount(receipt ? centsToInput(receipt.amount_cents) : "")
      setDatetime(receipt ? toDatetimeLocal(receipt.receipt_datetime) : nowDatetimeLocal())
      setSaleId(receipt?.sale_id ?? "")
      setError(null)
    }
  }, [open, receipt])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!imageKey) {
      setError("Envie a foto do comprovante")
      return
    }
    const amountCents = inputToCents(amount)
    if (amountCents <= 0) {
      setError("Informe um valor válido")
      return
    }

    setIsSubmitting(true)
    setError(null)
    const body = {
      imageKey,
      amountCents,
      receiptDatetime: new Date(datetime).toISOString(),
      saleId: saleId || null,
    }

    try {
      if (receipt) {
        await apiFetch(`/api/pix-receipts/${receipt.id}`, { method: "PATCH", body })
        toast.add({ title: "Comprovante atualizado", type: "success" })
      } else {
        await apiFetch("/api/pix-receipts", { method: "POST", body })
        toast.add({ title: "Comprovante enviado", type: "success" })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível salvar o comprovante"
      setError(message)
      toast.add({ title: "Erro ao salvar", description: message, type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{receipt ? "Editar comprovante" : "Novo comprovante PIX"}</DialogTitle>
          <DialogDescription>Tire uma foto ou selecione da galeria.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex justify-center">
            <PhotoUploadField
              previewUrl={preview}
              onUploaded={(key, prev) => {
                setImageKey(key)
                setPreview(prev)
              }}
              onCleared={() => {
                setImageKey(null)
                setPreview(null)
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="datetime">Data/Hora</Label>
              <Input id="datetime" type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saleId">Associar à venda (opcional)</Label>
            <Select id="saleId" value={saleId} onChange={(e) => setSaleId(e.target.value)}>
              <option value="">Nenhuma</option>
              {(recentSales?.items ?? []).map((sale) => (
                <option key={sale.id} value={sale.id}>
                  #{sale.sale_number} · {sale.customer_name ?? "Sem nome"} · {formatCentsBRL(sale.total_cents)}
                </option>
              ))}
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
