import type { ReactNode } from "react"
import { InboxIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** Keadaan kosong: ikon, judul, penjelasan, satu aksi (Nuara, bukan bagian dens-ui; DBD 3). */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground [&_svg]:size-5">
        {icon ?? <InboxIcon aria-hidden />}
      </div>
      <p className="text-base font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export { EmptyState }
