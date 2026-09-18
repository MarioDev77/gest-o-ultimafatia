export function formatCentsBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—"
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function formatDateBR(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("pt-BR")
}

export function formatDateTimeBR(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return `${value.toFixed(1).replace(".", ",")}%`
}
