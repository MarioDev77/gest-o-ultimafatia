"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, clearSession, getStoredToken, getStoredUser, storeSession, type AuthUser } from "@/lib/api-client"

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const token = getStoredToken()
    const storedUser = getStoredUser()
    if (!token || !storedUser) {
      setIsLoading(false)
      return
    }
    // Revalida o token salvo contra o backend antes de confiar nele —
    // se expirou (sessão de 15 min) ou o usuário foi removido, limpa e
    // manda pro login em vez de deixar a tela "logada" com dado inválido.
    apiFetch<{ user: AuthUser }>("/api/auth/me")
      .then(({ user }) => setUser(user))
      .catch(() => clearSession())
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await apiFetch<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: { email, password },
      })
      storeSession(result.token, result.user)
      setUser(result.user)
      router.push("/dashboard")
    },
    [router]
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    router.push("/login")
  }, [router])

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>")
  return ctx
}
