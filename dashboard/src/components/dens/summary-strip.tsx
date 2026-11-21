import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/*
 * Strip ringkasan halaman (Nuara, bukan bagian dens-ui), pengganti
 * `PageSummary` FixMaster dengan API yang sama: satu panel, sel dipisah garis
 * tipis, label di atas angka. Kolomnya auto-fit (5 → 3+2 → 2+2+1) tanpa
 * breakpoint, jadi tak pernah meluap berapa pun lebar wadahnya.
 *
 * Di ponsel (<=720px, ambang menu bawah) hitungan berbagi satu baris dengan
 * label pendek: strip ini membuka halaman, dan tiap baris yang ia makan
 * menurunkan isi utama ke balik menu bawah.
 */
export type SummaryTone = "info" | "warning" | "accent" | "danger" | "success"

export interface SummaryItem {
  label: string
  /** Label pendek untuk ponsel, tempat empat sel berbagi satu baris. */
  short?: string
  value: ReactNode
  /** Titik warna di samping angka. Kosongkan bila angkanya tidak menuntut perhatian. */
  tone?: SummaryTone
  /** Sel rupiah: dua kolom, karena "Rp 13.250.000" tak muat di sel sempit. */
  wide?: boolean
  /** Disembunyikan di ponsel, mis. nilai rupiah yang sudah ada di Laporan. */
  hideOnPhone?: boolean
  /** Sel jadi tombol saring: angkanya sekaligus pintu ke daftarnya. */
  onSelect?: () => void
  /** Saringan yang sedang aktif (aria-pressed). */
  pressed?: boolean
}

const TONE_DOT: Record<SummaryTone, string> = {
  info: "bg-info-foreground",
  warning: "bg-warning-foreground",
  accent: "bg-highlight",
  danger: "bg-destructive",
  success: "bg-success-foreground",
}

const cellClass = (r: SummaryItem) =>
  cn(
    "-mb-px -mr-px flex min-w-0 flex-col gap-1 border-b border-r border-border/70 px-4 py-3 text-left",
    "phone:flex-[1_1_4rem] phone:px-2 phone:py-2",
    r.wide && "col-span-2 phone:basis-full",
    r.hideOnPhone && "phone:hidden",
  )

function Label({ r }: { r: SummaryItem }) {
  if (!r.short) return <>{r.label}</>
  return (
    <>
      <span className="phone:hidden">{r.label}</span>
      <span className="hidden phone:inline">{r.short}</span>
    </>
  )
}

function Value({ r }: { r: SummaryItem }) {
  return (
    <>
      {r.tone && <span aria-hidden className={cn("size-2 shrink-0 rounded-full", TONE_DOT[r.tone])} />}
      {r.value}
    </>
  )
}

const stripClass =
  "grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] overflow-hidden rounded-2xl bg-card text-card-foreground shadow-panel ring-1 ring-border/60 phone:flex phone:flex-wrap"
const labelClass = "text-xs font-medium text-muted-foreground"
const valueClass =
  "m-0 flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums tracking-tight [overflow-wrap:anywhere] phone:text-base"

function SummaryStrip({ items, label, className }: { items: SummaryItem[]; label: string; className?: string }) {
  // Sel yang bisa diketuk menjadikan strip grup tombol: dt/dd tak boleh berisi tombol.
  if (items.some((r) => r.onSelect)) {
    return (
      <div data-slot="summary-strip" className={cn(stripClass, className)} role="group" aria-label={label}>
        {items.map((r) =>
          r.onSelect ? (
            <button
              key={r.label}
              type="button"
              aria-pressed={!!r.pressed}
              onClick={r.onSelect}
              className={cn(
                cellClass(r),
                "cursor-pointer outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-pressed:bg-highlight-soft aria-pressed:shadow-[inset_0_-3px_0_var(--color-highlight)]",
              )}
            >
              <span className={labelClass}>
                <Label r={r} />
              </span>
              <span className={valueClass}>
                <Value r={r} />
              </span>
            </button>
          ) : (
            <div key={r.label} className={cellClass(r)}>
              <span className={labelClass}>
                <Label r={r} />
              </span>
              <span className={valueClass}>
                <Value r={r} />
              </span>
            </div>
          ),
        )}
      </div>
    )
  }
  return (
    <dl data-slot="summary-strip" className={cn(stripClass, "m-0", className)} aria-label={label}>
      {items.map((r) => (
        <div key={r.label} className={cellClass(r)}>
          <dt className={labelClass}>
            <Label r={r} />
          </dt>
          <dd className={valueClass}>
            <Value r={r} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export { SummaryStrip }
