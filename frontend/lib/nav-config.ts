import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  QrCode,
  Receipt,
  ChefHat,
  FileBarChart,
  Wallet,
  CalendarDays,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  // Rotas que ainda serão construídas em fases seguintes ficam visíveis
  // (mostram a estrutura completa do painel) mas desabilitadas, em vez de
  // virar link morto (404).
  available: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, available: true },
  { label: "Vendas", href: "/vendas", icon: ShoppingCart, available: true },
  { label: "Semanas", href: "/semanas", icon: CalendarDays, available: true },
  { label: "Produtos", href: "/produtos", icon: Package, available: true },
  { label: "Comprovantes PIX", href: "/comprovantes-pix", icon: QrCode, available: true },
  { label: "Despesas", href: "/despesas", icon: Receipt, available: true },
  { label: "Custo de Fabricação", href: "/custo-fabricacao", icon: ChefHat, available: true },
  { label: "Relatórios", href: "/relatorios", icon: FileBarChart, available: true },
  { label: "Fluxo de Caixa", href: "/caixa", icon: Wallet, available: true },
]
