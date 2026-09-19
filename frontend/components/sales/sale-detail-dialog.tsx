"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { formatCentsBRL, formatDateTimeBR } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/types"
import type { SaleDetail } from "@/lib/types"

export function SaleDetailDialog({
  saleId,
  onOpenChange,
  onChanged,
  onEdit,
}: {
  saleId: string | null
  onOpenChange: (open: boolean) => void
  onChanged: () => void
  onEdit: (sale: SaleDetail) => void
}) {
  const { data: sale, isLoading } = useApiQuery<SaleDetail>(saleId ? `/api/sales/${saleId}` : null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const toast = useToast()

  async function handleCancel() {
    if (!sale) return
    try {
      await apiFetch(`/api/sales/${sale.id}/cancel`, { method: "POST" })
      toast.add({ title: "Venda cancelada", type: "success" })
      onChanged()
      onOpenChange(false)
    } catch (err) {
      toast.add({
        title: "Não foi possível cancelar",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
      throw err
    }
  }

  return (
    <>
      <Dialog open={!!saleId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Venda {sale ? `#${sale.sale_number}` : ""}</DialogTitle>
            <DialogDescription>{sale ? formatDateTimeBR(sale.sale_datetime) : ""}</DialogDescription>
          </DialogHeader>

          {isLoading || !sale ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Badge variant={sale.status === "concluida" ? "success" : "destructive"}>
                  {sale.status === "concluida" ? "Concluída" : "Cancelada"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[sale.payment_method] ?? sale.payment_method}
                </span>
              </div>

              {sale.week_name && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Semana: </span>
                  {sale.week_name}
                </p>
              )}

              {sale.customer_name && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Cliente: </span>
                  {sale.customer_name}
                </p>
              )}

              <div className="rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Produto</th>
                      <th className="px-3 py-2 text-right font-medium">Qtd.</th>
                      <th className="px-3 py-2 text-right font-medium">Preço</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{item.product_name_snapshot}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCentsBRL(item.unit_price_cents)}</td>
                        <td className="px-3 py-2 text-right">{formatCentsBRL(item.line_total_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCentsBRL(sale.subtotal_cents)}</span>
                </div>
                {sale.discount_cents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Desconto</span>
                    <span>-{formatCentsBRL(sale.discount_cents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCentsBRL(sale.total_cents)}</span>
                </div>
                {sale.payment_method === "dinheiro" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recebido</span>
                      <span>{formatCentsBRL(sale.amount_received_cents)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Troco</span>
                      <span>{formatCentsBRL(sale.change_cents)}</span>
                    </div>
                  </>
                )}
              </div>

              {sale.notes && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Observações: </span>
                  {sale.notes}
                </p>
              )}

              <DialogFooter>
                {sale.status === "concluida" && (
                  <>
                    <Button variant="outline" onClick={() => onEdit(sale)}>
                      Editar
                    </Button>
                    <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
                      Cancelar venda
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancelar venda"
        description={`A venda #${sale?.sale_number} será marcada como cancelada e o estoque reservado será devolvido. Esta ação não pode ser desfeita.`}
        confirmLabel="Cancelar venda"
        onConfirm={handleCancel}
      />
    </>
  )
}
