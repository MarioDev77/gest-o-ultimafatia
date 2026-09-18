"use client"

import { useState } from "react"
import { Activity, ArrowUpRight, Bell, FileText, LayoutDashboard, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const stats = [
  { label: "Conteúdos publicados", value: "248", change: "+12,5%", icon: FileText },
  { label: "Usuários ativos", value: "1.842", change: "+8,2%", icon: Users },
  { label: "Sessões seguras", value: "99,8%", change: "+1,4%", icon: ShieldCheck },
]

const activity = [
  ["Novo conteúdo publicado", "há 8 minutos", "Ana Martins"],
  ["Permissão de administrador atualizada", "há 42 minutos", "Carlos Souza"],
  ["Upload concluído com sucesso", "há 1 hora", "Marina Costa"],
  ["Novo usuário convidado", "há 2 horas", "Rafael Lima"],
]

export function AdminDashboard() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [active, setActive] = useState("Visão geral")

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#182230]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#e8ebf1] bg-white px-5 py-6 transition-transform lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-xl bg-[#15283b] text-sm font-bold text-white">N</div><span className="text-lg font-semibold tracking-tight">Núcleo</span></div>
          <button className="lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
        </div>
        <nav className="mt-12 flex flex-col gap-1" aria-label="Navegação principal">
          {[{ label: "Visão geral", icon: LayoutDashboard }, { label: "Conteúdos", icon: FileText }, { label: "Usuários", icon: Users }, { label: "Atividade", icon: Activity }].map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActive(label); setMenuOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${active === label ? "bg-[#eaf2f8] text-[#176b9d]" : "text-[#6b7480] hover:bg-[#f6f8fa]"}`}><Icon className="size-[18px]" />{label}</button>)}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-[#edf0f3] pt-5"><button className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#6b7480] hover:bg-[#f6f8fa]"><Settings className="size-[18px]" />Configurações</button><button className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#6b7480] hover:bg-[#f6f8fa]"><LogOut className="size-[18px]" />Sair</button></div>
      </aside>
      {menuOpen && <button className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <main className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-[#e8ebf1] bg-white px-5 sm:px-8 lg:px-10"><div className="flex items-center gap-4"><button className="lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8a94a2]">Painel administrativo</p><h1 className="mt-1 text-xl font-semibold">Bom dia, Mariana</h1></div></div><div className="flex items-center gap-3"><button className="hidden size-10 items-center justify-center rounded-full border border-[#e8ebf1] text-[#6b7480] sm:flex" aria-label="Pesquisar"><Search className="size-[18px]" /></button><button className="relative flex size-10 items-center justify-center rounded-full border border-[#e8ebf1] text-[#6b7480]" aria-label="Notificações"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#de6a4f]" /></button><div className="hidden items-center gap-3 border-l border-[#e8ebf1] pl-4 sm:flex"><div className="flex size-9 items-center justify-center rounded-full bg-[#dce9ef] text-sm font-semibold text-[#24516a]">MC</div><div><p className="text-sm font-medium">Mariana Costa</p><p className="text-xs text-[#8a94a2]">Administradora</p></div></div></div></header>
        <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 lg:px-10"><div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-[#8a94a2]">Segunda-feira, 15 de setembro de 2026</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Visão geral</h2></div><Button className="w-fit rounded-xl bg-[#176b9d] px-5 hover:bg-[#12577f]"><FileText data-icon="inline-start" />Novo conteúdo</Button></div>
          <section className="grid gap-4 md:grid-cols-3">{stats.map(({ label, value, change, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#e8ebf1] bg-white p-5 shadow-[0_2px_12px_rgba(28,44,64,0.03)]"><div className="flex items-start justify-between"><div className="flex size-10 items-center justify-center rounded-xl bg-[#edf5f8] text-[#176b9d]"><Icon className="size-[19px]" /></div><span className="rounded-full bg-[#edf7f1] px-2.5 py-1 text-xs font-semibold text-[#34815e]">{change}</span></div><p className="mt-6 text-sm text-[#8a94a2]">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p></div>)}</section>
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]"><div className="rounded-2xl border border-[#e8ebf1] bg-white p-6 shadow-[0_2px_12px_rgba(28,44,64,0.03)]"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Atividade recente</h3><p className="mt-1 text-sm text-[#8a94a2]">Acompanhe as últimas ações no sistema</p></div><button className="flex size-9 items-center justify-center rounded-lg text-[#8a94a2] hover:bg-[#f6f8fa]" aria-label="Mais opções"><MoreHorizontal /></button></div><div className="mt-6 flex flex-col">{activity.map(([title, time, user], i) => <div key={title} className="flex items-center gap-4 border-t border-[#f0f2f5] py-4"><div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${i % 2 ? "bg-[#f8eee9] text-[#b3654b]" : "bg-[#edf5f8] text-[#176b9d]"}`}><Activity className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="mt-1 text-xs text-[#8a94a2]">{user} · {time}</p></div><ArrowUpRight className="size-4 text-[#b8c0ca]" /></div>)}</div></div><div className="rounded-2xl border border-[#e8ebf1] bg-[#15283b] p-6 text-white shadow-[0_2px_12px_rgba(28,44,64,0.08)]"><div className="flex items-center justify-between"><div><p className="text-sm text-[#a8c2d1]">Segurança do sistema</p><h3 className="mt-2 text-2xl font-semibold">Tudo protegido</h3></div><div className="flex size-11 items-center justify-center rounded-full bg-white/10"><ShieldCheck className="size-6 text-[#9fd1ba]" /></div></div><p className="mt-4 text-sm leading-6 text-[#b9cbd5]">Nenhuma ameaça ou tentativa de acesso indevido detectada nas últimas 24 horas.</p><div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4 text-sm"><span className="text-[#a8c2d1]">Última verificação</span><span>há 4 minutos</span></div></div></section>
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard
