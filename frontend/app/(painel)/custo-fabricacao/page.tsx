"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { IngredientFormDialog } from "@/components/manufacturing/ingredient-form-dialog"
import { ProductCostCalculator } from "@/components/manufacturing/product-cost-calculator"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { formatCentsBRL } from "@/lib/format"
import type { Ingredient } from "@/lib/types"

export default function CustoFabricacaoPage() {
  const { data, isLoading, refetch } = useApiQuery<{ items: Ingredient[] }>("/api/manufacturing/ingredients")
  const ingredients = data?.items ?? []
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Ingredient | null>(null)

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiFetch(`/api/manufacturing/ingredients/${deleteTarget.id}`, { method: "DELETE" })
      toast.add({ title: "Ingrediente excluído", type: "success" })
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
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Ingredientes / materiais</h2>
          <Button
            size="sm"
            onClick={() => {
              setEditingIngredient(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" />
            Novo Ingrediente
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : ingredients.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum ingrediente cadastrado ainda.
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Ingrediente</th>
                  <th className="px-4 py-3 font-medium">Comprado</th>
                  <th className="px-4 py-3 font-medium">Valor pago</th>
                  <th className="px-4 py-3 font-medium">Custo/unidade</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => (
                  <tr key={ing.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{ing.name}</td>
                    <td className="px-4 py-3">
                      {Number(ing.purchased_quantity).toLocaleString("pt-BR")} {ing.unit}
                    </td>
                    <td className="px-4 py-3">{formatCentsBRL(ing.purchase_price_cents)}</td>
                    <td className="px-4 py-3">
                      {formatCentsBRL(Math.round(Number(ing.unit_cost_cents)))} / {ing.unit}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Editar"
                          onClick={() => {
                            setEditingIngredient(ing)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => setDeleteTarget(ing)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <ProductCostCalculator ingredients={ingredients} />

      <IngredientFormDialog open={formOpen} onOpenChange={setFormOpen} ingredient={editingIngredient} onSaved={refetch} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir ingrediente"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Ingredientes vinculados a um produto não podem ser excluídos.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}
