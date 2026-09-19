"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import type { SaleWeek } from "@/lib/types"

// Cria uma semana nova (week = null) ou renomeia uma existente.
export function WeekFormDialog({
  open,
  week,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  week: SaleWeek | null
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setName(week?.name ?? "")
      setError(null)
    }
  }, [open, week])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Informe o nome da semana")
      return
    }

    setIsSubmitting(true)
    try {
      if (week) {
        await apiFetch(`/api/weeks/${week.id}`, { method: "PATCH", body: { name: trimmed } })
        toast.add({ title: "Semana renomeada", type: "success" })
      } else {
        await apiFetch("/api/weeks", { method: "POST", body: { name: trimmed } })
        toast.add({ title: "Semana criada", type: "success" })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível salvar a semana"
      setError(message)
      toast.add({ title: "Erro ao salvar semana", description: message, type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{week ? "Renomear semana" : "Criar nova semana"}</DialogTitle>
          <DialogDescription>
            Digite o nome que quiser, por exemplo: primeira semana, segunda semana, terceira semana.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weekName">Nome da semana</Label>
            <Input
              id="weekName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Primeira semana"
              maxLength={80}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : week ? "Salvar" : "Criar semana"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
