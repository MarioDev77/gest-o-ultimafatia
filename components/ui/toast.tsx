"use client"

import { Toast } from "@base-ui/react/toast"
import { CheckCircle2, XCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

export function useToast() {
  return Toast.useToastManager()
}
export const ToastProvider = Toast.Provider

export function Toaster() {
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        "rounded-lg border bg-card px-4 py-3 shadow-lg transition-all",
        "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 data-[starting-style]:translate-y-1",
        toast.type === "error" ? "border-destructive/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-2.5">
        {toast.type === "error" ? (
          <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <div className="min-w-0 flex-1">
          <Toast.Title className="text-sm font-medium text-foreground" />
          <Toast.Description className="text-xs text-muted-foreground" />
        </div>
        <Toast.Close className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Fechar">
          <X className="size-3.5" />
        </Toast.Close>
      </div>
    </Toast.Root>
  ))
}
