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
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import type { Ingredient } from "@/lib/types"

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}
function inputToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

export function IngredientFormDialog({
  open,
  onOpenChange,
  ingredient,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient: Ingredient | null
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [unit, setUnit] = useState("kg")
  const [purchasedQuantity, setPurchasedQuantity] = useState("")
  const [purchasePrice, setPurchasePrice] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setName(ingredient?.name ?? "")
      setUnit(ingredient?.unit ?? "kg")
      setPurchasedQuantity(ingredient ? ingredient.purchased_quantity.replace(".", ",") : "")
      setPurchasePrice(ingredient ? centsToInput(ingredient.purchase_price_cents) : "")
      setError(null)
    }
  }, [open, ingredient])

  const quantityNum = Number.parseFloat(purchasedQuantity.replace(",", "."))
  const priceCents = inputToCents(purchasePrice)
  const unitCostPreview = quantityNum > 0 ? priceCents / quantityNum : 0

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError("Informe o nome do ingrediente")
      return
    }
    if (!quantityNum || quantityNum <= 0) {
      setError("Informe a quantidade comprada")
      return
    }
    if (priceCents <= 0) {
      setError("Informe o valor pago")
      return
    }

    setIsSubmitting(true)
    setError(null)
    const body = { name: name.trim(), unit: unit.trim(), purchasedQuantity: quantityNum, purchasePriceCents: priceCents }

    try {
      if (ingredient) {
        await apiFetch(`/api/manufacturing/ingredients/${ingredient.id}`, { method: "PATCH", body })
        toast.add({ title: "Ingrediente atualizado", type: "success" })
      } else {
        await apiFetch("/api/manufacturing/ingredients", { method: "POST", body })
        toast.add({ title: "Ingrediente cadastrado", type: "success" })
      }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ingredient ? "Editar ingrediente" : "Novo ingrediente"}</DialogTitle>
          <DialogDescription>O custo por unidade é calculado automaticamente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ingName">Ingrediente/material</Label>
            <Input id="ingName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Morango" required />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ingQuantity">Qtd. comprada</Label>
              <Input id="ingQuantity" inputMode="decimal" value={purchasedQuantity} onChange={(e) => setPurchasedQuantity(e.target.value)} placeholder="2,5" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ingUnit">Unidade</Label>
              <Input id="ingUnit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ingPrice">Valor pago (R$)</Label>
              <Input id="ingPrice" inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="35,00" required />
            </div>
          </div>

          {quantityNum > 0 && priceCents > 0 && (
            <p className="text-xs text-muted-foreground">
              Custo por {unit || "unidade"}: <span className="font-medium text-foreground">{(unitCostPreview / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </p>
          )}

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
