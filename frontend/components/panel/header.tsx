"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { usePathname } from "next/navigation"
import { Menu, Moon, Sun, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { MobileNav } from "@/components/panel/mobile-nav"
import { NAV_ITEMS } from "@/lib/nav-config"

export function Header() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const title = NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Painel"

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menu"
            className="flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="text-sm font-semibold md:text-base">{title}</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Alternar tema"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          {user && (
            <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
          )}
          <Button variant="ghost" size="icon" aria-label="Sair" onClick={logout}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </>
  )
}
