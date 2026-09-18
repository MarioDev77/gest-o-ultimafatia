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
import { Textarea } from "@/components/ui/textarea"
import { PhotoUploadField } from "@/components/shared/photo-upload-field"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import type { Product } from "@/lib/types"

type FormState = {
  name: string
  description: string
  category: string
  unit: string
  salePrice: string // reais, ex: "8,00"
  manufacturingCost: string
  stockQuantity: string
  status: "ativo" | "inativo"
  photoKey: string | null
  photoPreview: string | null
}

function centsToInput(cents: number | null): string {
  if (cents === null || cents === undefined) return ""
  return (cents / 100).toFixed(2).replace(".", ",")
}

function inputToCents(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    category: "",
    unit: "unidade",
    salePrice: "",
    manufacturingCost: "",
    stockQuantity: "0",
    status: "ativo",
    photoKey: null,
    photoPreview: null,
  }
}

function productToForm(product: Product): FormState {
  return {
    name: product.name,
    description: product.description ?? "",
    category: product.category ?? "",
    unit: product.unit,
    salePrice: centsToInput(product.sale_price_cents),
    manufacturingCost: centsToInput(product.manufacturing_cost_cents),
    stockQuantity: String(product.stock_quantity),
    status: product.status,
    photoKey: product.photo_key,
    photoPreview: product.photo_url,
  }
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    if (open) setForm(product ? productToForm(product) : emptyForm())
    setError(null)
  }, [open, product])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError("Informe o nome do produto")
      return
    }
    setIsSubmitting(true)
    setError(null)

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      unit: form.unit.trim() || "unidade",
      salePriceCents: inputToCents(form.salePrice),
      manufacturingCostCents: inputToCents(form.manufacturingCost),
      stockQuantity: Number.parseInt(form.stockQuantity, 10) || 0,
      status: form.status,
      photoKey: form.photoKey ?? undefined,
    }

    try {
      if (product) {
        await apiFetch(`/api/products/${product.id}`, { method: "PATCH", body })
        toast.add({ title: "Produto atualizado", type: "success" })
      } else {
        await apiFetch("/api/products", { method: "POST", body })
        toast.add({ title: "Produto cadastrado", type: "success" })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível salvar o produto"
      setError(message)
      toast.add({ title: "Erro ao salvar", description: message, type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Cadastrar produto"}</DialogTitle>
          <DialogDescription>
            {product ? "Altere os dados e salve." : "Preencha os dados do novo produto."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <PhotoUploadField
              previewUrl={form.photoPreview}
              onUploaded={(key, preview) => setForm((f) => ({ ...f, photoKey: key, photoPreview: preview }))}
              onCleared={() => setForm((f) => ({ ...f, photoKey: null, photoPreview: null }))}
            />
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Nome do produto</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Morango Cravejado"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Ex: Doces"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Detalhes do produto (opcional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salePrice">Preço de venda (R$)</Label>
              <Input
                id="salePrice"
                inputMode="decimal"
                value={form.salePrice}
                onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manufacturingCost">Custo de fabricação (R$)</Label>
              <Input
                id="manufacturingCost"
                inputMode="decimal"
                value={form.manufacturingCost}
                onChange={(e) => setForm((f) => ({ ...f, manufacturingCost: e.target.value }))}
                placeholder="0,00"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stockQuantity">Estoque</Label>
              <Input
                id="stockQuantity"
                type="number"
                min={0}
                inputMode="numeric"
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">Unidade de venda</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="unidade"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:w-48">
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "ativo" | "inativo" }))}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
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
