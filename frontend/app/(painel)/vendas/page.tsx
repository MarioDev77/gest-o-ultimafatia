"use client"

import { useMemo, useState } from "react"
import { Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SaleFormDialog } from "@/components/sales/sale-form-dialog"
import { SaleDetailDialog } from "@/components/sales/sale-detail-dialog"
import { SaleEditDialog } from "@/components/sales/sale-edit-dialog"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { resolvePeriod } from "@/lib/period"
import { formatCentsBRL, formatDateTimeBR } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/types"
import type { Sale, SaleDetail, SaleStatus, SaleWeek, PaymentMethod } from "@/lib/types"

export default function VendasPage() {
  const [range] = useState(() => resolvePeriod("mes-atual"))
  const [status, setStatus] = useState<SaleStatus | "">("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("")
  const [search, setSearch] = useState("")
  const [weekId, setWeekId] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editingSale, setEditingSale] = useState<SaleDetail | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const toast = useToast()

  const query = useMemo(() => {
    const params = new URLSearchParams({ from: range.from, to: range.to, limit: "100" })
    if (status) params.set("status", status)
    if (paymentMethod) params.set("paymentMethod", paymentMethod)
    if (search.trim()) params.set("search", search.trim())
    if (weekId) params.set("weekId", weekId)
    return params.toString()
  }, [range, status, paymentMethod, search, weekId])

  const { data, isLoading, refetch } = useApiQuery<{ items: Sale[] }>(`/api/sales?${query}`)
  const sales = data?.items ?? []
  const { data: weeksData } = useApiQuery<{ items: SaleWeek[] }>("/api/weeks")
  const weeks = weeksData?.items ?? []

  function refetchAll() {
    refetch()
  }

  async function handleDeleteAll() {
    try {
      const result = await apiFetch<{ deleted: number }>("/api/sales", { method: "DELETE" })
      toast.add({ title: `${result.deleted} venda(s) apagada(s)`, type: "success" })
      refetchAll()
    } catch (err) {
      toast.add({
        title: "Não foi possível apagar as vendas",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
      throw err
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{sales.length} venda(s) no mês atual</p>
        <div className="flex items-center gap-2">
          <Button variant="destructive" onClick={() => setConfirmDeleteAll(true)}>
            <Trash2 className="size-4" />
            Apagar todas as vendas
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Nova Venda
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 pl-8"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as SaleStatus | "")} className="w-40">
          <option value="">Todos status</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </Select>
        <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")} className="w-40">
          <option value="">Todo pagamento</option>
          <option value="pix">PIX</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="cartao">Cartão</option>
        </Select>
        <Select value={weekId} onChange={(e) => setWeekId(e.target.value)} className="w-44">
          <option value="">Todas as semanas</option>
          <option value="none">Sem semana</option>
          {weeks.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
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
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma venda encontrada para o filtro selecionado.
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-2 md:hidden">
            {sales.map((sale) => (
              <Card key={sale.id} className="cursor-pointer" onClick={() => setDetailId(sale.id)}>
                <CardContent className="flex items-center justify-between pt-4">
                  <div>
                    <p className="text-sm font-medium">
                      #{sale.sale_number} · {sale.customer_name ?? "Cliente não informado"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeBR(sale.sale_datetime)}
                      {sale.week_name ? ` · ${sale.week_name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCentsBRL(sale.total_cents)}</p>
                    <Badge variant={sale.status === "concluida" ? "success" : "destructive"} className="mt-1">
                      {sale.status === "concluida" ? "Concluída" : "Cancelada"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nº</th>
                  <th className="px-4 py-3 font-medium">Data/Hora</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Semana</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
                    onClick={() => setDetailId(sale.id)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">#{sale.sale_number}</td>
                    <td className="px-4 py-3">{formatDateTimeBR(sale.sale_datetime)}</td>
                    <td className="px-4 py-3">{sale.customer_name ?? "—"}</td>
                    <td className="px-4 py-3">{sale.week_name ?? "—"}</td>
                    <td className="px-4 py-3">{PAYMENT_METHOD_LABELS[sale.payment_method] ?? sale.payment_method}</td>
                    <td className="px-4 py-3 font-medium">{formatCentsBRL(sale.total_cents)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={sale.status === "concluida" ? "success" : "destructive"}>
                        {sale.status === "concluida" ? "Concluída" : "Cancelada"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <SaleFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={refetchAll} />

      <SaleDetailDialog
        saleId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onChanged={refetchAll}
        onEdit={(sale) => {
          setDetailId(null)
          setEditingSale(sale)
        }}
      />

      <SaleEditDialog sale={editingSale} onOpenChange={(open) => !open && setEditingSale(null)} onSaved={refetchAll} />

      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Apagar todas as vendas"
        description="TODAS as vendas do sistema serão apagadas de vez (não só as desta lista/filtro), e o estoque reservado por elas será devolvido aos produtos. Essa ação não pode ser desfeita."
        confirmLabel="Apagar tudo"
        onConfirm={handleDeleteAll}
      />
    </div>
  )
}
