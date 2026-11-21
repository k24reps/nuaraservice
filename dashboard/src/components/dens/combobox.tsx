import * as React from "react"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/dens/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/dens/popover"

export interface ComboboxOption {
  value: string
  label: string
  /** Teks tambahan di kanan, mis. sisa stok atau nomor WA tersamar. */
  hint?: string
  /** Kata lain yang ikut dicocokkan saat mencari. */
  keywords?: string[]
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null
  onValueChange: (value: string | null) => void
  placeholder: string
  searchPlaceholder: string
  emptyText: string
  id?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
}

/** Pilih satu dari daftar panjang dengan mengetik (Popover + Command). */
function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  id,
  disabled,
  className,
  ...aria
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((option) => option.value === value) ?? null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={aria["aria-invalid"]}
          disabled={disabled}
          data-slot="combobox-trigger"
          className={cn(
            "flex h-10 pointer-coarse:h-11 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3.5 text-left text-sm shadow-[0_1px_2px_rgb(6_32_54/0.05)] transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={(next) => {
                    onValueChange(next === value ? null : next)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    aria-hidden
                    className={cn("size-4 text-primary", option.value === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { Combobox }
