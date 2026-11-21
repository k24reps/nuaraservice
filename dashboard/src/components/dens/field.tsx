import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/dens/label"

/*
 * Label + satu kontrol + petunjuk atau pesan galat (Nuara, bukan bagian
 * dens-ui). Kontrolnya otomatis mendapat `id`, `aria-invalid`, dan
 * `aria-describedby` yang menunjuk ke pesan di bawahnya (DBD bagian 5).
 * Anak harus satu elemen yang meneruskan atribut itu ke <input>/<select>.
 */
function Field({
  label,
  hint,
  error,
  id: idProp,
  className,
  children,
}: {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  id?: string
  className?: string
  children: React.ReactElement<Record<string, unknown>>
}) {
  const autoId = React.useId()
  const id = idProp ?? autoId
  const hintId = hint && !error ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined

  return (
    <div data-slot="field" className={cn("grid gap-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {React.cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Pesan galat untuk satu form (di luar kolom tertentu), diumumkan pembaca layar. */
function FormMessage({ className, children }: { className?: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <p
      role="alert"
      data-slot="form-message"
      className={cn("rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive", className)}
    >
      {children}
    </p>
  )
}

export { Field, FormMessage }
