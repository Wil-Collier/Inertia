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

// Compact version for the header or smaller spaces
export function StreakBadge() {
  const { data: achievementsData } = useAchievements()
  const streaks = achievementsData?.streaks ?? {
    currentWorkoutStreak: 0,
    currentNutritionStreak: 0,
  }

  if (streaks.currentWorkoutStreak === 0 && streaks.currentNutritionStreak === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      {streaks.currentWorkoutStreak > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-category-consistency/10 px-2.5 py-1 text-category-consistency">
          <Flame className="h-4 w-4" />
          <span className="text-sm font-medium">{streaks.currentWorkoutStreak}</span>
        </div>
      )}
      {streaks.currentNutritionStreak > 0 && (
        <div className="flex items-center gap-1 rounded-full bg-category-nutrition/10 px-2.5 py-1 text-category-nutrition">
          <Utensils className="h-4 w-4" />
          <span className="text-sm font-medium">{streaks.currentNutritionStreak}</span>
        </div>
      )}
    </div>
  )
}
