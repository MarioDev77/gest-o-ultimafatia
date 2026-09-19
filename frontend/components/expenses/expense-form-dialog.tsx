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
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PhotoUploadField } from "@/components/shared/photo-upload-field"
import { apiFetch, ApiClientError } from "@/lib/api-client"
import { useToast } from "@/components/ui/toast"
import { EXPENSE_CATEGORY_OPTIONS, type Expense, type ExpenseCategory, type PaymentMethod } from "@/lib/types"

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",")
}

function inputToCents(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".")
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : Math.round(parsed * 100)
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

type FormState = {
  description: string
  category: ExpenseCategory
  amount: string
  expenseDate: string
  paymentMethod: PaymentMethod
  note: string
  receiptKey: string | null
  receiptPreview: string | null
}

function emptyForm(): FormState {
  return {
    description: "",
    category: "materia_prima",
    amount: "",
    expenseDate: todayStr(),
    paymentMethod: "dinheiro",
    note: "",
    receiptKey: null,
    receiptPreview: null,
  }
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: Expense | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormState>(emptyForm())
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open) {
      setForm(
        expense
          ? {
              description: expense.description,
              category: expense.category,
              amount: centsToInput(expense.amount_cents),
              expenseDate: expense.expense_date.slice(0, 10),
              paymentMethod: expense.payment_method,
              note: expense.note ?? "",
              receiptKey: expense.receipt_key,
              receiptPreview: expense.receipt_url,
            }
          : emptyForm()
      )
      setError(null)
    }
  }, [open, expense])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.description.trim()) {
      setError("Informe a descrição")
      return
    }
    const amountCents = inputToCents(form.amount)
    if (amountCents <= 0) {
      setError("Informe um valor válido")
      return
    }

    setIsSubmitting(true)
    setError(null)
    const body = {
      description: form.description.trim(),
      category: form.category,
      amountCents,
      expenseDate: form.expenseDate,
      paymentMethod: form.paymentMethod,
      note: form.note.trim() || undefined,
      receiptKey: form.receiptKey ?? undefined,
    }

    try {
      if (expense) {
        await apiFetch(`/api/expenses/${expense.id}`, { method: "PATCH", body })
        toast.add({ title: "Despesa atualizada", type: "success" })
      } else {
        await apiFetch("/api/expenses", { method: "POST", body })
        toast.add({ title: "Despesa registrada", type: "success" })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Não foi possível salvar a despesa"
      setError(message)
      toast.add({ title: "Erro ao salvar", description: message, type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>Registre gastos com matéria-prima, embalagens e outros custos.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <PhotoUploadField
              previewUrl={form.receiptPreview}
              onUploaded={(key, preview) => setForm((f) => ({ ...f, receiptKey: key, receiptPreview: preview }))}
              onCleared={() => setForm((f) => ({ ...f, receiptKey: null, receiptPreview: null }))}
            />
            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ex: Compra de morangos"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="category">Categoria</Label>
                <Select
                  id="category"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))}
                >
                  {EXPENSE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input id="amount" inputMode="decimal" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0,00" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expenseDate">Data</Label>
              <Input id="expenseDate" type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentMethod">Pagamento</Label>
              <Select id="paymentMethod" value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))}>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="cartao">Cartão</option>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">Observação</Label>
            <Textarea id="note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
