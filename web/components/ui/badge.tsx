import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center px-2.5 py-0.5 text-xs font-medium tracking-wide font-mono transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-neutral-800 text-neutral-300 border border-neutral-700/40",
        secondary:
          "bg-neutral-800 text-neutral-300 border border-neutral-700/40",
        destructive:
          "bg-red-500/10 text-red-400 border border-red-500/20",
        outline:
          "bg-transparent text-neutral-300 border border-neutral-700/40",
        success:
          "bg-green-500/10 text-green-400 border border-green-500/20",
        warning:
          "bg-neutral-800 text-neutral-300 border border-neutral-700/40",
        new:
          "bg-neutral-800 text-neutral-400 border border-neutral-700/40",
        rising:
          "bg-neutral-800 text-neutral-300 border border-neutral-700/40",
        established:
          "bg-green-500/10 text-green-400 border border-green-500/20",
        top_rated:
          "bg-neutral-800 text-neutral-300 border border-neutral-700/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
