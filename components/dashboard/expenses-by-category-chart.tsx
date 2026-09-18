"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCentsBRL } from "@/lib/format"
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategoryRow } from "@/lib/types"
import { EmptyChart } from "@/components/dashboard/revenue-trend-chart"

export function ExpensesByCategoryChart({ data }: { data: ExpenseCategoryRow[] }) {
  const chartData = data.map((d) => ({
    name: EXPENSE_CATEGORY_LABELS[d.category] ?? d.category,
    value: d.amount_cents,
    count: d.count,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Despesas por categoria</CardTitle>
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
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--foreground)" }} axisLine={false} tickLine={false} width={92} />
              <Tooltip
                formatter={(value, _name, item) => [`${formatCentsBRL(Number(value ?? 0))} (${item.payload.count})`, "Total"]}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} fill="var(--chart-3)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
