import * as React from "react"

import { cn } from "@/lib/utils"

const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-card text-sm text-foreground shadow-[inset_0_1px_2px_rgb(6_32_54/0.04)] transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/15"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "h-10 pointer-coarse:h-11 px-3.5 py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

/**
 * Input with a leading icon and/or trailing element (e.g. a Kbd hint).
 * <InputGroup start={<Search />} end={<Kbd>⌘K</Kbd>}><Input … /></InputGroup>
 */
function InputGroup({
  className,
  start,
  end,
  children,
  ...props
}: React.ComponentProps<"div"> & { start?: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "relative flex items-center [&>input]:flex-1",
        start && "[&>input]:pl-10",
        end && "[&>input]:pr-14",
        className
      )}
      {...props}
    >
      {start && (
        <span className="pointer-events-none absolute left-3.5 flex text-muted-foreground [&>svg]:size-4">
          {start}
        </span>
      )}
      {children}
      {end && <span className="absolute right-2 flex items-center">{end}</span>}
    </div>
  )
}

export { Input, InputGroup, fieldBase }
