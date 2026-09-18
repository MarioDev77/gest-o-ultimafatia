"use client"

import { useMemo, useState } from "react"
import { Plus, Pencil, Trash2, ZoomIn, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PixReceiptFormDialog } from "@/components/pix-receipts/pix-receipt-form-dialog"
import { PixReceiptViewer } from "@/components/pix-receipts/pix-receipt-viewer"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { resolvePeriod } from "@/lib/period"
import { formatCentsBRL, formatDateTimeBR } from "@/lib/format"
import { PIX_STATUS_LABELS, type PixReceipt, type PixReceiptStatus } from "@/lib/types"

const STATUS_VARIANT: Record<PixReceiptStatus, "warning" | "success" | "destructive"> = {
  pendente: "warning",
  conferido: "success",
  divergente: "destructive",
}

export default function ComprovantesPixPage() {
  const [range] = useState(() => resolvePeriod("mes-atual"))
  const [status, setStatus] = useState<PixReceiptStatus | "">("")

  const [formOpen, setFormOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<PixReceipt | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PixReceipt | null>(null)
  const toast = useToast()

  const query = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to, limit: "100" })
    if (status) params.set("status", status)
    return params.toString()
  }, [range, status])

  const { data, isLoading, refetch } = useApiQuery<{ items: PixReceipt[] }>(`/api/pix-receipts?${query}`)
  const receipts = data?.items ?? []

  function openCreate() {
    setEditingReceipt(null)
    setFormOpen(true)
  }

  async function updateStatus(receipt: PixReceipt, nextStatus: PixReceiptStatus) {
    try {
      await apiFetch(`/api/pix-receipts/${receipt.id}`, { method: "PATCH", body: { status: nextStatus } })
      toast.add({ title: "Status atualizado", type: "success" })
      refetch()
    } catch (err) {
      toast.add({
        title: "Não foi possível atualizar",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiFetch(`/api/pix-receipts/${deleteTarget.id}`, { method: "DELETE" })
      toast.add({ title: "Comprovante excluído", type: "success" })
      refetch()
    } catch (err) {
      toast.add({
        title: "Não foi possível excluir",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{receipts.length} comprovante(s)</p>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Novo Comprovante
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value as PixReceiptStatus | "")} className="w-44">
          <option value="">Todos status</option>
          <option value="pendente">Pendente</option>
          <option value="conferido">Conferido</option>
          <option value="divergente">Divergente</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : receipts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum comprovante no período selecionado.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {receipts.map((receipt) => (
            <Card key={receipt.id} className="overflow-hidden">
              <button
                type="button"
                className="relative block aspect-[4/3] w-full bg-muted"
                onClick={() => setViewerUrl(receipt.viewUrl)}
              >
                {receipt.viewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={receipt.viewUrl} alt="Comprovante PIX" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground">
                    <ImageOff className="size-6" />
                  </div>
                )}
                <span className="absolute right-1.5 top-1.5 rounded-full bg-background/80 p-1">
                  <ZoomIn className="size-3.5 text-foreground" />
                </span>
              </button>
              <CardContent className="flex flex-col gap-1.5 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{formatCentsBRL(receipt.amount_cents)}</span>
                  {receipt.sale_number && <span className="text-xs text-muted-foreground">#{receipt.sale_number}</span>}
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTimeBR(receipt.receipt_datetime)}</p>
                <Select
                  value={receipt.status}
                  onChange={(e) => updateStatus(receipt, e.target.value as PixReceiptStatus)}
                  className="h-7 text-xs"
                >
                  <option value="pendente">Pendente</option>
                  <option value="conferido">Conferido</option>
                  <option value="divergente">Divergente</option>
                </Select>
                <div className="flex items-center justify-between">
                  <Badge variant={STATUS_VARIANT[receipt.status]}>{PIX_STATUS_LABELS[receipt.status]}</Badge>
                  <div className="flex gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => {
                        setEditingReceipt(receipt)
                        setFormOpen(true)
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setDeleteTarget(receipt)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PixReceiptFormDialog open={formOpen} onOpenChange={setFormOpen} receipt={editingReceipt} onSaved={refetch} />
      <PixReceiptViewer url={viewerUrl} onOpenChange={(open) => !open && setViewerUrl(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir comprovante"
        description="Tem certeza que deseja excluir este comprovante PIX?"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}
