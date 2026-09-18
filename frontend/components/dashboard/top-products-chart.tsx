"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductBreakdownRow } from "@/lib/types"
import { EmptyChart } from "@/components/dashboard/revenue-trend-chart"

export function TopProductsChart({ data }: { data: ProductBreakdownRow[] }) {
  const chartData = data.slice(0, 8).map((d) => ({ name: d.name, value: d.quantitySold }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">Produtos mais vendidos</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-2">
        {chartData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "var(--foreground)" }} axisLine={false} tickLine={false} width={110} />
              <Tooltip
                formatter={(value) => [`${Number(value ?? 0)} un.`, "Vendidos"]}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18} fill="var(--chart-2)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
