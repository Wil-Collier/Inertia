import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { StreakData } from "@/lib/types"

const defaultStreaks: StreakData = {
  currentWorkoutStreak: 0,
  longestWorkoutStreak: 0,
  lastWorkoutDate: null,
  currentNutritionStreak: 0,
  longestNutritionStreak: 0,
  lastNutritionDate: null,
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements.all,
    queryFn: async () => {
      const data = await db.achievements.get("achievements")
      return data ?? {
        id: "achievements",
        unlockedAchievements: [],
        streaks: defaultStreaks,
      }
    },
  })
}
