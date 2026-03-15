import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse bg-[#222] border-2 border-white", className)}
      {...props}
    />
  )
}

export { Skeleton }
