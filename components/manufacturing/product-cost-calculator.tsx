"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { formatCentsBRL } from "@/lib/format"
import type { Ingredient, Product, ProductIngredientRow } from "@/lib/types"

type Row = { ingredientId: string; quantityUsed: string }

export function ProductCostCalculator({ ingredients }: { ingredients: Ingredient[] }) {
  const { data: productsData } = useApiQuery<{ items: Product[] }>("/api/products")
  const products = productsData?.items ?? []

  const [productId, setProductId] = useState("")
  const [rows, setRows] = useState<Row[]>([])
  const [applyToProduct, setApplyToProduct] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  const { data: current, refetch } = useApiQuery<{ items: ProductIngredientRow[]; totalCostCents: number }>(
    productId ? `/api/manufacturing/products/${productId}/ingredients` : null
  )

  useEffect(() => {
    if (current) {
      setRows(
        current.items.length > 0
          ? current.items.map((i) => ({ ingredientId: i.ingredient_id, quantityUsed: i.quantity_used.replace(".", ",") }))
          : []
      )
    }
  }, [current])

  function ingredientById(id: string) {
    return ingredients.find((i) => i.id === id)
  }

  const previewTotalCents = rows.reduce((sum, row) => {
    const ingredient = ingredientById(row.ingredientId)
    const qty = Number.parseFloat(row.quantityUsed.replace(",", "."))
    if (!ingredient || !qty) return sum
    return sum + Number(ingredient.unit_cost_cents) * qty
  }, 0)

  async function handleSave() {
    const validRows = rows.filter((r) => r.ingredientId && Number.parseFloat(r.quantityUsed.replace(",", ".")) > 0)
    if (!productId) return

    setIsSubmitting(true)
    try {
      const result = await apiFetch<{ totalCostCents: number; appliedToProduct: boolean }>(
        `/api/manufacturing/products/${productId}/ingredients`,
        {
          method: "PUT",
          body: {
            items: validRows.map((r) => ({ ingredientId: r.ingredientId, quantityUsed: Number.parseFloat(r.quantityUsed.replace(",", ".")) })),
            applyCostToProduct: applyToProduct,
          },
        }
      )
      toast.add({
        title: "Custo de fabricação salvo",
        description: result.appliedToProduct ? `Aplicado ao produto: ${formatCentsBRL(result.totalCostCents)}` : undefined,
        type: "success",
      })
      refetch()
    } catch (err) {
      toast.add({
        title: "Não foi possível salvar",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Custo de fabricação por produto</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select value={productId} onChange={(e) => setProductId(e.target.value)} className="sm:w-64">
          <option value="">Selecione um produto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        {productId && (
          <>
            <div className="flex flex-col gap-2">
              {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ingrediente vinculado ainda.</p>}
              {rows.map((row, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      value={row.ingredientId}
                      onChange={(e) => setRows((r) => r.map((row2, i) => (i === index ? { ...row2, ingredientId: e.target.value } : row2)))}
                    >
                      <option value="">Selecione o ingrediente</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Input
                    className="w-28"
                    inputMode="decimal"
                    placeholder="Qtd. usada"
                    value={row.quantityUsed}
                    onChange={(e) => setRows((r) => r.map((row2, i) => (i === index ? { ...row2, quantityUsed: e.target.value } : row2)))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover"
                    onClick={() => setRows((r) => r.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setRows((r) => [...r, { ingredientId: "", quantityUsed: "" }])}>
                <Plus className="size-3.5" />
                Adicionar ingrediente
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Custo total calculado</span>
              <span className="font-semibold">{formatCentsBRL(Math.round(previewTotalCents))}</span>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={applyToProduct} onChange={(e) => setApplyToProduct(e.target.checked)} className="size-4 rounded border-input" />
              Aplicar este valor ao custo de fabricação do produto
            </label>

            <Button type="button" onClick={handleSave} disabled={isSubmitting} className="self-start">
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
