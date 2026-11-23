import { Grid3x3, LayoutGrid, List } from "lucide-react"

import { CATALOG_VIEWS, type CatalogView } from "@/components/ui/catalogView"
import { cn } from "@/lib/utils"

/* Nuara: pengganti ViewToggle FixMaster (CatalogControls), API sama. Kontrol
   bersegmen dengan tombol aria-pressed; pilihan diingat per halaman lewat
   usePersistedView. */
const ICON: Record<CatalogView, typeof List> = {
  cards: LayoutGrid,
  list: List,
  tiles: Grid3x3,
}

function ViewToggle({
  value,
  onChange,
  label,
  className,
}: {
  value: CatalogView
  onChange: (view: CatalogView) => void
  label: string
  className?: string
}) {
  return (
    <div
      data-slot="view-toggle"
      role="group"
      aria-label={label}
      className={cn("inline-flex h-10 shrink-0 gap-0.5 rounded-full bg-muted p-1 ring-1 ring-inset ring-border/60 pointer-coarse:h-11", className)}
    >
      {CATALOG_VIEWS.map((v) => {
        const Glyph = ICON[v.id]
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={value === v.id}
            aria-label={v.label}
            title={v.label}
            onClick={() => onChange(v.id)}
            className="relative grid h-full w-9 place-items-center rounded-full pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1 text-muted-foreground transition-[color,background-color,box-shadow] outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-[0_1px_2px_rgb(6_32_54/0.08),0_2px_8px_-2px_rgb(6_32_54/0.1)] pointer-coarse:w-11 [&_svg]:size-4"
          >
            <Glyph aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

export { ViewToggle }
