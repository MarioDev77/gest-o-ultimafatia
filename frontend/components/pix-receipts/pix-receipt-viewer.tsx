"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"

export function PixReceiptViewer({ url, onOpenChange }: { url: string | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={!!url} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-black p-2">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Comprovante ampliado" className="max-h-[80vh] w-full rounded-lg object-contain" />
        )}
      </DialogContent>
    </Dialog>
  )
}
