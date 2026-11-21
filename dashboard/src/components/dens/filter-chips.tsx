import { useT } from "@/i18n"
import { cn } from "@/lib/utils"

/*
 * Baris chip saring dengan jumlah (Nuara, bukan bagian dens-ui), pengganti
 * `CategoryChips` FixMaster dengan API yang sama. Angka di chip = yang tampil
 * bila chip itu dipilih. Satu baris yang bisa digeser; chip di luar tepi
 * memudar (`scroll-fade-x`, app.css) sebagai tanda baris bisa digeser.
 * Tidak dirender bila pilihannya kurang dari dua.
 */
function FilterChips({
  categories,
  total,
  value,
  onChange,
  label,
  labelOf,
  className,
}: {
  categories: [string, number][]
  total: number
  value: string
  onChange: (id: string) => void
  label: string
  labelOf?: (id: string) => string
  className?: string
}) {
  const t = useT()
  if (categories.length < 2) return null
  const chip = (id: string, text: string, count: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={value === id}
      onClick={() => onChange(id)}
      className="group/chip inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-3.5 text-[13px] font-medium text-foreground ring-1 ring-border outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:ring-primary pointer-coarse:min-h-11"
    >
      {text}
      <span className="font-mono text-xs tabular-nums text-muted-foreground group-aria-pressed/chip:text-primary-foreground/75">
        {count}
      </span>
    </button>
  )
  return (
    <div
      data-slot="filter-chips"
      role="group"
      aria-label={label}
      // Jarak 2px: cincin fokus chip tidak terpotong tepi wadah gulir.
      className={cn("scroll-fade-x flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:thin]", className)}
    >
      {chip("all", t("common.all"), total)}
      {categories.map(([id, count]) => chip(id, labelOf ? labelOf(id) : id, count))}
    </div>
  )
}

export { FilterChips }
