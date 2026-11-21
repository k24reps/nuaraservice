import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ImageIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const skeletonVariants = cva("bg-muted motion-reduce:animate-none", {
  variants: {
    variant: {
      /** the whole shape breathes */
      pulse: "animate-pulse",
      /** a soft band of light sweeps across; reads as "on its way" for images */
      shimmer:
        "animate-shimmer bg-[linear-gradient(100deg,var(--nu-muted)_30%,color-mix(in_srgb,var(--nu-card)_70%,var(--nu-muted))_50%,var(--nu-muted)_70%)] bg-[length:200%_100%]",
    },
  },
  defaultVariants: { variant: "pulse" },
})

type SkeletonProps = React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>

function Skeleton({ className, variant, ...props }: SkeletonProps) {
  return <div data-slot="skeleton" aria-hidden className={cn(skeletonVariants({ variant }), "rounded-lg", className)} {...props} />
}

/** Lines of text. The last line is shorter, the way a paragraph ends. */
function SkeletonText({
  lines = 3,
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants> & { lines?: number }) {
  return (
    <div data-slot="skeleton-text" aria-hidden className={cn("grid gap-2", className)} {...props}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          variant={variant}
          className={cn("h-3 rounded-full", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </div>
  )
}

/** An image that has not arrived yet. Keeps the final aspect ratio so nothing jumps. */
function SkeletonImage({
  ratio = "16 / 9",
  icon = true,
  className,
  variant = "shimmer",
  style,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof skeletonVariants> & {
    /** CSS aspect-ratio, e.g. "16 / 9", "4 / 3", "1" */
    ratio?: string
    /** show a faint image glyph in the middle */
    icon?: boolean
  }) {
  return (
    <div
      data-slot="skeleton-image"
      aria-hidden
      className={cn(skeletonVariants({ variant }), "grid aspect-(--skeleton-ratio) place-content-center rounded-lg text-muted-foreground/35", className)}
      style={{ "--skeleton-ratio": ratio, ...style } as React.CSSProperties}
      {...props}
    >
      {icon && <ImageIcon className="size-[clamp(20px,12%,36px)]" strokeWidth={1.5} />}
    </div>
  )
}

/**
 * A blog or post card while it loads: image, meta, title, excerpt and author.
 * Geometry matches <PostCard>: card 22, padding 8, image 14.
 */
function SkeletonPostCard({
  layout = "stacked",
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof skeletonVariants> & {
    layout?: "stacked" | "horizontal"
  }) {
  return (
    <div
      data-slot="skeleton-post-card"
      role="status"
      className={cn(
        "flex gap-2 rounded-2xl bg-card p-2 shadow-panel ring-1 ring-border/60",
        layout === "stacked" ? "flex-col" : "flex-col sm:flex-row",
        className
      )}
      {...props}
    >
      <span className="sr-only">Memuat</span>
      <SkeletonImage
        variant={variant ?? "shimmer"}
        ratio="16 / 10"
        className={cn(layout === "horizontal" && "sm:w-[42%] sm:shrink-0 sm:self-stretch sm:aspect-auto")}
      />
      <div className="flex flex-1 flex-col gap-4 p-3">
        <Skeleton variant={variant} className="h-3 w-28 rounded-full" />
        <div className="grid gap-2">
          <Skeleton variant={variant} className="h-5 w-11/12 rounded-full" />
          <Skeleton variant={variant} className="h-5 w-2/3 rounded-full" />
        </div>
        <SkeletonText variant={variant} lines={2} />
        <div className="mt-auto flex items-center gap-3 pt-1">
          <Skeleton variant={variant} className="size-8 rounded-full" />
          <Skeleton variant={variant} className="h-3 w-32 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonImage, SkeletonPostCard, skeletonVariants }
