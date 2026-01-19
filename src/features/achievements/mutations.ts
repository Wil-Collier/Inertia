import { useMutation, useQueryClient } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import { achievements } from "@/data/achievements"
import { toast } from "sonner"
import type { UnlockedAchievement } from "@/lib/types"

export function useUnlockAchievement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      return await db.transaction("rw", db.achievements, async () => {
        const currentData = await db.achievements.get("achievements")
        const unlocked = currentData?.unlockedAchievements || []
        
        const existing = unlocked.find((a) => a.id === id)
        if (existing) return false

        const achievement = achievements.find((a) => a.id === id)
        if (!achievement) return false

        const newAchievement: UnlockedAchievement = {
          id,
          unlockedAt: new Date().toISOString(),
        }

        const newUnlocked = [...unlocked, newAchievement]
        
        await db.achievements.put({
          id: "achievements",
          unlockedAchievements: newUnlocked,
          streaks: currentData?.streaks || {
            currentWorkoutStreak: 0,
            longestWorkoutStreak: 0,
            lastWorkoutDate: null,
            currentNutritionStreak: 0,
            longestNutritionStreak: 0,
            lastNutritionDate: null,
          },
        })

        return { achievement, isNew: true }
      })
    },
    onSuccess: (result) => {
      if (result && result.isNew) {
        queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
        toast.success(`Achievement Unlocked: ${result.achievement.name}`, {
          description: result.achievement.description,
          duration: 5000,
        })
      }
    },
  })
}
