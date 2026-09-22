import ExcelJS from "exceljs"
import { REPORT_TITLES, type ReportType } from "./reportService"

function money(cents: number) {
  return cents / 100
}

// Mesmo fuso configurado na conexão do banco (ver backend/src/db/pool.ts) — sem
// isso, o servidor formata a data/hora no seu próprio fuso (normalmente UTC),
// mostrando um horário até 3h adiantado (ou o dia errado) no relatório.
const TZ = "America/Bahia"
function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString("pt-BR", { timeZone: TZ })
}
function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: TZ })
}

const MONEY_FORMAT = '"R$" #,##0.00'

const CATEGORY_LABELS: Record<string, string> = {
  materia_prima: "Matéria-prima",
  embalagens: "Embalagens",
  transporte: "Transporte",
  marketing: "Marketing",
  equipamentos: "Equipamentos",
  taxas: "Taxas",
  outros: "Outros",
}

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  conferido: "Conferido",
  divergente: "Divergente",
  concluida: "Concluída",
  cancelada: "Cancelada",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildExcelReport(type: ReportType, data: any): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Última Fatia — Painel Financeiro"
  workbook.created = new Date()

  const summarySheet = workbook.addWorksheet("Resumo")
  summarySheet.columns = [{ width: 32 }, { width: 20 }]
  summarySheet.addRow([REPORT_TITLES[type]]).font = { bold: true, size: 14 }
  summarySheet.addRow([
    data.weekName ? `Semana: ${data.weekName} (${data.period.from} a ${data.period.to})` : `Período: ${data.period.from} a ${data.period.to}`,
  ])
  summarySheet.addRow([])

  if (!hasAnyData(type, data)) {
    summarySheet.addRow(["Sem dados no período selecionado."])
    return workbook.xlsx.writeBuffer()
  }

  switch (type) {
    case "vendas": {
      addSummaryRows(summarySheet, [
        ["Total de vendas", data.summary.salesCount],
        ["Faturamento", money(data.summary.revenueCents), MONEY_FORMAT],
        ["Ticket médio", data.summary.averageTicketCents !== null ? money(data.summary.averageTicketCents) : "-", MONEY_FORMAT],
      ])
      const sheet = workbook.addWorksheet("Vendas")
      sheet.columns = [
        { header: "Nº", key: "n", width: 8 },
        { header: "Data/Hora", key: "dt", width: 20 },
        { header: "Cliente", key: "customer", width: 24 },
        { header: "Pagamento", key: "payment", width: 14 },
        { header: "Subtotal", key: "subtotal", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Desconto", key: "discount", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Total", key: "total", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Status", key: "status", width: 14 },
      ]
      sheet.getRow(1).font = { bold: true }
      for (const s of data.sales) {
        sheet.addRow({
          n: s.sale_number,
          dt: formatDateTime(s.sale_datetime),
          customer: s.customer_name ?? "-",
          payment: s.payment_method,
          subtotal: money(s.subtotal_cents),
          discount: money(s.discount_cents),
          total: money(s.total_cents),
          status: STATUS_LABELS[s.status] ?? s.status,
        })
      }
      break
    }
    case "despesas": {
      addSummaryRows(summarySheet, [["Total de despesas", money(data.totalCents), MONEY_FORMAT]])
      const catSheet = workbook.addWorksheet("Por Categoria")
      catSheet.columns = [
        { header: "Categoria", key: "cat", width: 22 },
        { header: "Total", key: "total", width: 16, style: { numFmt: MONEY_FORMAT } },
        { header: "Qtd.", key: "count", width: 10 },
      ]
      catSheet.getRow(1).font = { bold: true }
      for (const c of data.byCategory) {
        catSheet.addRow({ cat: CATEGORY_LABELS[c.category] ?? c.category, total: money(c.amount_cents), count: c.count })
      }
      const sheet = workbook.addWorksheet("Despesas")
      sheet.columns = [
        { header: "Descrição", key: "desc", width: 30 },
        { header: "Categoria", key: "cat", width: 18 },
        { header: "Valor", key: "amount", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Data", key: "date", width: 14 },
        { header: "Pagamento", key: "payment", width: 14 },
      ]
      sheet.getRow(1).font = { bold: true }
      for (const e of data.expenses) {
        sheet.addRow({
          desc: e.description,
          cat: CATEGORY_LABELS[e.category] ?? e.category,
          amount: money(e.amount_cents),
          date: formatDate(e.expense_date),
          payment: e.payment_method,
        })
      }
      break
    }
    case "lucro": {
      addSummaryRows(summarySheet, [
        ["Faturamento", money(data.summary.revenueCents), MONEY_FORMAT],
        ["Custo dos produtos", money(data.summary.totalCostCents), MONEY_FORMAT],
        ["Lucro bruto", money(data.summary.grossProfitCents), MONEY_FORMAT],
        ["Despesas", money(data.summary.expensesCents), MONEY_FORMAT],
        ["Lucro líquido", money(data.summary.netProfitCents), MONEY_FORMAT],
        ["Margem de lucro", data.summary.profitMarginPct !== null ? `${data.summary.profitMarginPct}%` : "-"],
      ])
      break
    }
    case "custos": {
      addSummaryRows(summarySheet, [["Custo total dos produtos vendidos", money(data.totalCostCents), MONEY_FORMAT]])
      const sheet = workbook.addWorksheet("Custo por Produto")
      sheet.columns = [
        { header: "Produto", key: "name", width: 26 },
        { header: "Qtd. vendida", key: "qty", width: 14 },
        { header: "Custo total", key: "cost", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Faturamento", key: "revenue", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Lucro", key: "profit", width: 14, style: { numFmt: MONEY_FORMAT } },
      ]
      sheet.getRow(1).font = { bold: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of data.products as any[]) {
        sheet.addRow({ name: p.name, qty: p.quantitySold, cost: money(p.costCents), revenue: money(p.revenueCents), profit: money(p.profitCents) })
      }
      break
    }
    case "pix": {
      addSummaryRows(
        summarySheet,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data.byStatus as any[]).map((s) => [STATUS_LABELS[s.status] ?? s.status, money(s.amount_cents), MONEY_FORMAT])
      )
      const sheet = workbook.addWorksheet("Comprovantes")
      sheet.columns = [
        { header: "Data/Hora", key: "dt", width: 20 },
        { header: "Valor", key: "amount", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Status", key: "status", width: 14 },
        { header: "Venda", key: "sale", width: 10 },
      ]
      sheet.getRow(1).font = { bold: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of data.receipts as any[]) {
        sheet.addRow({
          dt: formatDateTime(r.receipt_datetime),
          amount: money(r.amount_cents),
          status: STATUS_LABELS[r.status] ?? r.status,
          sale: r.sale_number ?? "-",
        })
      }
      break
    }
    case "trocos": {
      addSummaryRows(summarySheet, [["Total de troco entregue", money(data.totalChangeCents), MONEY_FORMAT]])
      const sheet = workbook.addWorksheet("Trocos")
      sheet.columns = [
        { header: "Nº Venda", key: "n", width: 10 },
        { header: "Data/Hora", key: "dt", width: 20 },
        { header: "Cliente", key: "customer", width: 22 },
        { header: "Total da venda", key: "total", width: 16, style: { numFmt: MONEY_FORMAT } },
        { header: "Recebido", key: "received", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Troco", key: "change", width: 14, style: { numFmt: MONEY_FORMAT } },
      ]
      sheet.getRow(1).font = { bold: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of data.sales as any[]) {
        sheet.addRow({
          n: s.sale_number,
          dt: formatDateTime(s.sale_datetime),
          customer: s.customer_name ?? "-",
          total: money(s.total_cents),
          received: money(s.amount_received_cents),
          change: money(s.change_cents),
        })
      }
      break
    }
    case "completo": {
      addSummaryRows(summarySheet, [
        ["Faturamento", money(data.summary.revenueCents), MONEY_FORMAT],
        ["Custo dos produtos", money(data.summary.totalCostCents), MONEY_FORMAT],
        ["Lucro bruto", money(data.summary.grossProfitCents), MONEY_FORMAT],
        ["Despesas", money(data.summary.expensesCents), MONEY_FORMAT],
        ["Lucro líquido", money(data.summary.netProfitCents), MONEY_FORMAT],
        ["Total de vendas", data.summary.salesCount],
        ["Ticket médio", data.summary.averageTicketCents !== null ? money(data.summary.averageTicketCents) : "-", MONEY_FORMAT],
        ["Recebido em PIX", money(data.summary.pixRevenueCents), MONEY_FORMAT],
        ["Recebido em dinheiro", money(data.summary.cashRevenueCents), MONEY_FORMAT],
        ["Troco entregue", money(data.summary.changeGivenCents), MONEY_FORMAT],
      ])
      const topSheet = workbook.addWorksheet("Produtos em Destaque")
      topSheet.columns = [
        { header: "Produto", key: "name", width: 26 },
        { header: "Qtd. vendida", key: "qty", width: 14 },
        { header: "Faturamento", key: "revenue", width: 14, style: { numFmt: MONEY_FORMAT } },
        { header: "Lucro", key: "profit", width: 14, style: { numFmt: MONEY_FORMAT } },
      ]
      topSheet.getRow(1).font = { bold: true }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const p of data.topProducts as any[]) {
        topSheet.addRow({ name: p.name, qty: p.quantitySold, revenue: money(p.revenueCents), profit: money(p.profitCents) })
      }
      break
    }
  }

  return workbook.xlsx.writeBuffer()
}

function addSummaryRows(
  sheet: ExcelJS.Worksheet,
  rows: Array<[string, string | number] | [string, string | number, string]>
) {
  for (const [label, value, format] of rows) {
    const row = sheet.addRow([label, value])
    if (format) row.getCell(2).numFmt = format
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasAnyData(type: ReportType, data: any): boolean {
  switch (type) {
    case "vendas":
      return data.sales.length > 0
    case "despesas":
      return data.expenses.length > 0
    case "lucro":
      return data.summary.hasData
    case "custos":
      return data.products.length > 0
    case "pix":
      return data.receipts.length > 0
    case "trocos":
      return data.sales.length > 0
    case "completo":
      return data.summary.hasData
  }
}

export { hasAnyData }
