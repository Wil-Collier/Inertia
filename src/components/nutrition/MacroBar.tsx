import { Progress } from "@/components/ui/progress"

interface MacroBarProps {
  label: string
  value: number
  goal: number
  color: string
}

export function MacroBar({ label, value, goal, color }: MacroBarProps) {
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
      </div>
      <Progress value={percentage} className={`h-2 [&>div]:${color}`} />
      <p className="text-xs font-medium">
        {Math.round(value)}g / {goal}g
      </p>
    </div>
  )
}
