"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, Power, ImageOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ProductFormDialog } from "@/components/products/product-form-dialog"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { formatCentsBRL, formatPercent } from "@/lib/format"
import type { Product } from "@/lib/types"

export default function ProdutosPage() {
  const { data, isLoading, refetch } = useApiQuery<{ items: Product[] }>("/api/products")
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)

  const products = data?.items ?? []

  function openCreate() {
    setEditingProduct(null)
    setFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setFormOpen(true)
  }

  async function toggleStatus(product: Product) {
    const nextStatus = product.status === "ativo" ? "inativo" : "ativo"
    try {
      await apiFetch(`/api/products/${product.id}`, { method: "PATCH", body: { status: nextStatus } })
      toast.add({ title: nextStatus === "ativo" ? "Produto reativado" : "Produto inativado", type: "success" })
      refetch()
    } catch (err) {
      toast.add({
        title: "Não foi possível atualizar o status",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiFetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" })
      toast.add({ title: "Produto excluído", type: "success" })
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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{products.length} produto(s) cadastrado(s)</p>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Cadastrar Produto
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhum produto cadastrado ainda.
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onEdit={openEdit} onToggleStatus={toggleStatus} onDelete={setDeleteTarget} />
            ))}
          </div>

          {/* Desktop: tabela */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium">Preço</th>
                  <th className="px-4 py-3 font-medium">Custo</th>
                  <th className="px-4 py-3 font-medium">Margem</th>
                  <th className="px-4 py-3 font-medium">Estoque</th>
                  <th className="px-4 py-3 font-medium">Vendidos</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="flex items-center gap-2.5 px-4 py-3">
                      <ProductThumb product={product} />
                      <div>
                        <p className="font-medium text-foreground">{product.name}</p>
                        {product.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatCentsBRL(product.sale_price_cents)}</td>
                    <td className="px-4 py-3">{formatCentsBRL(product.manufacturing_cost_cents)}</td>
                    <td className="px-4 py-3">{formatPercent(product.profit_margin_pct)}</td>
                    <td className="px-4 py-3">{product.stock_quantity}</td>
                    <td className="px-4 py-3">{product.quantity_sold}</td>
                    <td className="px-4 py-3">
                      <Badge variant={product.status === "ativo" ? "success" : "secondary"}>
                        {product.status === "ativo" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => openEdit(product)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Ativar/Inativar" onClick={() => toggleStatus(product)}>
                          <Power className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => setDeleteTarget(product)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editingProduct} onSaved={refetch} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir produto"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Produtos com vendas registradas não podem ser excluídos — use inativar nesse caso.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function ProductThumb({ product }: { product: Product }) {
  if (product.photo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.photo_url} alt={product.name} className="size-9 rounded-md object-cover" />
  }
  return (
    <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <ImageOff className="size-4" />
    </div>
  )
}

function ProductCard({
  product,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  product: Product
  onEdit: (p: Product) => void
  onToggleStatus: (p: Product) => void
  onDelete: (p: Product) => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-start gap-3">
          <ProductThumb product={product} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{product.name}</p>
            {product.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
          </div>
          <Badge variant={product.status === "ativo" ? "success" : "secondary"}>
            {product.status === "ativo" ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Preço</p>
            <p className="font-medium text-foreground">{formatCentsBRL(product.sale_price_cents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Custo</p>
            <p className="font-medium text-foreground">{formatCentsBRL(product.manufacturing_cost_cents)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Estoque</p>
            <p className="font-medium text-foreground">{product.stock_quantity}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Vendidos</p>
            <p className="font-medium text-foreground">{product.quantity_sold}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(product)}>
            <Pencil className="size-3.5" />
            Editar
          </Button>
          <Button variant="outline" size="icon" aria-label="Ativar/Inativar" onClick={() => onToggleStatus(product)}>
            <Power className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Excluir" onClick={() => onDelete(product)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
