import { Flame, Utensils } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useAchievements } from "@/features/achievements/queries"

export function StreakDisplay() {
  const { data: achievementsData } = useAchievements()
  const streaks = achievementsData?.streaks ?? {
    currentWorkoutStreak: 0,
    currentNutritionStreak: 0,
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-category-consistency/10 text-category-consistency">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{streaks.currentWorkoutStreak}</p>
            <p className="text-xs text-muted-foreground">Workout Streak</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-category-nutrition/10 text-category-nutrition">
            <Utensils className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{streaks.currentNutritionStreak}</p>
            <p className="text-xs text-muted-foreground">Nutrition Streak</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
