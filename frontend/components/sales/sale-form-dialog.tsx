"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { formatCentsBRL } from "@/lib/format"
import type { PaymentMethod, Product } from "@/lib/types"

type ItemRow = { productId: string; quantity: string; unitPrice: string }

function centsFromInput(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

function emptyItem(): ItemRow {
  return { productId: "", quantity: "1", unitPrice: "" }
}

export function SaleFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { data: productsData } = useApiQuery<{ items: Product[] }>(open ? "/api/products?status=ativo" : null)
  const products = productsData?.items ?? []
  const toast = useToast()

  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [amountReceived, setAmountReceived] = useState("")
  const [discount, setDiscount] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setItems([emptyItem()])
      setPaymentMethod("pix")
      setAmountReceived("")
      setDiscount("")
      setCustomerName("")
      setNotes("")
      setError(null)
    }
  }, [open])

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function selectProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId)
    updateItem(index, {
      productId,
      unitPrice: product?.sale_price_cents != null ? (product.sale_price_cents / 100).toFixed(2).replace(".", ",") : "",
    })
  }

  const subtotalCents = useMemo(
    () => items.reduce((sum, row) => sum + centsFromInput(row.unitPrice) * (Number.parseInt(row.quantity, 10) || 0), 0),
    [items]
  )
  const discountCents = centsFromInput(discount)
  const totalCents = Math.max(0, subtotalCents - discountCents)
  const amountReceivedCents = centsFromInput(amountReceived)
  const changeCents = paymentMethod === "dinheiro" ? Math.max(0, amountReceivedCents - totalCents) : 0

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validItems = items.filter((row) => row.productId && Number.parseInt(row.quantity, 10) > 0)
    if (validItems.length === 0) {
      setError("Adicione pelo menos um item com produto e quantidade")
      return
    }
    if (paymentMethod === "dinheiro" && amountReceivedCents < totalCents) {
      setError("Valor recebido é menor que o total da venda")
      return
    }

    setIsSubmitting(true)
    try {
      await apiFetch("/api/sales", {
        method: "POST",
        body: {
          items: validItems.map((row) => ({
            productId: row.productId,
            quantity: Number.parseInt(row.quantity, 10),
            // Campo vazio -> não manda o campo, pra o backend cair no preço de
            // catálogo do produto (ou recusar a venda se o produto não tiver
            // preço cadastrado). Antes isso virava 0 e a venda saía de graça.
            unitPriceCents: row.unitPrice.trim() ? centsFromInput(row.unitPrice) : undefined,
          })),
          paymentMethod,
          amountReceivedCents: paymentMethod === "dinheiro" ? amountReceivedCents : undefined,
          discountCents: discountCents || undefined,
          customerName: customerName.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      })
      toast.add({ title: "Venda registrada", type: "success" })
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível registrar a venda"
      setError(message)
      toast.add({ title: "Erro ao registrar venda", description: message, type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova venda</DialogTitle>
          <DialogDescription>Selecione os produtos, a forma de pagamento e confirme.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Itens</Label>
            {items.map((row, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={row.productId} onChange={(e) => selectProduct(index, e.target.value)} required>
                    <option value="">Selecione o produto</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  type="number"
                  min={1}
                  className="w-16"
                  value={row.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  aria-label="Quantidade"
                />
                <Input
                  className="w-24"
                  inputMode="decimal"
                  placeholder="Preço"
                  value={row.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                  aria-label="Preço unitário"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover item"
                  disabled={items.length === 1}
                  onClick={() => setItems((rows) => rows.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setItems((rows) => [...rows, emptyItem()])}>
              <Plus className="size-3.5" />
              Adicionar item
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMethod">Forma de pagamento</Label>
              <Select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">Desconto (R$)</Label>
              <Input id="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0,00" />
            </div>
            {paymentMethod === "dinheiro" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amountReceived">Valor recebido (R$)</Label>
                <Input
                  id="amountReceived"
                  inputMode="decimal"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerName">Cliente (opcional)</Label>
            <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCentsBRL(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Desconto</span>
                <span>-{formatCentsBRL(discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCentsBRL(totalCents)}</span>
            </div>
            {paymentMethod === "dinheiro" && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Troco</span>
                <span>{formatCentsBRL(changeCents)}</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Registrando..." : "Registrar venda"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
