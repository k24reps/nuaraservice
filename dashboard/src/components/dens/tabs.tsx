import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Two looks:
 *  - "pill": a segmented control (Today / 7 days / 30 days)
 *  - "line": underlined tabs with optional counts (Active 18 / Paused 4)
 */
const TabsVariantContext = React.createContext<"pill" | "line">("pill")

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col gap-4", className)} {...props} />
}

const tabsListVariants = cva("inline-flex w-fit items-center", {
  variants: {
    variant: {
      pill: "h-10 pointer-coarse:h-11 gap-0.5 rounded-full bg-muted p-1 ring-1 ring-inset ring-border/60",
      line: "h-10 pointer-coarse:h-11 gap-5 border-b border-border",
    },
  },
  defaultVariants: { variant: "pill" },
})

function TabsList({
  className,
  variant = "pill",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsVariantContext.Provider value={variant ?? "pill"}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-semibold transition-[color,background-color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variant === "pill" &&
          "h-full rounded-full px-3.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgb(6_32_54/0.08),0_2px_8px_-2px_rgb(6_32_54/0.1)]",
        variant === "line" &&
          "relative -mb-px h-full border-b-2 border-transparent px-0.5 text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("text-xs font-medium tabular-nums text-muted-foreground", className)} {...props} />
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsCount, TabsContent, tabsListVariants }
