import { create } from "zustand"
import { format, parseISO, differenceInCalendarDays, subDays } from "date-fns"
import type { UnlockedAchievement, StreakData, MuscleGroup } from "@/lib/types"
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

  // Streak management
  updateWorkoutStreak: (workoutDate: string) => Promise<void>
  updateNutritionStreak: (nutritionDate: string) => Promise<void>
  recalculateStreaks: (workoutDates: string[], nutritionDates: string[]) => Promise<void>

  // Achievement checking
  checkWorkoutAchievements: (stats: {
    totalWorkouts: number
    totalVolume: number
    prCount: number
    templateCount: number
    muscleGroupsThisWeek: Set<MuscleGroup>
  }) => void
  checkNutritionAchievements: (stats: {
    daysLogged: number
  }) => void
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

  updateWorkoutStreak: async (workoutDate) => {
    await db.transaction("rw", db.achievements, async () => {
      const currentData = await db.achievements.get("achievements")
      const streaks = currentData?.streaks || get().streaks
      const { lastWorkoutDate, currentWorkoutStreak, longestWorkoutStreak } = streaks

      const today = format(new Date(), "yyyy-MM-dd")
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")

      let newStreak = currentWorkoutStreak

      if (!lastWorkoutDate) {
        newStreak = 1
      } else if (workoutDate === lastWorkoutDate) {
        newStreak = currentWorkoutStreak
      } else if (lastWorkoutDate === yesterday || lastWorkoutDate === today) {
        if (workoutDate === today && lastWorkoutDate !== today) {
          newStreak = currentWorkoutStreak + 1
        }
      } else {
        const daysSinceLastWorkout = differenceInCalendarDays(
          parseISO(today),
          parseISO(lastWorkoutDate)
        )
        if (daysSinceLastWorkout > 1) {
          newStreak = 1
        }
      }

      const newLongest = Math.max(newStreak, longestWorkoutStreak)
      const newStreaks = {
        ...streaks,
        currentWorkoutStreak: newStreak,
        longestWorkoutStreak: newLongest,
        lastWorkoutDate: workoutDate,
      }

      await db.achievements.put({
        id: "achievements",
        unlockedAchievements: currentData?.unlockedAchievements || get().unlockedAchievements,
        streaks: newStreaks,
      })
      
      set({ streaks: newStreaks })
    })
  },

  updateNutritionStreak: async (nutritionDate) => {
    await db.transaction("rw", db.achievements, async () => {
      const currentData = await db.achievements.get("achievements")
      const streaks = currentData?.streaks || get().streaks
      const {
        lastNutritionDate,
        currentNutritionStreak,
        longestNutritionStreak,
      } = streaks

      const today = format(new Date(), "yyyy-MM-dd")
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")

      let newStreak = currentNutritionStreak

      if (!lastNutritionDate) {
        newStreak = 1
      } else if (nutritionDate === lastNutritionDate) {
        newStreak = currentNutritionStreak
      } else if (
        lastNutritionDate === yesterday ||
        lastNutritionDate === today
      ) {
        if (nutritionDate === today && lastNutritionDate !== today) {
          newStreak = currentNutritionStreak + 1
        }
      } else {
        const daysSinceLastLog = differenceInCalendarDays(
          parseISO(today),
          parseISO(lastNutritionDate)
        )
        if (daysSinceLastLog > 1) {
          newStreak = 1
        }
      }

      const newLongest = Math.max(newStreak, longestNutritionStreak)
      const newStreaks = {
        ...streaks,
        currentNutritionStreak: newStreak,
        longestNutritionStreak: newLongest,
        lastNutritionDate: nutritionDate,
      }

      await db.achievements.put({
        id: "achievements",
        unlockedAchievements: currentData?.unlockedAchievements || get().unlockedAchievements,
        streaks: newStreaks,
      })
      
      set({ streaks: newStreaks })
    })
  },

  recalculateStreaks: async (workoutDates, nutritionDates) => {
    // Sort dates descending (most recent first)
    const sortedWorkoutDates = [...workoutDates].sort().reverse()
    const sortedNutritionDates = [...nutritionDates].sort().reverse()

    // Calculate workout streak
    let workoutStreak = 0
    let longestWorkoutStreak = 0
    if (sortedWorkoutDates.length > 0) {
      let tempStreak = 0

      for (let i = 0; i <= 365; i++) {
        const checkDate = format(subDays(new Date(), i), "yyyy-MM-dd")
        if (sortedWorkoutDates.includes(checkDate)) {
          tempStreak++
        } else if (tempStreak > 0) {
          // Streak broken
          break
        }
      }
      workoutStreak = tempStreak
      longestWorkoutStreak = Math.max(
        tempStreak,
        get().streaks.longestWorkoutStreak
      )
    }

    // Calculate nutrition streak
    let nutritionStreak = 0
    let longestNutritionStreak = 0
    if (sortedNutritionDates.length > 0) {
      let tempStreak = 0

      for (let i = 0; i <= 365; i++) {
        const checkDate = format(subDays(new Date(), i), "yyyy-MM-dd")
        if (sortedNutritionDates.includes(checkDate)) {
          tempStreak++
        } else if (tempStreak > 0) {
          break
        }
      }
      nutritionStreak = tempStreak
      longestNutritionStreak = Math.max(
        tempStreak,
        get().streaks.longestNutritionStreak
      )
    }

    const newStreaks = {
      currentWorkoutStreak: workoutStreak,
      longestWorkoutStreak: longestWorkoutStreak,
      lastWorkoutDate: sortedWorkoutDates[0] || null,
      currentNutritionStreak: nutritionStreak,
      longestNutritionStreak: longestNutritionStreak,
      lastNutritionDate: sortedNutritionDates[0] || null,
    }

    set({ streaks: newStreaks })
    // Use put() to ensure the record exists (upsert behavior)
    await db.achievements.put({
      id: "achievements",
      unlockedAchievements: get().unlockedAchievements,
      streaks: newStreaks,
    })
  },

  checkWorkoutAchievements: (stats) => {
    const { unlockAchievement, isAchievementUnlocked, streaks } = get()

    // Helper to handle async unlock with error logging
    const tryUnlock = (id: string) => {
      unlockAchievement(id).catch((err) => 
        console.error(`Failed to unlock achievement ${id}:`, err)
      )
    }

    // Workout count achievements
    if (stats.totalWorkouts >= 1 && !isAchievementUnlocked("first-workout")) {
      tryUnlock("first-workout")
    }
    if (stats.totalWorkouts >= 10 && !isAchievementUnlocked("ten-workouts")) {
      tryUnlock("ten-workouts")
    }
    if (stats.totalWorkouts >= 50 && !isAchievementUnlocked("fifty-workouts")) {
      tryUnlock("fifty-workouts")
    }
    if (stats.totalWorkouts >= 100 && !isAchievementUnlocked("century-club")) {
      tryUnlock("century-club")
    }

    // Streak achievements
    if (streaks.currentWorkoutStreak >= 7 && !isAchievementUnlocked("week-warrior")) {
      tryUnlock("week-warrior")
    }
    if (streaks.currentWorkoutStreak >= 30 && !isAchievementUnlocked("month-master")) {
      tryUnlock("month-master")
    }

    // Volume achievements
    if (stats.totalVolume >= 10000 && !isAchievementUnlocked("10k-club")) {
      tryUnlock("10k-club")
    }
    if (stats.totalVolume >= 100000 && !isAchievementUnlocked("100k-crusher")) {
      tryUnlock("100k-crusher")
    }
    if (stats.totalVolume >= 500000 && !isAchievementUnlocked("500k-beast")) {
      tryUnlock("500k-beast")
    }
    if (stats.totalVolume >= 1000000 && !isAchievementUnlocked("million-pounder")) {
      tryUnlock("million-pounder")
    }

    // PR achievements
    if (stats.prCount >= 1 && !isAchievementUnlocked("first-pr")) {
      tryUnlock("first-pr")
    }
    if (stats.prCount >= 10 && !isAchievementUnlocked("pr-collector")) {
      tryUnlock("pr-collector")
    }
    if (stats.prCount >= 25 && !isAchievementUnlocked("pr-master")) {
      tryUnlock("pr-master")
    }

    // Template achievements
    if (stats.templateCount >= 3 && !isAchievementUnlocked("template-creator")) {
      tryUnlock("template-creator")
    }

    // Variety achievements
    if (stats.muscleGroupsThisWeek.size >= 6 && !isAchievementUnlocked("full-body")) {
      tryUnlock("full-body")
    }
  },

  checkNutritionAchievements: (stats) => {
    const { unlockAchievement, isAchievementUnlocked, streaks } = get()

    // Helper to handle async unlock with error logging
    const tryUnlock = (id: string) => {
      unlockAchievement(id).catch((err) => 
        console.error(`Failed to unlock achievement ${id}:`, err)
      )
    }

    // Days logged achievements
    if (stats.daysLogged >= 7 && !isAchievementUnlocked("macro-tracker")) {
      tryUnlock("macro-tracker")
    }

    // Nutrition streak
    if (streaks.currentNutritionStreak >= 30 && !isAchievementUnlocked("nutrition-streak")) {
      tryUnlock("nutrition-streak")
    }
  },
}))
