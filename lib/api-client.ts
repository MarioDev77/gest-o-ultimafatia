const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const TOKEN_KEY = "nucleo_admin_token"
const USER_KEY = "nucleo_admin_user"

export type AuthUser = { id: string; email: string; role: "admin" | "editor" }

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  const raw = window.localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function storeSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

type ApiFetchOptions = Omit<RequestInit, "body"> & { body?: unknown }

// Sessão expira em 15 min (definido no backend). Quando um 401 chega, limpa a
// sessão local e manda pro login — evita a tela ficar "travada" mostrando
// dado velho depois do token expirar.
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const token = getStoredToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body:
      options.body instanceof FormData || options.body === undefined
        ? (options.body as BodyInit | undefined)
        : JSON.stringify(options.body),
  })

  if (response.status === 401) {
    clearSession()
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login?expired=1"
    }
    throw new ApiClientError("Sessão expirada", 401)
  }

  if (response.status === 204) return undefined as T

  const contentType = response.headers.get("content-type") ?? ""
  const isJson = contentType.includes("application/json")
  const payload = isJson ? await response.json() : await response.blob()

  if (!response.ok) {
    const message = isJson && payload?.error ? payload.error : "Erro inesperado ao falar com o servidor"
    throw new ApiClientError(message, response.status)
  }

  return payload as T
}

export function apiFileUrl(path: string) {
  return `${API_URL}${path}`
}

// Relatórios exigem o header Authorization, então não dá pra usar um <a href>
// puro — busca o arquivo autenticado e dispara o download no navegador.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const blob = await apiFetch<Blob>(path)
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export { API_URL }
