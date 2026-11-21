import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { scorePassword, type PasswordLevel } from "@/lib/business/password"

/*
 * Kekuatan password untuk daftar dan reset (Nuara, bukan bagian dens-ui).
 * Aturan penilaiannya di lib/business/password.ts; simbol adalah bonus,
 * bukan syarat.
 */
const CRITERIA = [
  { key: "length", label: "Min. 8 karakter" },
  { key: "letter", label: "Huruf" },
  { key: "digit", label: "Angka" },
  { key: "symbol", label: "Simbol (bonus)" },
] as const

const LEVEL_TONE: Record<Exclude<PasswordLevel, "empty">, { bar: string; text: string }> = {
  weak: { bar: "bg-destructive", text: "text-destructive" },
  medium: { bar: "bg-highlight", text: "text-warning-foreground" },
  strong: { bar: "bg-success-foreground", text: "text-success-foreground" },
}

function PasswordStrength({ password, className }: { password: string; className?: string }) {
  const { checks, passed, level, label } = scorePassword(password)
  if (!password || level === "empty") return null
  const tone = LEVEL_TONE[level]
  return (
    <div data-slot="password-strength" data-level={level} className={cn("grid gap-2", className)}>
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1.5 rounded-full", i < passed ? tone.bar : "bg-muted")} />
          ))}
        </div>
        <span className={cn("text-xs font-semibold", tone.text)}>{label}</span>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {CRITERIA.map((c) => (
          <li key={c.key} className={cn("inline-flex items-center gap-1", checks[c.key] && "text-success-foreground")}>
            <CheckIcon aria-hidden className={cn("size-3.5", !checks[c.key] && "opacity-30")} />
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { PasswordStrength }
