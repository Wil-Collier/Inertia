import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AchievementBadgeProps {
  icon: LucideIcon
  className?: string
}

export function AchievementBadge({ icon: Icon, className }: AchievementBadgeProps) {
  return (
    <div className={cn(
      "flex h-10 w-10 items-center justify-center rounded-full bg-achievement/10 text-achievement",
      className
    )}>
      <Icon className="h-5 w-5" />
    </div>
  )
}
