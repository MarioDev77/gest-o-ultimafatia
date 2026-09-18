export type PeriodPreset = "hoje" | "ontem" | "7dias" | "mes-atual" | "mes-anterior" | "personalizado"

export type DateRange = { from: string; to: string }

function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  "7dias": "Últimos 7 dias",
  "mes-atual": "Este mês",
  "mes-anterior": "Mês anterior",
  personalizado: "Personalizado",
}

// Datas calculadas no fuso do navegador de quem está usando o painel (o
// comerciante), consistente com o backend que roda tudo em America/Bahia.
export function resolvePeriod(preset: PeriodPreset, custom?: DateRange): DateRange {
  const today = new Date()

  switch (preset) {
    case "hoje":
      return { from: toDateStr(today), to: toDateStr(today) }
    case "ontem": {
      const yesterday = addDays(today, -1)
      return { from: toDateStr(yesterday), to: toDateStr(yesterday) }
    }
    case "7dias":
      return { from: toDateStr(addDays(today, -6)), to: toDateStr(today) }
    case "mes-atual": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toDateStr(start), to: toDateStr(today) }
    }
    case "mes-anterior": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { from: toDateStr(start), to: toDateStr(end) }
    }
    case "personalizado":
      return custom ?? { from: toDateStr(today), to: toDateStr(today) }
  }
}
