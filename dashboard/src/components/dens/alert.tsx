import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-1 rounded-xl px-4 py-3.5 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4.5)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-[18px] [&>svg]:translate-y-px",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground ring-1 ring-border [&>svg]:text-primary",
        soft: "bg-soft text-soft-foreground",
        highlight:
          "bg-highlight/12 text-foreground ring-1 ring-highlight/35 [&>svg]:text-highlight dark:bg-highlight/10",
        warning: "bg-warning text-warning-foreground",
        destructive:
          "bg-destructive/8 text-destructive ring-1 ring-destructive/25 dark:bg-destructive/12 [&>[data-slot=alert-description]]:text-destructive/90",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-semibold leading-snug", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 grid justify-items-start gap-1 leading-relaxed opacity-90", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
