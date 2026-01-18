export interface UnlockedAchievement {
  id: string
  unlockedAt: string
}

export interface StreakData {
  currentWorkoutStreak: number
  longestWorkoutStreak: number
  lastWorkoutDate: string | null
  currentNutritionStreak: number
  longestNutritionStreak: number
  lastNutritionDate: string | null
}
