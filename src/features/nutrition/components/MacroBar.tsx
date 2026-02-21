import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MacroBarProps {
  label: string
  value: number
  goal: number
  color: string
  icon?: LucideIcon
}

export function MacroBar({ label, value, goal, color, icon: Icon }: MacroBarProps) {
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
          <span className="text-xxs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black">
            {Math.round(value)}g
          </span>
          <span className="text-xxs text-muted-foreground font-medium">/ {goal}g</span>
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", color)} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
    </div>
  )
}
