"use client"

import { useMemo, useState } from "react"
import { Plus, Search, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { resolvePeriod } from "@/lib/period"
import { formatCentsBRL, formatDateBR } from "@/lib/format"
import { EXPENSE_CATEGORY_OPTIONS, type Expense, type ExpenseCategory } from "@/lib/types"

export default function DespesasPage() {
  const [range] = useState(() => resolvePeriod("mes-atual"))
  const [category, setCategory] = useState<ExpenseCategory | "">("")
  const [search, setSearch] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)

  const query = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to, limit: "200" })
    if (category) params.set("category", category)
    if (search.trim()) params.set("search", search.trim())
    return params.toString()
  }, [range, category, search])

  const { data, isLoading, refetch } = useApiQuery<{ items: Expense[] }>(`/api/expenses?${query}`)
  const expenses = data?.items ?? []
  const total = expenses.reduce((sum, e) => sum + e.amount_cents, 0)
  const toast = useToast()

  function openCreate() {
    setEditingExpense(null)
    setFormOpen(true)
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiFetch(`/api/expenses/${deleteTarget.id}`, { method: "DELETE" })
      toast.add({ title: "Despesa excluída", type: "success" })
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

  const categoryLabel = (value: ExpenseCategory) => EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {expenses.length} despesa(s) · Total: <span className="font-semibold text-foreground">{formatCentsBRL(total)}</span>
        </p>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Nova Despesa
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 pl-8" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | "")} className="w-44">
          <option value="">Todas categorias</option>
          {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma despesa no período selecionado.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2 md:hidden">
            {expenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="flex items-center justify-between gap-2 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{expense.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(expense.expense_date)} · {categoryLabel(expense.category)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-semibold">{formatCentsBRL(expense.amount_cents)}</span>
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(expense)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setDeleteTarget(expense)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">{expense.description}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{categoryLabel(expense.category)}</Badge>
                    </td>
                    <td className="px-4 py-3">{formatDateBR(expense.expense_date)}</td>
                    <td className="px-4 py-3 capitalize">{expense.payment_method}</td>
                    <td className="px-4 py-3 font-medium">{formatCentsBRL(expense.amount_cents)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => openEdit(expense)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => setDeleteTarget(expense)}>
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

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editingExpense} onSaved={refetch} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir despesa"
        description={`Tem certeza que deseja excluir "${deleteTarget?.description}"?`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}
