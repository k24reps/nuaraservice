import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5 tabular-nums [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        highlight: "bg-highlight text-highlight-foreground",
        soft: "bg-soft text-soft-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-card text-foreground",
        success: "bg-success text-success-foreground",
        warning: "bg-warning text-warning-foreground",
        info: "bg-info text-info-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        // Nuara (DBD): badge Dibatalkan dan error memakai danger-soft, bukan merah pekat.
        "destructive-soft": "bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

/** Small status dot, use inside a Badge or next to text. */
function StatusDot({
  className,
  tone = "brand",
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "brand" | "highlight" | "destructive" | "muted"
}) {
  return (
    <span
      data-slot="status-dot"
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        tone === "brand" && "bg-brand",
        tone === "highlight" && "bg-highlight",
        tone === "destructive" && "bg-destructive",
        tone === "muted" && "bg-muted-foreground/60",
        className
      )}
      {...props}
    />
  )
}

export { Badge, StatusDot, badgeVariants }
