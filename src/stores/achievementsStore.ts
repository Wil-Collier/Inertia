import { create } from "zustand"
import { persist } from "zustand/middleware"
import { format, parseISO, differenceInCalendarDays, subDays } from "date-fns"
import type { UnlockedAchievement, StreakData, MuscleGroup } from "@/lib/types"
import { achievements } from "@/data/achievements"
import { toast } from "sonner"

interface AchievementsStore {
  // State
  unlockedAchievements: UnlockedAchievement[]
  streaks: StreakData

  // Actions
  unlockAchievement: (id: string) => boolean
  isAchievementUnlocked: (id: string) => boolean
  getUnlockedAchievement: (id: string) => UnlockedAchievement | undefined

  // Streak management
  updateWorkoutStreak: (workoutDate: string) => void
  updateNutritionStreak: (nutritionDate: string) => void
  recalculateStreaks: (workoutDates: string[], nutritionDates: string[]) => void

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

export const useAchievementsStore = create<AchievementsStore>()(
  persist(
    (set, get) => ({
      unlockedAchievements: [],
      streaks: {
        currentWorkoutStreak: 0,
        longestWorkoutStreak: 0,
        lastWorkoutDate: null,
        currentNutritionStreak: 0,
        longestNutritionStreak: 0,
        lastNutritionDate: null,
      },

      unlockAchievement: (id) => {
        const existing = get().unlockedAchievements.find((a) => a.id === id)
        if (existing) return false

        const achievement = achievements.find((a) => a.id === id)
        if (!achievement) return false

        const newAchievement: UnlockedAchievement = {
          id,
          unlockedAt: new Date().toISOString(),
        }

        set((state) => ({
          unlockedAchievements: [...state.unlockedAchievements, newAchievement],
        }))

        // Show toast notification
        toast.success(`Achievement Unlocked: ${achievement.name}`, {
          description: achievement.description,
          duration: 5000,
        })

        return true
      },

      isAchievementUnlocked: (id) => {
        return get().unlockedAchievements.some((a) => a.id === id)
      },

      getUnlockedAchievement: (id) => {
        return get().unlockedAchievements.find((a) => a.id === id)
      },

      updateWorkoutStreak: (workoutDate) => {
        const today = format(new Date(), "yyyy-MM-dd")
        const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")

        set((state) => {
          const { lastWorkoutDate, currentWorkoutStreak, longestWorkoutStreak } =
            state.streaks

          let newStreak = currentWorkoutStreak

          if (!lastWorkoutDate) {
            // First workout ever
            newStreak = 1
          } else if (workoutDate === lastWorkoutDate) {
            // Same day workout, streak unchanged
            newStreak = currentWorkoutStreak
          } else if (lastWorkoutDate === yesterday || lastWorkoutDate === today) {
            // Consecutive day (yesterday or today already logged)
            if (workoutDate === today && lastWorkoutDate !== today) {
              newStreak = currentWorkoutStreak + 1
            }
          } else {
            // Streak broken, start fresh
            const daysSinceLastWorkout = differenceInCalendarDays(
              parseISO(today),
              parseISO(lastWorkoutDate)
            )
            if (daysSinceLastWorkout > 1) {
              newStreak = 1
            }
          }

          const newLongest = Math.max(newStreak, longestWorkoutStreak)

          return {
            streaks: {
              ...state.streaks,
              currentWorkoutStreak: newStreak,
              longestWorkoutStreak: newLongest,
              lastWorkoutDate: workoutDate,
            },
          }
        })
      },

      updateNutritionStreak: (nutritionDate) => {
        const today = format(new Date(), "yyyy-MM-dd")
        const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd")

        set((state) => {
          const {
            lastNutritionDate,
            currentNutritionStreak,
            longestNutritionStreak,
          } = state.streaks

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

          return {
            streaks: {
              ...state.streaks,
              currentNutritionStreak: newStreak,
              longestNutritionStreak: newLongest,
              lastNutritionDate: nutritionDate,
            },
          }
        })
      },

      recalculateStreaks: (workoutDates, nutritionDates) => {
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

        set({
          streaks: {
            currentWorkoutStreak: workoutStreak,
            longestWorkoutStreak: longestWorkoutStreak,
            lastWorkoutDate: sortedWorkoutDates[0] || null,
            currentNutritionStreak: nutritionStreak,
            longestNutritionStreak: longestNutritionStreak,
            lastNutritionDate: sortedNutritionDates[0] || null,
          },
        })
      },

      checkWorkoutAchievements: (stats) => {
        const { unlockAchievement, isAchievementUnlocked, streaks } = get()

        // Workout count achievements
        if (stats.totalWorkouts >= 1 && !isAchievementUnlocked("first-workout")) {
          unlockAchievement("first-workout")
        }
        if (stats.totalWorkouts >= 10 && !isAchievementUnlocked("ten-workouts")) {
          unlockAchievement("ten-workouts")
        }
        if (stats.totalWorkouts >= 50 && !isAchievementUnlocked("fifty-workouts")) {
          unlockAchievement("fifty-workouts")
        }
        if (stats.totalWorkouts >= 100 && !isAchievementUnlocked("century-club")) {
          unlockAchievement("century-club")
        }

        // Streak achievements
        if (streaks.currentWorkoutStreak >= 7 && !isAchievementUnlocked("week-warrior")) {
          unlockAchievement("week-warrior")
        }
        if (streaks.currentWorkoutStreak >= 30 && !isAchievementUnlocked("month-master")) {
          unlockAchievement("month-master")
        }

        // Volume achievements
        if (stats.totalVolume >= 10000 && !isAchievementUnlocked("10k-club")) {
          unlockAchievement("10k-club")
        }
        if (stats.totalVolume >= 100000 && !isAchievementUnlocked("100k-crusher")) {
          unlockAchievement("100k-crusher")
        }
        if (stats.totalVolume >= 500000 && !isAchievementUnlocked("500k-beast")) {
          unlockAchievement("500k-beast")
        }
        if (stats.totalVolume >= 1000000 && !isAchievementUnlocked("million-pounder")) {
          unlockAchievement("million-pounder")
        }

        // PR achievements
        if (stats.prCount >= 1 && !isAchievementUnlocked("first-pr")) {
          unlockAchievement("first-pr")
        }
        if (stats.prCount >= 10 && !isAchievementUnlocked("pr-collector")) {
          unlockAchievement("pr-collector")
        }
        if (stats.prCount >= 25 && !isAchievementUnlocked("pr-master")) {
          unlockAchievement("pr-master")
        }

        // Template achievements
        if (stats.templateCount >= 3 && !isAchievementUnlocked("template-creator")) {
          unlockAchievement("template-creator")
        }

        // Variety achievements
        if (stats.muscleGroupsThisWeek.size >= 6 && !isAchievementUnlocked("full-body")) {
          unlockAchievement("full-body")
        }
      },

      checkNutritionAchievements: (stats) => {
        const { unlockAchievement, isAchievementUnlocked, streaks } = get()

        // Days logged achievements
        if (stats.daysLogged >= 7 && !isAchievementUnlocked("macro-tracker")) {
          unlockAchievement("macro-tracker")
        }

        // Nutrition streak
        if (streaks.currentNutritionStreak >= 30 && !isAchievementUnlocked("nutrition-streak")) {
          unlockAchievement("nutrition-streak")
        }
      },
    }),
    {
      name: "training-app-achievements",
      version: 1,
    }
  )
)
