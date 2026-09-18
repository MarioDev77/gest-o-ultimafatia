"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { resolvePeriod, type DateRange, type PeriodPreset } from "@/lib/period"
import { formatCentsBRL } from "@/lib/format"
import type { CashFlow } from "@/lib/types"

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}
function inputToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

export default function CaixaPage() {
  const [preset, setPreset] = useState<PeriodPreset>("hoje")
  const [customRange, setCustomRange] = useState<DateRange>(() => resolvePeriod("hoje"))
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false)

  const period = preset === "personalizado" ? customRange : resolvePeriod(preset)

  const { data: flow, isLoading, refetch } = useApiQuery<CashFlow>(`/api/cash-flow?from=${period.from}&to=${period.to}`)

  return (
    <div className="flex flex-col gap-5">
      <PeriodFilter preset={preset} custom={customRange} onPresetChange={setPreset} onCustomChange={setCustomRange} />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {!flow?.hasData && (
            <p className="text-xs text-muted-foreground lg:col-span-3">
              Nenhuma venda ou despesa registrada neste período ainda — os valores abaixo refletem isso.
            </p>
          )}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-semibold text-foreground">Saldo inicial</CardTitle>
              <Button variant="ghost" size="icon" aria-label="Editar saldo inicial" onClick={() => setOpeningDialogOpen(true)}>
                <Pencil className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{formatCentsBRL(flow?.openingBalanceCents ?? 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Entradas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <Row label="Vendas em dinheiro" value={flow?.inflows.cashSalesCents ?? 0} />
              <Row label="PIX" value={flow?.inflows.pixCents ?? 0} />
              <Row label="Cartão" value={flow?.inflows.cardCents ?? 0} />
              <Row label="Total" value={flow?.inflows.totalCents ?? 0} bold tone="positive" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Saídas</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <Row label="Despesas" value={flow?.outflows.expensesCents ?? 0} />
              <Row label="Troco entregue" value={flow?.outflows.changeGivenCents ?? 0} />
              <Row label="Total" value={flow?.outflows.totalCents ?? 0} bold tone="negative" />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardContent className="flex items-center justify-between pt-5">
              <span className="text-sm font-semibold text-muted-foreground">Saldo final</span>
              <span
                className={`text-2xl font-bold tabular-nums ${(flow?.closingBalanceCents ?? 0) < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {formatCentsBRL(flow?.closingBalanceCents ?? 0)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      <OpeningBalanceDialog
        open={openingDialogOpen}
        onOpenChange={setOpeningDialogOpen}
        date={period.from}
        currentCents={flow?.openingBalanceCents ?? 0}
        onSaved={refetch}
      />
    </div>
  )
}

function Row({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: "positive" | "negative" }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-border pt-1.5 font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={tone === "positive" ? "text-emerald-600 dark:text-emerald-400" : tone === "negative" ? "text-destructive" : ""}>
        {formatCentsBRL(value)}
      </span>
    </div>
  )
}

function OpeningBalanceDialog({
  open,
  onOpenChange,
  date,
  currentCents,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  currentCents: number
  onSaved: () => void
}) {
  const [value, setValue] = useState(centsToInput(currentCents))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await apiFetch("/api/cash-flow/opening", {
        method: "PUT",
        body: { date, openingBalanceCents: inputToCents(value) },
      })
      toast.add({ title: "Saldo inicial atualizado", type: "success" })
      onSaved()
      onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saldo inicial do caixa</DialogTitle>
          <DialogDescription>Valor em dinheiro no início do dia {date.split("-").reverse().join("/")}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="openingValue">Saldo inicial (R$)</Label>
            <Input id="openingValue" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" autoFocus />
          </div>
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
