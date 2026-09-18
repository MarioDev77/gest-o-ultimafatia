"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCentsBRL } from "@/lib/format"
import { PAYMENT_METHOD_LABELS, type PaymentMethodRow } from "@/lib/types"
import { EmptyChart } from "@/components/dashboard/revenue-trend-chart"

const COLORS = ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

export function PaymentMethodsChart({ data }: { data: PaymentMethodRow[] }) {
  const chartData = data.map((d) => ({
    name: PAYMENT_METHOD_LABELS[d.payment_method] ?? d.payment_method,
    value: d.revenue_cents,
    count: d.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Formas de pagamento</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-2">
        {chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCentsBRL(v).replace("R$", "").trim()}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--foreground)" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip
                formatter={(value, _name, item) => [`${formatCentsBRL(Number(value ?? 0))} (${item.payload.count} vendas)`, "Total"]}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
