"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Minus, Plus } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type { PaymentMethod, Product, SaleWeek } from "@/lib/types"

// Produtos marcados na venda: chave = id do produto. Produto fora do objeto = não selecionado.
type Selection = Record<string, { quantity: string; unitPrice: string }>

function centsFromInput(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

function priceToInput(cents: number | null): string {
  return cents != null ? (cents / 100).toFixed(2).replace(".", ",") : ""
}

export function SaleFormDialog({
  open,
  onOpenChange,
  onSaved,
  fixedWeek,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  // Quando informado (tela de uma semana), a venda é registrada nessa semana e
  // o campo de escolha de semana não aparece. Sem isso (aba Vendas), o campo
  // "Semana" aparece como opcional.
  fixedWeek?: { id: string; name: string }
}) {
  const { data: productsData } = useApiQuery<{ items: Product[] }>(open ? "/api/products?status=ativo" : null)
  const products = productsData?.items ?? []
  const { data: weeksData } = useApiQuery<{ items: SaleWeek[] }>(open && !fixedWeek ? "/api/weeks" : null)
  const weeks = weeksData?.items ?? []
  const [weekId, setWeekId] = useState("")
  const toast = useToast()

  const [selection, setSelection] = useState<Selection>({})
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix")
  const [amountReceived, setAmountReceived] = useState("")
  const [discount, setDiscount] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelection({})
      setPaymentMethod("pix")
      setAmountReceived("")
      setDiscount("")
      setCustomerName("")
      setNotes("")
      setWeekId("")
      setError(null)
    }
  }, [open])

  function toggleProduct(product: Product) {
    setSelection((current) => {
      if (current[product.id]) {
        const { [product.id]: _removed, ...rest } = current
        return rest
      }
      // Preço de catálogo entra preenchido; sem preço cadastrado fica vazio pra digitar.
      return { ...current, [product.id]: { quantity: "1", unitPrice: priceToInput(product.sale_price_cents) } }
    })
  }

  function updateSelection(productId: string, patch: Partial<Selection[string]>) {
    setSelection((current) => (current[productId] ? { ...current, [productId]: { ...current[productId], ...patch } } : current))
  }

  function changeQuantity(productId: string, delta: number) {
    const current = Number.parseInt(selection[productId]?.quantity ?? "1", 10) || 1
    updateSelection(productId, { quantity: String(Math.max(1, current + delta)) })
  }

  const subtotalCents = useMemo(
    () =>
      Object.values(selection).reduce(
        (sum, row) => sum + centsFromInput(row.unitPrice) * (Number.parseInt(row.quantity, 10) || 0),
        0
      ),
    [selection]
  )
  const discountCents = centsFromInput(discount)
  const totalCents = Math.max(0, subtotalCents - discountCents)
  const amountReceivedCents = centsFromInput(amountReceived)
  const changeCents = paymentMethod === "dinheiro" ? Math.max(0, amountReceivedCents - totalCents) : 0

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validItems = Object.entries(selection)
      .map(([productId, row]) => ({ productId, ...row }))
      .filter((row) => Number.parseInt(row.quantity, 10) > 0)
    if (validItems.length === 0) {
      setError("Selecione pelo menos um produto")
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
          weekId: fixedWeek?.id ?? (weekId || undefined),
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
          <DialogDescription>
            {fixedWeek ? `Venda da semana: ${fixedWeek.name}.` : "Selecione os produtos, a forma de pagamento e confirme."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Produtos (toque em um ou mais)</Label>
            {!productsData ? (
              <p className="text-sm text-muted-foreground">Carregando produtos...</p>
            ) : products.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum produto ativo cadastrado.</p>
            ) : (
              products.map((product) => {
                const row = selection[product.id]
                const selected = !!row
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      selected ? "border-primary/60 bg-primary/5" : "border-border"
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleProduct(product)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        )}
                      >
                        {selected && <Check className="size-3.5" />}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {product.sale_price_cents != null ? formatCentsBRL(product.sale_price_cents) : "Sem preço cadastrado"}
                          {" · "}Estoque: {product.stock_quantity}
                        </span>
                      </span>
                    </button>

                    {selected && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 pl-8">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Diminuir quantidade de ${product.name}`}
                            onClick={() => changeQuantity(product.id, -1)}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            className="w-16 text-center"
                            value={row.quantity}
                            onChange={(e) => updateSelection(product.id, { quantity: e.target.value })}
                            aria-label={`Quantidade de ${product.name}`}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={`Aumentar quantidade de ${product.name}`}
                            onClick={() => changeQuantity(product.id, 1)}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Preço (R$)</span>
                          <Input
                            className="w-24"
                            inputMode="decimal"
                            placeholder="0,00"
                            value={row.unitPrice}
                            onChange={(e) => updateSelection(product.id, { unitPrice: e.target.value })}
                            aria-label={`Preço unitário de ${product.name}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
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

          {!fixedWeek && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="saleWeek">Semana (opcional)</Label>
              <Select id="saleWeek" value={weekId} onChange={(e) => setWeekId(e.target.value)}>
                <option value="">Sem semana</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

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
