import * as React from "react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dens/dialog"

/*
 * Jendela form (Nuara, bukan bagian dens-ui), pengganti `Modal` FixMaster
 * untuk form: judul, isi yang bisa digulir, dan baris tombol yang selalu
 * terlihat. Di layar <=640px ia menjadi lembar dari bawah, seperti Modal lama.
 *
 * Fokus awal: elemen bertanda `data-autofocus`, bukan atribut `autoFocus`.
 * autoFocus React memindahkan fokus ke kolom SEBELUM dialog mencatat pemicunya,
 * sehingga saat ditutup fokus kembali ke kolom yang sudah hilang (body), bukan
 * ke tombol yang membukanya.
 */
const SIZE = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" } as const

function FormDialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  size?: keyof typeof SIZE
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        // Tanpa penjelasan: aria-describedby kosong menyatakan itu disengaja (Radix memperingatkan bila tidak).
        {...(description ? {} : { "aria-describedby": undefined })}
        onOpenAutoFocus={(e) => {
          const target = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[data-autofocus]")
          if (!target) return
          e.preventDefault()
          target.focus()
        }}
        className={cn(
          "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0",
          "compact:top-auto compact:bottom-2 compact:max-h-[calc(100dvh-1rem)] compact:w-[calc(100%-1rem)] compact:max-w-none compact:translate-y-0 compact:rounded-b-xl",
          SIZE[size],
          className
        )}
      >
        <DialogHeader className="px-6 pb-4 pt-6 compact:px-4 compact:pt-4">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div data-slot="form-dialog-body" className="min-h-0 overflow-y-auto px-6 pb-5 pt-1 compact:px-4">
          {children}
        </div>
        {footer && (
          <DialogFooter className="border-t border-border/70 px-6 py-4 compact:flex-row compact:flex-wrap compact:px-4 compact:py-3 compact:[&>button]:flex-1">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export { FormDialog }
