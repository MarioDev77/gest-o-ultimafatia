"use client"

import { useCallback, useEffect, useState } from "react"
import { apiFetch, ApiClientError } from "@/lib/api-client"

export function useApiQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const refetch = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    if (!path) return
    let cancelled = false
    // Limpa o dado anterior ao trocar de path (ex: selecionar outro produto),
    // pra não exibir o resultado de uma consulta diferente enquanto a nova carrega.
    setData(null)
    setIsLoading(true)
    setError(null)

    apiFetch<T>(path)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiClientError && err.status === 401) return // já redireciona pro login
        setError(err instanceof Error ? err.message : "Erro ao carregar dados")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [path, reloadToken])

  return { data, isLoading, error, refetch }
}
