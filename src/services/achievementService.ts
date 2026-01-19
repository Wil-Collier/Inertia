import { db } from "@/services/db"
import { format, startOfWeek, eachDayOfInterval, subDays, differenceInCalendarDays, parseISO } from "date-fns"
import type { MuscleGroup, UnlockedAchievement, StreakData } from "@/lib/types"
import { achievements } from "@/data/achievements"
import { toast } from "sonner"
import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/lib/queryKeys"

const DEFAULT_TEMPLATE_COUNT = 5

const defaultStreaks: StreakData = {
  currentWorkoutStreak: 0,
  longestWorkoutStreak: 0,
  lastWorkoutDate: null,
  currentNutritionStreak: 0,
  longestNutritionStreak: 0,
  lastNutritionDate: null,
}

/**
 * Service to check and update achievements and streaks.
 * This should be called after major user actions (finishing workout, logging meal).
 */
export const achievementService = {
  /**
   * Recalculates all stats and checks achievements.
   * Can be heavy, so use sparingly.
   */
  async checkAll() {
    await Promise.all([
      this.checkWorkoutAchievements(),
      this.checkNutritionAchievements(),
      this.updateStreaks()
    ])
  },

  async checkWorkoutAchievements() {
    const workouts = await db.workoutSessions.toArray()
    const personalRecords = await db.personalRecords.toArray()
    const templates = await db.workoutTemplates.toArray()
    
    const exercises = await db.exercises.toArray()
    const exercisesById = new Map(exercises.map(e => [e.id, e]))

    const totalWorkouts = workouts.length
    const totalVolume = workouts.reduce((total, workout) => {
      return (
        total +
        workout.exercises.reduce((exTotal, ex) => {
          return (
            exTotal +
            ex.sets
              .filter((s) => s.isCompleted)
              .reduce((setTotal, set) => {
                return setTotal + set.weight * set.reps
              }, 0)
          )
        }, 0)
      )
    }, 0)
    const prCount = personalRecords.length
    const customTemplateCount = Math.max(0, templates.length - DEFAULT_TEMPLATE_COUNT)

    // Muscle groups trained this week
    const today = new Date()
    const weekStart = startOfWeek(today)
    const weekDays = eachDayOfInterval({ start: weekStart, end: today })
    const weekDates = new Set(weekDays.map((d) => format(d, "yyyy-MM-dd")))

    const muscleGroupsThisWeek = new Set<MuscleGroup>()
    workouts
      .filter((w) => weekDates.has(w.date))
      .forEach((workout) => {
        workout.exercises.forEach((ex) => {
          const exercise = exercisesById.get(ex.exerciseId)
          if (exercise && ex.sets.some((s) => s.isCompleted)) {
            muscleGroupsThisWeek.add(exercise.muscleGroup)
          }
        })
      })

    const data = await db.achievements.get("achievements")
    const streaks = data?.streaks || defaultStreaks

    // Workout count achievements
    await this.tryUnlock("first-workout", totalWorkouts >= 1)
    await this.tryUnlock("ten-workouts", totalWorkouts >= 10)
    await this.tryUnlock("fifty-workouts", totalWorkouts >= 50)
    await this.tryUnlock("century-club", totalWorkouts >= 100)

    // Streak achievements
    await this.tryUnlock("week-warrior", streaks.currentWorkoutStreak >= 7)
    await this.tryUnlock("month-master", streaks.currentWorkoutStreak >= 30)

    // Volume achievements
    await this.tryUnlock("10k-club", totalVolume >= 10000)
    await this.tryUnlock("100k-crusher", totalVolume >= 100000)
    await this.tryUnlock("500k-beast", totalVolume >= 500000)
    await this.tryUnlock("million-pounder", totalVolume >= 1000000)

    // PR achievements
    await this.tryUnlock("first-pr", prCount >= 1)
    await this.tryUnlock("pr-collector", prCount >= 10)
    await this.tryUnlock("pr-master", prCount >= 25)

    // Template achievements
    await this.tryUnlock("template-creator", customTemplateCount >= 3)

    // Variety achievements
    await this.tryUnlock("full-body", muscleGroupsThisWeek.size >= 6)
  },

  async checkNutritionAchievements() {
    const dailyLogs = await db.nutritionLogs.toArray()
    const daysLogged = dailyLogs.filter((day) => day.entries.length > 0).length
    const data = await db.achievements.get("achievements")
    const streaks = data?.streaks || defaultStreaks
    
    // Days logged achievements
    await this.tryUnlock("macro-tracker", daysLogged >= 7)

    // Nutrition streak
    await this.tryUnlock("nutrition-streak", streaks.currentNutritionStreak >= 30)
  },

  async updateStreaks() {
    const workouts = await db.workoutSessions.toArray()
    const logs = await db.nutritionLogs.toArray()

    const workoutDates = [...new Set(workouts.map((w) => w.date))]
    const nutritionDates = logs.filter((day) => day.entries.length > 0).map((day) => day.date)

    await this.recalculateStreaks(workoutDates, nutritionDates)
  },

  async recalculateStreaks(workoutDates: string[], nutritionDates: string[]) {
    const data = await db.achievements.get("achievements")
    const currentStreaks = data?.streaks || defaultStreaks
    const unlockedAchievements = data?.unlockedAchievements || []
    
    // Sort dates descending (most recent first)
    const sortedWorkoutDates = [...workoutDates].sort().reverse()
    const sortedNutritionDates = [...nutritionDates].sort().reverse()

    // Calculate workout streak
    let workoutStreak = 0
    let longestWorkoutStreak = currentStreaks.longestWorkoutStreak
    if (sortedWorkoutDates.length > 0) {
      let tempStreak = 0

      for (let i = 0; i <= 365; i++) {
        const checkDate = format(subDays(new Date(), i), "yyyy-MM-dd")
        if (sortedWorkoutDates.includes(checkDate)) {
          tempStreak++
        } else if (tempStreak > 0) {
          break
        }
      }
      workoutStreak = tempStreak
      longestWorkoutStreak = Math.max(tempStreak, longestWorkoutStreak)
    }

    // Calculate nutrition streak
    let nutritionStreak = 0
    let longestNutritionStreak = currentStreaks.longestNutritionStreak
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
      longestNutritionStreak = Math.max(tempStreak, longestNutritionStreak)
    }

    const newStreaks = {
      currentWorkoutStreak: workoutStreak,
      longestWorkoutStreak: longestWorkoutStreak,
      lastWorkoutDate: sortedWorkoutDates[0] || null,
      currentNutritionStreak: nutritionStreak,
      longestNutritionStreak: longestNutritionStreak,
      lastNutritionDate: sortedNutritionDates[0] || null,
    }

    try {
      await db.achievements.put({
        id: "achievements",
        unlockedAchievements,
        streaks: newStreaks,
      })
      
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
    } catch (error) {
      console.error("Failed to save recalculated streaks:", error)
    }
  },

  async updateWorkoutStreak(workoutDate: string) {
    const data = await db.achievements.get("achievements")
    const streaks = data?.streaks || defaultStreaks
    const unlockedAchievements = data?.unlockedAchievements || []
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
      unlockedAchievements,
      streaks: newStreaks,
    })
    
    queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
  },

  async updateNutritionStreak(nutritionDate: string) {
    const data = await db.achievements.get("achievements")
    const streaks = data?.streaks || defaultStreaks
    const unlockedAchievements = data?.unlockedAchievements || []
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
      unlockedAchievements,
      streaks: newStreaks,
    })
    
    queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
  },

  async tryUnlock(id: string, condition: boolean) {
    if (!condition) return
    
    await db.transaction("rw", db.achievements, async () => {
      const currentData = await db.achievements.get("achievements")
      const unlocked = currentData?.unlockedAchievements || []
      
      const existing = unlocked.find((a) => a.id === id)
      if (existing) return

      const achievement = achievements.find((a) => a.id === id)
      if (!achievement) return

      const newAchievement: UnlockedAchievement = {
        id,
        unlockedAt: new Date().toISOString(),
      }

      const newUnlocked = [...unlocked, newAchievement]
      
      await db.achievements.put({
        id: "achievements",
        unlockedAchievements: newUnlocked,
        streaks: currentData?.streaks || defaultStreaks,
      })

      // Show toast notification
      toast.success(`Achievement Unlocked: ${achievement.name}`, {
        description: achievement.description,
        duration: 5000,
      })

      queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
    })
  }
}
