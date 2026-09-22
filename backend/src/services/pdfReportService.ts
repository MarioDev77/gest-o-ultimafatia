import PDFDocument from "pdfkit"
import { REPORT_TITLES, type ReportType } from "./reportService"

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
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
export function buildPdfReport(type: ReportType, data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 44, size: "A4" })
    const chunks: Buffer[] = []
    doc.on("data", (chunk) => chunks.push(chunk))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    doc.fontSize(18).font("Helvetica-Bold").text(REPORT_TITLES[type])
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#555")
      .text(
        data.weekName
          ? `Semana: ${data.weekName} (${data.period.from} a ${data.period.to})`
          : `Período: ${data.period.from} a ${data.period.to}`
      )
    doc.moveDown(1)
    doc.fillColor("#000")

    if (!hasData(type, data)) {
      doc.fontSize(12).text("Sem dados no período selecionado.")
      doc.end()
      return
    }

    switch (type) {
      case "vendas":
        summaryLine(doc, "Total de vendas", String(data.summary.salesCount))
        summaryLine(doc, "Faturamento", brl(data.summary.revenueCents))
        summaryLine(doc, "Ticket médio", data.summary.averageTicketCents !== null ? brl(data.summary.averageTicketCents) : "-")
        doc.moveDown(1)
        table(
          doc,
          ["Nº", "Data/Hora", "Cliente", "Pagamento", "Total", "Status"],
          [50, 130, 130, 70, 70, 70],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.sales as any[]).map((s) => [
            String(s.sale_number),
            formatDateTime(s.sale_datetime),
            s.customer_name ?? "-",
            s.payment_method,
            brl(s.total_cents),
            STATUS_LABELS[s.status] ?? s.status,
          ])
        )
        break

      case "despesas":
        summaryLine(doc, "Total de despesas", brl(data.totalCents))
        doc.moveDown(1)
        doc.fontSize(12).font("Helvetica-Bold").text("Por categoria")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const c of data.byCategory as any[]) {
          summaryLine(doc, CATEGORY_LABELS[c.category] ?? c.category, brl(c.amount_cents))
        }
        doc.moveDown(1)
        table(
          doc,
          ["Descrição", "Categoria", "Valor", "Data", "Pagamento"],
          [140, 100, 80, 80, 80],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.expenses as any[]).map((e) => [
            e.description,
            CATEGORY_LABELS[e.category] ?? e.category,
            brl(e.amount_cents),
            formatDate(e.expense_date),
            e.payment_method,
          ])
        )
        break

      case "lucro":
        summaryLine(doc, "Faturamento", brl(data.summary.revenueCents))
        summaryLine(doc, "Custo dos produtos", brl(data.summary.totalCostCents))
        summaryLine(doc, "Lucro bruto", brl(data.summary.grossProfitCents))
        summaryLine(doc, "Despesas", brl(data.summary.expensesCents))
        summaryLine(doc, "Lucro líquido", brl(data.summary.netProfitCents))
        summaryLine(doc, "Margem de lucro", data.summary.profitMarginPct !== null ? `${data.summary.profitMarginPct}%` : "-")
        break

      case "custos":
        summaryLine(doc, "Custo total dos produtos vendidos", brl(data.totalCostCents))
        doc.moveDown(1)
        table(
          doc,
          ["Produto", "Qtd.", "Custo", "Faturamento", "Lucro"],
          [150, 60, 90, 90, 90],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.products as any[]).map((p) => [p.name, String(p.quantitySold), brl(p.costCents), brl(p.revenueCents), brl(p.profitCents)])
        )
        break

      case "pix":
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const s of data.byStatus as any[]) {
          summaryLine(doc, STATUS_LABELS[s.status] ?? s.status, `${brl(s.amount_cents)} (${s.count})`)
        }
        doc.moveDown(1)
        table(
          doc,
          ["Data/Hora", "Valor", "Status", "Venda"],
          [150, 100, 100, 100],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.receipts as any[]).map((r) => [
            formatDateTime(r.receipt_datetime),
            brl(r.amount_cents),
            STATUS_LABELS[r.status] ?? r.status,
            r.sale_number ? `#${r.sale_number}` : "-",
          ])
        )
        break

      case "trocos":
        summaryLine(doc, "Total de troco entregue", brl(data.totalChangeCents))
        doc.moveDown(1)
        table(
          doc,
          ["Nº", "Data/Hora", "Cliente", "Total", "Recebido", "Troco"],
          [40, 120, 120, 70, 70, 70],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.sales as any[]).map((s) => [
            String(s.sale_number),
            formatDateTime(s.sale_datetime),
            s.customer_name ?? "-",
            brl(s.total_cents),
            brl(s.amount_received_cents),
            brl(s.change_cents),
          ])
        )
        break

      case "completo":
        summaryLine(doc, "Faturamento", brl(data.summary.revenueCents))
        summaryLine(doc, "Custo dos produtos", brl(data.summary.totalCostCents))
        summaryLine(doc, "Lucro bruto", brl(data.summary.grossProfitCents))
        summaryLine(doc, "Despesas", brl(data.summary.expensesCents))
        summaryLine(doc, "Lucro líquido", brl(data.summary.netProfitCents))
        summaryLine(doc, "Total de vendas", String(data.summary.salesCount))
        summaryLine(doc, "Ticket médio", data.summary.averageTicketCents !== null ? brl(data.summary.averageTicketCents) : "-")
        summaryLine(doc, "Recebido em PIX", brl(data.summary.pixRevenueCents))
        summaryLine(doc, "Recebido em dinheiro", brl(data.summary.cashRevenueCents))
        summaryLine(doc, "Troco entregue", brl(data.summary.changeGivenCents))
        doc.moveDown(1)
        doc.fontSize(12).font("Helvetica-Bold").text("Produtos em destaque")
        table(
          doc,
          ["Produto", "Qtd.", "Faturamento", "Lucro"],
          [160, 60, 100, 100],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data.topProducts as any[]).map((p) => [p.name, String(p.quantitySold), brl(p.revenueCents), brl(p.profitCents)])
        )
        break
    }

    doc.end()
  })
}

function summaryLine(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(11).font("Helvetica-Bold").text(`${label}: `, { continued: true }).font("Helvetica").text(value)
}

function table(doc: PDFKit.PDFDocument, headers: string[], widths: number[], rows: string[][]) {
  const startX = doc.x
  let y = doc.y
  doc.fontSize(9).font("Helvetica-Bold")
  headers.forEach((h, i) => {
    const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0)
    doc.text(h, x, y, { width: widths[i] })
  })
  y += 16
  doc.moveTo(startX, y - 2).lineTo(startX + widths.reduce((a, b) => a + b, 0), y - 2).strokeColor("#ccc").stroke()

  doc.font("Helvetica")
  for (const row of rows) {
    if (y > doc.page.height - 60) {
      doc.addPage()
      y = doc.y
    }
    row.forEach((cell, i) => {
      const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0)
      doc.text(cell, x, y, { width: widths[i] })
    })
    y += 16
  }
  doc.y = y + 4
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasData(type: ReportType, data: any): boolean {
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
