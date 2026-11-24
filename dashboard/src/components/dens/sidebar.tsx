import * as React from "react"
import { Collapsible as CollapsiblePrimitive, Slot } from "radix-ui"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A presentational navigation panel in the Dens-UI look.
 * Set `collapsed` to render an icon rail; labels move into `title` tooltips.
 */
const SidebarContext = React.createContext<{ collapsed: boolean }>({ collapsed: false })

function Sidebar({
  className,
  collapsed = false,
  ...props
}: React.ComponentProps<"nav"> & { collapsed?: boolean }) {
  return (
    <SidebarContext.Provider value={{ collapsed }}>
      <nav
        data-slot="sidebar"
        data-collapsed={collapsed}
        className={cn(
          "group/sidebar flex h-full flex-col gap-5 rounded-3xl bg-sidebar p-2.5 text-sidebar-foreground ring-1 ring-sidebar-border",
          collapsed ? "w-[60px] items-center" : "w-64",
          className
        )}
        {...props}
      />
    </SidebarContext.Provider>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex items-center gap-3 px-1.5 pt-1", className)} {...props} />
}

function SidebarSection({
  className,
  label,
  children,
  ...props
}: React.ComponentProps<"div"> & { label?: React.ReactNode }) {
  const { collapsed } = React.useContext(SidebarContext)
  return (
    <div data-slot="sidebar-section" className={cn("flex w-full flex-col gap-0.5", className)} {...props}>
      {label && !collapsed && (
        <div className="px-3 pb-1.5 font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
      )}
      {label && collapsed && <div className="mx-auto mb-1.5 h-px w-6 bg-sidebar-border" />}
      {children}
    </div>
  )
}

function SidebarItem({
  className,
  icon,
  badge,
  active = false,
  asChild = false,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"button"> & {
  icon?: React.ReactNode
  badge?: React.ReactNode
  active?: boolean
  asChild?: boolean
  /** "sm" for items nested in a SidebarFolder */
  size?: "default" | "sm"
}) {
  const { collapsed } = React.useContext(SidebarContext)
  const Comp = asChild ? Slot.Root : "button"
  const label = typeof children === "string" ? children : undefined
  return (
    <Comp
      data-slot="sidebar-item"
      data-active={active}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium text-sidebar-foreground/75 transition-[background-color,color,box-shadow] outline-none hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-[0_1px_2px_rgb(6_32_54/0.06),0_4px_12px_-6px_rgb(6_32_54/0.16)] [&_svg]:size-[18px] [&_svg]:shrink-0",
        size === "sm" && "h-8 rounded-[10px] px-2.5 text-[13px]",
        collapsed && "size-10 justify-center px-0",
        className
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon}
          {!collapsed && <span className="flex-1 truncate">{children}</span>}
          {!collapsed && badge != null && <span className="ml-auto">{badge}</span>}
          {collapsed && badge != null && (
            <span aria-hidden className="absolute right-1.5 top-1.5 size-2 rounded-full bg-highlight ring-2 ring-sidebar" />
          )}
        </>
      )}
    </Comp>
  )
}

