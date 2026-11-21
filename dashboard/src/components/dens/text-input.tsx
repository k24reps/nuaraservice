import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { capitalizeFirst, capitalizeWords } from "@/lib/text"
import { Input } from "@/components/dens/input"

/*
 * Isian teks Nuara (bukan bagian dens-ui): perilaku `Input` FixMaster di atas
 * Input dens-ui. Huruf pertama otomatis kapital (`capitalize="words"` untuk
 * nama orang/perangkat, `"none"` untuk kode, nomor seri, kunci layar), ikon di
 * depan, dan tombol hapus isi yang juga dipicu Esc. Semua atribut lain, termasuk
 * `id`/`aria-*` dari `Field`, jatuh ke <input>.
 */
type TextInputProps = React.ComponentProps<"input"> & {
  capitalize?: "first" | "words" | "none"
  /** Ikon di kiri kolom, mis. kaca pembesar di kolom cari. */
  start?: React.ReactNode
  /** Tombol hapus isi, tampil selama kolom berisi. Hanya untuk kolom terkendali. */
  onClear?: () => void
  /** Nama aksesibel tombol hapus; wajib bersama `onClear`. */
  clearLabel?: string
}

function TextInput({
  capitalize = "first",
  start,
  onClear,
  clearLabel,
  className,
  type,
  onChange,
  onKeyDown,
  ref,
  ...props
}: TextInputProps) {
  const innerRef = React.useRef<HTMLInputElement>(null)
  React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, [])
  const clearable = !!onClear && props.value != null && String(props.value) !== ""
  // Hanya teks bebas: email, nomor telepon, angka, dan password tidak disentuh.
  const autoCap = capitalize !== "none" && (!type || type === "text" || type === "search")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoCap) {
      const capped = capitalize === "words" ? capitalizeWords(e.target.value) : capitalizeFirst(e.target.value)
      if (capped !== e.target.value) e.target.value = capped
    }
    onChange?.(e)
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented || e.key !== "Escape" || !clearable) return
    // Esc pertama mengosongkan kolom, bukan menutup jendela di atasnya.
    e.preventDefault()
    e.stopPropagation()
    onClear?.()
  }

  const input = (
    <Input
      {...props}
      ref={innerRef}
      type={type}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={cn(start && "pl-10", onClear && "pr-11 pointer-coarse:pr-12", className)}
    />
  )
  if (!start && !onClear) return input
  return (
    <div data-slot="text-input" className="relative flex items-center">
      {start && (
        <span className="pointer-events-none absolute left-3.5 flex text-muted-foreground [&>svg]:size-4">
          {start}
        </span>
      )}
      {input}
      {clearable && (
        <button
          type="button"
          onClick={() => {
            onClear?.()
            innerRef.current?.focus()
          }}
          aria-label={clearLabel}
          title={clearLabel}
          className="absolute right-1 grid size-8 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11 pointer-coarse:right-0 [&_svg]:size-4"
        >
          <XIcon aria-hidden />
        </button>
      )}
    </div>
  )
}

export { TextInput }
