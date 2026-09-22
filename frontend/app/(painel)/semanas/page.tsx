"use client"

import { useState } from "react"
import { ArrowLeft, CalendarDays, FileDown, FileSpreadsheet, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { SaleFormDialog } from "@/components/sales/sale-form-dialog"
import { SaleDetailDialog } from "@/components/sales/sale-detail-dialog"
import { SaleEditDialog } from "@/components/sales/sale-edit-dialog"
import { WeekFormDialog } from "@/components/weeks/week-form-dialog"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError, downloadFile } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { formatCentsBRL, formatDateTimeBR } from "@/lib/format"
import { PAYMENT_METHOD_LABELS } from "@/lib/types"
import type { Sale, SaleDetail, SaleWeek } from "@/lib/types"

function reportFilename(weekName: string, format: "pdf" | "excel") {
  const safe = weekName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
  return `vendas_${safe}.${format === "pdf" ? "pdf" : "xlsx"}`
}

async function downloadWeekReport(weekId: string, weekName: string, format: "pdf" | "excel") {
  await downloadFile(`/api/reports/semana/${weekId}?format=${format}`, reportFilename(weekName, format))
}

export default function SemanasPage() {
  // Semana aberta no momento (null = tela com a lista de semanas). Guarda o
  // nome junto pra tela continuar estável enquanto a lista recarrega.
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null)

  return selected ? (
    <WeekDetail week={selected} onBack={() => setSelected(null)} />
  ) : (
    <WeekList onOpen={(week) => setSelected({ id: week.id, name: week.name })} />
  )
}

function WeekList({ onOpen }: { onOpen: (week: SaleWeek) => void }) {
  const { data, isLoading, refetch } = useApiQuery<{ items: SaleWeek[] }>("/api/weeks")
  const weeks = data?.items ?? []
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editingWeek, setEditingWeek] = useState<SaleWeek | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SaleWeek | null>(null)
  const [pendingReport, setPendingReport] = useState<string | null>(null)

  function openCreate() {
    setEditingWeek(null)
    setFormOpen(true)
  }

  function openRename(week: SaleWeek) {
    setEditingWeek(week)
    setFormOpen(true)
  }

  async function handleDownloadReport(week: SaleWeek, format: "pdf" | "excel") {
    const key = `${week.id}-${format}`
    setPendingReport(key)
    try {
      await downloadWeekReport(week.id, week.name, format)
    } catch (err) {
      toast.add({
        title: "Não foi possível gerar o relatório",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
    } finally {
      setPendingReport(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await apiFetch(`/api/weeks/${deleteTarget.id}`, { method: "DELETE" })
      toast.add({ title: "Semana excluída", type: "success" })
      refetch()
    } catch (err) {
      toast.add({
        title: "Não foi possível excluir",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{weeks.length} semana(s) criada(s)</p>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Criar nova semana
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : weeks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma semana criada ainda. Clique em &quot;Criar nova semana&quot; para começar.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weeks.map((week) => (
            <Card key={week.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => onOpen(week)}>
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{week.name}</p>
                  </div>
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Baixar relatório em PDF"
                      disabled={pendingReport === `${week.id}-pdf`}
                      onClick={() => handleDownloadReport(week, "pdf")}
                    >
                      {pendingReport === `${week.id}-pdf` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileDown className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Baixar relatório em Excel"
                      disabled={pendingReport === `${week.id}-excel`}
                      onClick={() => handleDownloadReport(week, "excel")}
                    >
                      {pendingReport === `${week.id}-excel` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="size-3.5" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Renomear semana" onClick={() => openRename(week)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Excluir semana" onClick={() => setDeleteTarget(week)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                    <p className="text-lg font-semibold">{formatCentsBRL(week.revenue_cents)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{week.sales_count} venda(s)</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WeekFormDialog open={formOpen} week={editingWeek} onOpenChange={setFormOpen} onSaved={refetch} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Excluir semana"
        description={`A semana "${deleteTarget?.name ?? ""}" será excluída${
          deleteTarget && deleteTarget.sales_count > 0
            ? ` junto com ${deleteTarget.sales_count} venda(s) registrada(s) nela (o estoque será devolvido)`
            : ""
        }. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function WeekDetail({ week, onBack }: { week: { id: string; name: string }; onBack: () => void }) {
  const { data, isLoading, refetch } = useApiQuery<{ items: Sale[] }>(`/api/sales?weekId=${week.id}&limit=200`)
  const sales = data?.items ?? []
  const completed = sales.filter((sale) => sale.status === "concluida")
  const revenueCents = completed.reduce((sum, sale) => sum + sale.total_cents, 0)

  const [formOpen, setFormOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editingSale, setEditingSale] = useState<SaleDetail | null>(null)
  const [pendingReport, setPendingReport] = useState<"pdf" | "excel" | null>(null)
  const toast = useToast()

  async function handleDownloadReport(format: "pdf" | "excel") {
    setPendingReport(format)
    try {
      await downloadWeekReport(week.id, week.name, format)
    } catch (err) {
      toast.add({
        title: "Não foi possível gerar o relatório",
        description: err instanceof ApiClientError ? err.message : undefined,
        type: "error",
      })
    } finally {
      setPendingReport(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Voltar para as semanas" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold">{week.name}</p>
            <p className="text-xs text-muted-foreground">
              {completed.length} venda(s) concluída(s) · {formatCentsBRL(revenueCents)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pendingReport === "pdf"} onClick={() => handleDownloadReport("pdf")}>
            {pendingReport === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            PDF
          </Button>
          <Button variant="outline" size="sm" disabled={pendingReport === "excel"} onClick={() => handleDownloadReport("excel")}>
            {pendingReport === "excel" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
            Excel
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Cadastrar nova venda
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : sales.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma venda nesta semana ainda. Clique em &quot;Cadastrar nova venda&quot; para registrar a primeira.
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
                    <p className="text-xs text-muted-foreground">{formatDateTimeBR(sale.sale_datetime)}</p>
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
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Nº</th>
                  <th className="px-4 py-3 font-medium">Data/Hora</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
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

      <SaleFormDialog open={formOpen} onOpenChange={setFormOpen} onSaved={refetch} fixedWeek={week} />

      <SaleDetailDialog
        saleId={detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
        onChanged={refetch}
        onEdit={(sale) => {
          setDetailId(null)
          setEditingSale(sale)
        }}
      />

      <SaleEditDialog sale={editingSale} onOpenChange={(open) => !open && setEditingSale(null)} onSaved={refetch} />
    </div>
  )
}
