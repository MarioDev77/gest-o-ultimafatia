"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { formatCentsBRL } from "@/lib/format"
import type { PaymentMethod, SaleDetail } from "@/lib/types"

function centsFromInput(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}

export function SaleEditDialog({
  sale,
  onOpenChange,
  onSaved,
}: {
  sale: SaleDetail | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [discount, setDiscount] = useState("0,00")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [amountReceived, setAmountReceived] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (sale) {
      setCustomerName(sale.customer_name ?? "")
      setNotes(sale.notes ?? "")
      setDiscount(centsToInput(sale.discount_cents))
      setPaymentMethod(sale.payment_method)
      setAmountReceived(sale.amount_received_cents !== null ? centsToInput(sale.amount_received_cents) : "")
      setError(null)
    }
  }, [sale])

  if (!sale) return null

  const discountCents = centsFromInput(discount)
  const totalCents = Math.max(0, sale.subtotal_cents - discountCents)
  const amountReceivedCents = centsFromInput(amountReceived)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (discountCents > sale!.subtotal_cents) {
      setError("Desconto não pode ser maior que o subtotal")
      return
    }
    if (paymentMethod === "dinheiro" && amountReceivedCents < totalCents) {
      setError("Valor recebido é menor que o total da venda")
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch(`/api/sales/${sale!.id}`, {
        method: "PATCH",
        body: {
          customerName: customerName.trim() || null,
          notes: notes.trim() || null,
          discountCents,
          paymentMethod,
          amountReceivedCents: paymentMethod === "dinheiro" ? amountReceivedCents : null,
        },
      })
      toast.add({ title: "Venda atualizada", type: "success" })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível salvar"
      setError(message)
      toast.add({ title: "Erro ao salvar", description: message, type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={!!sale} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar venda #{sale.sale_number}</DialogTitle>
          <DialogDescription>
            Os produtos da venda não podem ser alterados aqui — cancele e registre uma nova venda se precisar mudar itens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editCustomerName">Cliente</Label>
            <Input id="editCustomerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editPaymentMethod">Forma de pagamento</Label>
              <Select id="editPaymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editDiscount">Desconto (R$)</Label>
              <Input id="editDiscount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>

          {paymentMethod === "dinheiro" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="editAmountReceived">Valor recebido (R$)</Label>
              <Input id="editAmountReceived" inputMode="decimal" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="editNotes">Observações</Label>
            <Textarea id="editNotes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-between rounded-lg bg-muted/50 p-3 text-sm font-medium">
            <span>Novo total</span>
            <span>{formatCentsBRL(totalCents)}</span>
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
