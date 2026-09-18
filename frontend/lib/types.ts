export type SaleStatus = "concluida" | "cancelada"
export type PaymentMethod = "dinheiro" | "pix" | "cartao"

export type Sale = {
  id: string
  sale_number: string
  sale_datetime: string
  customer_name: string | null
  payment_method: PaymentMethod
  amount_received_cents: number | null
  change_cents: number
  discount_cents: number
  subtotal_cents: number
  total_cents: number
  total_cost_cents: number
  status: SaleStatus
  notes: string | null
}

export type SaleItemRow = {
  id: string
  product_id: string
  product_name_snapshot: string
  quantity: number
  unit_price_cents: number
  unit_cost_cents: number
  line_total_cents: number
}

export type SaleDetail = Sale & { items: SaleItemRow[]; created_at: string; updated_at: string }

export type Product = {
  id: string
  name: string
  description: string | null
  category: string | null
  photo_key: string | null
  photo_url: string | null
  unit: string
  sale_price_cents: number | null
  manufacturing_cost_cents: number | null
  stock_quantity: number
  status: "ativo" | "inativo"
  created_at: string
  updated_at: string
  quantity_sold: number
  revenue_cents: number
  unit_profit_cents: number | null
  profit_margin_pct: number | null
}

export type PixReceiptStatus = "pendente" | "conferido" | "divergente"

export type PixReceipt = {
  id: string
  sale_id: string | null
  sale_number: string | null
  image_key: string
  amount_cents: number
  receipt_datetime: string
  status: PixReceiptStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  viewUrl: string
}

export type ExpenseCategory =
  | "materia_prima"
  | "embalagens"
  | "transporte"
  | "marketing"
  | "equipamentos"
  | "taxas"
  | "outros"

export type Expense = {
  id: string
  description: string
  category: ExpenseCategory
  amount_cents: number
  expense_date: string
  payment_method: PaymentMethod
  note: string | null
  receipt_key: string | null
  created_at: string
  updated_at: string
}

export type Ingredient = {
  id: string
  name: string
  unit: string
  purchased_quantity: string
  purchase_price_cents: number
  unit_cost_cents: string
  created_at: string
  updated_at: string
}

export type ProductIngredientRow = {
  id: string
  ingredient_id: string
  name: string
  unit: string
  unit_cost_cents: string
  quantity_used: string
  line_cost_cents: string
}

export const EXPENSE_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "materia_prima", label: "Matéria-prima" },
  { value: "embalagens", label: "Embalagens" },
  { value: "transporte", label: "Transporte" },
  { value: "marketing", label: "Marketing" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "taxas", label: "Taxas" },
  { value: "outros", label: "Outros" },
]

export const PIX_STATUS_LABELS: Record<PixReceiptStatus, string> = {
  pendente: "Pendente",
  conferido: "Conferido",
  divergente: "Divergente",
}

export type CashFlow = {
  from: string
  to: string
  openingBalanceCents: number
  inflows: { cashSalesCents: number; pixCents: number; cardCents: number; totalCents: number }
  outflows: { expensesCents: number; changeGivenCents: number; totalCents: number }
  closingBalanceCents: number
  hasData: boolean
}

export type ReportType = "vendas" | "despesas" | "lucro" | "custos" | "pix" | "trocos" | "completo"

export const REPORT_TYPE_OPTIONS: { value: ReportType; label: string; description: string }[] = [
  { value: "vendas", label: "Vendas", description: "Lista de vendas do período com totais" },
  { value: "despesas", label: "Despesas", description: "Despesas por categoria e lista completa" },
  { value: "lucro", label: "Lucro", description: "Faturamento, custo, lucro bruto e líquido" },
  { value: "custos", label: "Custos", description: "Custo de fabricação por produto" },
  { value: "pix", label: "Comprovantes PIX", description: "Comprovantes por status" },
  { value: "trocos", label: "Trocos", description: "Troco entregue em vendas no dinheiro" },
  { value: "completo", label: "Financeiro Completo", description: "Visão geral de tudo" },
]

export type QuickStats = {
  revenueTodayCents: number
  revenueWeekCents: number
  revenueMonthCents: number
}

export type FinancialSummary = {
  salesCount: number
  revenueCents: number
  totalCostCents: number
  grossProfitCents: number
  expensesCents: number
  netProfitCents: number
  profitMarginPct: number | null
  averageTicketCents: number | null
  averageCostPerSaleCents: number | null
  cashRevenueCents: number
  pixRevenueCents: number
  cardRevenueCents: number
  cashReceivedGrossCents: number
  changeGivenCents: number
  hasData: boolean
}

export type ProductBreakdownRow = {
  productId: string
  name: string
  status: "ativo" | "inativo"
  quantitySold: number
  revenueCents: number
  profitCents: number
}

export type ProductsSummary = {
  items: ProductBreakdownRow[]
  bestSellerByQuantity: string | null
  topRevenueProduct: string | null
  topProfitProduct: string | null
  hasData: boolean
}

export type DailyPoint = {
  date: string
  revenueCents: number
  costCents: number
  expensesCents: number
  grossProfitCents: number
  netProfitCents: number
}

export type ExpenseCategoryRow = { category: string; amount_cents: number; count: number }
export type PaymentMethodRow = { payment_method: string; revenue_cents: number; count: number }

export type ChartsData = {
  daily: DailyPoint[]
  expensesByCategory: ExpenseCategoryRow[]
  paymentMethods: PaymentMethodRow[]
  topProducts: ProductBreakdownRow[]
  hasData: boolean
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  materia_prima: "Matéria-prima",
  embalagens: "Embalagens",
  transporte: "Transporte",
  marketing: "Marketing",
  equipamentos: "Equipamentos",
  taxas: "Taxas",
  outros: "Outros",
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao: "Cartão",
}