function SidebarCount({ className, tone = "muted", ...props }: React.ComponentProps<"span"> & { tone?: "muted" | "highlight" }) {
  return (
    <span
      data-slot="sidebar-count"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
        tone === "muted" && "text-muted-foreground",
        tone === "highlight" && "bg-highlight text-highlight-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("mt-auto flex w-full flex-col gap-2", className)} {...props} />
}

/**
 * A folder that opens to show nested items, with a guide line on the left.
 * Children are usually <SidebarItem size="sm">.
 */
function SidebarFolder({
  icon,
  label,
  badge,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  children,
}: {
  icon?: React.ReactNode
  label: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children?: React.ReactNode
}) {
  const { collapsed } = React.useContext(SidebarContext)
  if (collapsed) {
    return <SidebarItem icon={icon} badge={badge}>{label}</SidebarItem>
  }
  return (
    <CollapsiblePrimitive.Root
      data-slot="sidebar-folder"
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      className={cn("group/folder flex w-full flex-col", className)}
    >
      <CollapsiblePrimitive.Trigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium text-sidebar-foreground/75 transition-colors outline-none hover:bg-sidebar-accent/70 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:text-sidebar-foreground [&_svg]:size-[18px] [&_svg]:shrink-0"
        >
          {icon}
          <span className="flex-1 truncate">{label}</span>
          {badge != null && <span className="ml-auto group-data-[state=open]/folder:hidden">{badge}</span>}
          <ChevronRightIcon className="!size-3.5 text-muted-foreground transition-transform duration-200 ease-out-expo group-data-[state=open]/folder:rotate-90" />
        </button>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content className="overflow-hidden data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in">
        <div className="relative ml-[21px] flex flex-col gap-0.5 py-0.5 pl-2.5 before:absolute before:inset-y-1 before:left-0 before:w-px before:bg-sidebar-border">
          {children}
        </div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}

/**
 * The icon rail: a narrow ink column for switching between apps or areas,
 * placed beside a <Sidebar>. Use <SidebarRailItem> inside.
 */
function SidebarRail({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      data-slot="sidebar-rail"
      className={cn(
        "flex w-14 flex-col items-center gap-1.5 rounded-[22px] bg-rail p-2 text-rail-foreground shadow-raised",
        className
      )}
      {...props}
    />
  )
}

function SidebarRailItem({
  className,
  active = false,
  dot = false,
  label,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean
  /** small orange dot: something in this area needs attention */
  dot?: boolean
  /** accessible name, also shown as a native tooltip */
  label: string
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="sidebar-rail-item"
      data-active={active}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "relative grid size-10 shrink-0 place-content-center rounded-[14px] text-rail-foreground/55 transition-colors outline-none hover:bg-rail-foreground/10 hover:text-rail-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-rail-foreground/15 data-[active=true]:text-rail-foreground data-[active=true]:before:absolute data-[active=true]:before:-left-2 data-[active=true]:before:top-1/2 data-[active=true]:before:h-4 data-[active=true]:before:w-1 data-[active=true]:before:-translate-y-1/2 data-[active=true]:before:rounded-full data-[active=true]:before:bg-highlight [&_svg]:size-[18px]",
        className
      )}
      {...props}
    >
      {children}
      {dot && <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-highlight ring-2 ring-rail" />}
    </Comp>
  )
}

/**
 * A vertical tick meter for a rail or sidebar: one tick per period
 * (e.g. 24 hourly run counts), newest at the bottom. The current period
 * is drawn in the highlight colour.
 */
function SidebarMeter({
  className,
  label,
  total,
  levels,
  ...props
}: React.ComponentProps<"div"> & { label: string; total?: React.ReactNode; levels: number[] }) {
  const max = Math.max(...levels, 1)
  const last = levels.length - 1
  return (
    <div
      data-slot="sidebar-meter"
      role="img"
      aria-label={`${label}: ${levels.join(", ")}`}
      className={cn("flex w-14 flex-col items-center gap-2 rounded-[22px] bg-sidebar px-2 py-3 ring-1 ring-sidebar-border", className)}
      {...props}
    >
      <span className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {total != null && <span className="font-mono text-[13px] font-semibold tabular-nums">{total}</span>}
      <div className="flex w-full flex-col items-center gap-[3px]">
        {levels.map((v, i) => (
          <span
            key={i}
            className={cn("h-[2px] rounded-full", i === last ? "bg-highlight" : v === 0 ? "bg-sidebar-border" : "bg-foreground/70")}
            style={{ width: `${Math.max(14, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export {
  Sidebar,
  SidebarHeader,
  SidebarSection,
  SidebarItem,
  SidebarCount,
  SidebarFooter,
  SidebarFolder,
  SidebarRail,
  SidebarRailItem,
  SidebarMeter,
}
