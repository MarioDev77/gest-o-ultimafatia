"use client"

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCentsBRL, formatDateBR } from "@/lib/format"
import type { DailyPoint } from "@/lib/types"

export function RevenueTrendChart({ data }: { data: DailyPoint[] }) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatDateBR(d.date),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Faturamento, despesas e lucro</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-2">
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCentsBRL(v).replace("R$", "").trim()}
                width={56}
              />
              <Tooltip
                formatter={(value, name) => [formatCentsBRL(Number(value ?? 0)), String(name)]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenueCents" name="Faturamento" stroke="var(--chart-2)" fill="url(#revenueFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="expensesCents" name="Despesas" stroke="var(--chart-4)" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="netProfitCents" name="Lucro líquido" stroke="var(--chart-5)" fill="transparent" strokeWidth={2} strokeDasharray="4 3" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem dados no período selecionado.
    </div>
  )
}
