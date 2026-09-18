"use client"

import { useMemo, useState } from "react"
import { DollarSign, Receipt, TrendingDown, TrendingUp, Wallet, Banknote, QrCode, Undo2, ShoppingBag } from "lucide-react"
import { StatCard } from "@/components/dashboard/stat-card"
import { PeriodFilter } from "@/components/dashboard/period-filter"
import { RevenueTrendChart } from "@/components/dashboard/revenue-trend-chart"
import { PaymentMethodsChart } from "@/components/dashboard/payment-methods-chart"
import { ExpensesByCategoryChart } from "@/components/dashboard/expenses-by-category-chart"
import { TopProductsChart } from "@/components/dashboard/top-products-chart"
import { useApiQuery } from "@/lib/hooks/use-api-query"
import { resolvePeriod, type PeriodPreset, type DateRange } from "@/lib/period"
import { formatCentsBRL, formatPercent } from "@/lib/format"
import type { ChartsData, FinancialSummary, ProductsSummary, QuickStats } from "@/lib/types"

function daysBetween(range: DateRange) {
  const from = new Date(range.from)
  const to = new Date(range.to)
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<PeriodPreset>("mes-atual")
  const [customRange, setCustomRange] = useState<DateRange>(() => resolvePeriod("mes-atual"))

  const period = useMemo(
    () => (preset === "personalizado" ? customRange : resolvePeriod(preset)),
    [preset, customRange]
  )
  const groupBy = daysBetween(period) > 60 ? "month" : "day"

  const { data: quickStats, isLoading: loadingQuickStats } = useApiQuery<QuickStats>("/api/dashboard/quick-stats")
  const { data: summary, isLoading: loadingSummary } = useApiQuery<FinancialSummary>(
    `/api/dashboard/summary?from=${period.from}&to=${period.to}`
  )
  const { data: products, isLoading: loadingProducts } = useApiQuery<ProductsSummary>(
    `/api/dashboard/products?from=${period.from}&to=${period.to}`
  )
  const { data: charts, isLoading: loadingCharts } = useApiQuery<ChartsData>(
    `/api/dashboard/charts?from=${period.from}&to=${period.to}&groupBy=${groupBy}`
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Cards fixos: sempre relativos a hoje, independentes do filtro abaixo */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Faturamento do dia" value={formatCentsBRL(quickStats?.revenueTodayCents)} icon={DollarSign} isLoading={loadingQuickStats} />
        <StatCard label="Faturamento da semana" value={formatCentsBRL(quickStats?.revenueWeekCents)} icon={DollarSign} isLoading={loadingQuickStats} />
        <StatCard label="Faturamento do mês" value={formatCentsBRL(quickStats?.revenueMonthCents)} icon={DollarSign} isLoading={loadingQuickStats} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Resumo do período</h2>
        </div>
        <PeriodFilter preset={preset} custom={customRange} onPresetChange={setPreset} onCustomChange={setCustomRange} />

        {!loadingSummary && summary && !summary.hasData ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Sem dados no período selecionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard label="Faturamento" value={formatCentsBRL(summary?.revenueCents)} icon={TrendingUp} isLoading={loadingSummary} />
            <StatCard label="Total de vendas" value={String(summary?.salesCount ?? 0)} icon={ShoppingBag} isLoading={loadingSummary} />
            <StatCard label="Ticket médio" value={formatCentsBRL(summary?.averageTicketCents)} icon={Receipt} isLoading={loadingSummary} />
            <StatCard label="Total de despesas" value={formatCentsBRL(summary?.expensesCents)} icon={TrendingDown} isLoading={loadingSummary} tone="negative" />
            <StatCard label="Custo de fabricação" value={formatCentsBRL(summary?.totalCostCents)} icon={ShoppingBag} isLoading={loadingSummary} />
            <StatCard label="Lucro bruto" value={formatCentsBRL(summary?.grossProfitCents)} icon={TrendingUp} isLoading={loadingSummary} tone="positive" />
            <StatCard
              label="Lucro líquido"
              value={formatCentsBRL(summary?.netProfitCents)}
              icon={Wallet}
              isLoading={loadingSummary}
              tone={summary && summary.netProfitCents < 0 ? "negative" : "positive"}
              hint={summary?.profitMarginPct !== undefined ? `Margem: ${formatPercent(summary?.profitMarginPct)}` : undefined}
            />
            <StatCard label="Recebido via PIX" value={formatCentsBRL(summary?.pixRevenueCents)} icon={QrCode} isLoading={loadingSummary} />
            <StatCard label="Recebido em dinheiro" value={formatCentsBRL(summary?.cashRevenueCents)} icon={Banknote} isLoading={loadingSummary} />
            <StatCard label="Troco entregue" value={formatCentsBRL(summary?.changeGivenCents)} icon={Undo2} isLoading={loadingSummary} />
          </div>
        )}
      </section>

      {products?.hasData && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Mais vendido" value={products.bestSellerByQuantity ?? "—"} isLoading={loadingProducts} />
          <StatCard label="Maior faturamento" value={products.topRevenueProduct ?? "—"} isLoading={loadingProducts} />
          <StatCard label="Maior lucro" value={products.topProfitProduct ?? "—"} isLoading={loadingProducts} />
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 transition-opacity xl:grid-cols-2 data-[loading=true]:opacity-60" data-loading={loadingCharts}>
        <div className="xl:col-span-2">
          <RevenueTrendChart data={charts?.daily ?? []} />
        </div>
        <PaymentMethodsChart data={charts?.paymentMethods ?? []} />
        <ExpensesByCategoryChart data={charts?.expensesByCategory ?? []} />
        <div className="xl:col-span-2">
          <TopProductsChart data={charts?.topProducts ?? []} />
        </div>
      </section>
    </div>
  )
}
