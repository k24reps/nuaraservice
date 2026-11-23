import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { CaptureFocus } from "./dialog"

/* Panel samping untuk layar lebar (detail cepat, filter). Di ponsel, laci
   dari bawah memakai Drawer. Dibangun di atas Dialog Radix: fokus terkunci
   dan kembali ke pemicunya saat ditutup (DBD bagian 5). */

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close

function SheetContent({
  className,
  children,
  showCloseButton = true,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { showCloseButton?: boolean }) {
  // Nuara: sama dengan DialogContent. Panel yang dibuka dari state (kartu
  // pelanggan) mengembalikan fokus ke elemen yang fokus saat panel dibuka.
  const returnTo = React.useRef<HTMLElement | null>(null)
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-[rgb(6_32_54/0.42)] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out"
      />
      <SheetPrimitive.Content
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e)
          if (e.defaultPrevented) return
          const target = returnTo.current
          if (!target?.isConnected || target === document.body) return
          e.preventDefault()
          target.focus()
        }}
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full w-[calc(100%-3rem)] max-w-md flex-col gap-5 overflow-y-auto rounded-l-3xl bg-card p-6 text-card-foreground shadow-raised ring-1 ring-border/60 outline-none data-[state=open]:animate-slide-in-right data-[state=closed]:animate-slide-out-right",
          className
        )}
        {...props}
      >
        <CaptureFocus intoRef={returnTo} />
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className="absolute right-3 top-3 grid size-8 pointer-coarse:size-11 place-content-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
          >
            <XIcon />
            <span className="sr-only">Tutup</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold leading-tight tracking-[-0.015em]", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
