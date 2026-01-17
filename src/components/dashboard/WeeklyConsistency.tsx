import { format, subDays, isSameDay } from "date-fns"
import { Check, Dumbbell, Utensils, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface WeeklyConsistencyProps {
  workoutDates: string[]
  nutritionDates: string[]
}

export function WeeklyConsistency({ workoutDates, nutritionDates }: WeeklyConsistencyProps) {
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    const dateStr = format(date, "yyyy-MM-dd")
    return {
      date,
      dateStr,
      label: format(date, "EEE").charAt(0),
      hasWorkout: workoutDates.includes(dateStr),
      hasNutrition: nutritionDates.includes(dateStr),
    }
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Weekly Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between gap-1">
          {last7Days.map((day) => (
            <div key={day.dateStr} className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase">
                {day.label}
              </span>
              <div className="flex flex-col gap-1">
                <ActivityIndicator 
                  active={day.hasWorkout} 
                  icon={Dumbbell} 
                  color="bg-primary" 
                />
                <ActivityIndicator 
                  active={day.hasNutrition} 
                  icon={Utensils} 
                  color="bg-calories" 
                />
              </div>
              {isSameDay(day.date, new Date()) && (
                <div className="h-1 w-1 rounded-full bg-foreground" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ActivityIndicator({ 
  active, 
  icon: Icon, 
  color 
}: { 
  active: boolean; 
  icon: LucideIcon; 
  color: string 
}) {
  return (
    <div 
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
        active ? color : "bg-muted"
      )}
    >
      {active ? (
        <Check className="h-4 w-4 text-white" />
      ) : (
        <Icon className="h-3 w-3 text-muted-foreground/50" />
      )}
    </div>
  )
}
