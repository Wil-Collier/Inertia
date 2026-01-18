import { create } from "zustand"
import type { UnlockedAchievement, StreakData } from "@/lib/types"
import { achievements } from "@/data/achievements"
import { toast } from "sonner"
import { db } from "@/services/db"

interface AchievementsStore {
  // State
  unlockedAchievements: UnlockedAchievement[]
  streaks: StreakData
  isInitialized: boolean
  init: () => Promise<void>

  // Actions
  unlockAchievement: (id: string) => Promise<boolean>
  isAchievementUnlocked: (id: string) => boolean
  getUnlockedAchievement: (id: string) => UnlockedAchievement | undefined
}

const defaultStreaks: StreakData = {
  currentWorkoutStreak: 0,
  longestWorkoutStreak: 0,
  lastWorkoutDate: null,
  currentNutritionStreak: 0,
  longestNutritionStreak: 0,
  lastNutritionDate: null,
}

export const useAchievementsStore = create<AchievementsStore>((set, get) => ({
  unlockedAchievements: [],
  streaks: defaultStreaks,
  isInitialized: false,

  init: async () => {
    if (get().isInitialized) return
    try {
      const data = await db.achievements.get("achievements")
      if (data) {
        set({
          unlockedAchievements: data.unlockedAchievements,
          streaks: data.streaks,
          isInitialized: true,
        })
      } else {
        await db.achievements.put({
          id: "achievements",
          unlockedAchievements: [],
          streaks: defaultStreaks,
        })
        set({ isInitialized: true })
      }
    } catch (error) {
      console.error("Failed to init achievements store:", error)
      set({ isInitialized: true })
    }
  },

  unlockAchievement: async (id) => {
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
        streaks: currentData?.streaks || get().streaks,
      })

      set({ unlockedAchievements: newUnlocked })

      // Show toast notification
      toast.success(`Achievement Unlocked: ${achievement.name}`, {
        description: achievement.description,
        duration: 5000,
      })

      return true
    })
  },

  isAchievementUnlocked: (id) => {
    return get().unlockedAchievements.some((a) => a.id === id)
  },

  getUnlockedAchievement: (id) => {
    return get().unlockedAchievements.find((a) => a.id === id)
  },
}))
