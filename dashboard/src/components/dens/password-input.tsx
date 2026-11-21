import * as React from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/dens/input"

/** Isian password dengan tombol tampil/sembunyi (Nuara, bukan bagian dens-ui). */
function PasswordInput({
  showLabel,
  hideLabel,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = React.useState(false)
  return (
    <div data-slot="password-input" className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

export { PasswordInput }
