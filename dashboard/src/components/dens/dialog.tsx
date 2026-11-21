import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogClose = DialogPrimitive.Close
const DialogPortal = DialogPrimitive.Portal

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[rgb(6_32_54/0.42)] backdrop-blur-[2px] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  // Nuara: Radix hanya mengembalikan fokus ke <DialogTrigger>. Jendela yang
  // dibuka dari state (tombol biasa, pintasan "N") kehilangan fokus ke body saat
  // ditutup. Elemen yang fokus saat jendela dibuka dicatat oleh CaptureFocus.
  const returnTo = React.useRef<HTMLElement | null>(null)
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e)
          if (e.defaultPrevented) return
          const target = returnTo.current
          if (!target?.isConnected || target === document.body) return
          e.preventDefault()
          target.focus()
        }}
        data-slot="dialog-content"
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 rounded-3xl bg-card p-6 text-card-foreground shadow-raised ring-1 ring-border/60 outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
          className
        )}
        {...props}
      >
        <CaptureFocus intoRef={returnTo} />
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute right-3 top-3 grid size-8 pointer-coarse:size-11 place-content-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
          >
            <XIcon />
            <span className="sr-only">Tutup</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/*
 * Anak Content dipasang setiap kali jendela dibuka (Content sendiri tidak),
 * dan layout effect-nya berjalan sebelum Radix memindahkan fokus ke dalam
 * jendela (effect biasa), jadi yang tercatat adalah pemicunya.
 */
function CaptureFocus({ intoRef }: { intoRef: React.RefObject<HTMLElement | null> }) {
  React.useLayoutEffect(() => {
    intoRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }, [intoRef])
  return null
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold leading-tight tracking-[-0.015em]", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
