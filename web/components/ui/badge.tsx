import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider font-mono transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black border border-white",
        secondary:
          "bg-white text-black border border-white",
        destructive:
          "bg-white text-black border border-white",
        outline:
          "bg-black text-white border border-white",
        success:
          "bg-white text-black border border-white",
        warning:
          "bg-white text-black border border-white",
        new:
          "bg-black text-white border border-white",
        rising:
          "bg-black text-white border border-white",
        established:
          "bg-white text-black border border-white",
        top_rated:
          "bg-white text-black border border-white",
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
