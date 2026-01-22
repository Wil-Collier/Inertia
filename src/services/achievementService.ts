import { db } from "@/services/db"
import { format, startOfWeek, eachDayOfInterval, subDays, differenceInCalendarDays, parseISO, isSameDay } from "date-fns"
import type { MuscleGroup, UnlockedAchievement, StreakData, Exercise } from "@/lib/types"
import { achievements } from "@/data/achievements"
import { toast } from "sonner"
import { statsService } from "@/services/statsService"

/**
 * Number of default workout templates provided by the app.
 * Used to calculate how many custom templates the user has created
 * (total templates - default templates = custom templates).
 */
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
    await db.transaction("rw", [db.achievements, db.workoutSessions, db.workoutTemplates, db.personalRecords, db.customExercises, db.nutritionLogs, db.settings], async () => {
      await this.ensureInitialized()

      await this.checkWorkoutAchievements()
      await this.checkNutritionAchievements()
      await this.updateStreaks()
    })
  },

  /**
   * Ensures the achievements record exists in the database.
   * Creates default record if not present.
   */
  async ensureInitialized() {
    const existing = await db.achievements.get("achievements")
    if (!existing) {
      await db.achievements.put({
        id: "achievements",
        unlockedAchievements: [],
        streaks: defaultStreaks
      })
    }
  },

  /**
   * Checks all workout-related achievements (count, volume, PRs, templates, muscle variety).
   * Uses cached stats for O(1) volume lookups.
   */
  async checkWorkoutAchievements() {
    await this.ensureInitialized()
    const workoutsCount = await db.workoutSessions.count()
    const personalRecordsCount = await db.personalRecords.count()
    const templatesCount = await db.workoutTemplates.count()
    const customTemplateCount = Math.max(0, templatesCount - DEFAULT_TEMPLATE_COUNT)

    // Use cached stats for volume (O(1) instead of O(N))
    const stats = await statsService.getStats()
    const totalVolumeLbs = stats.totalVolumeLbs

    // Only load workouts from this week for muscle group calculation
    const today = new Date()
    const weekStart = startOfWeek(today)
    const weekDates = eachDayOfInterval({ start: weekStart, end: today })
    const weekDateStrings = weekDates.map((d) => format(d, "yyyy-MM-dd"))

    // Query only this week's workouts instead of all workouts
    const thisWeeksWorkouts = await db.workoutSessions
      .where("date")
      .anyOf(weekDateStrings)
      .toArray()

    // Get all exercises (defaults from static bundle + custom from IDB)
    // Use dynamic import to keep exercise database code-split
    const { getDefaultExercises } = await import("@/data/exerciseDatabase")
    const defaultExercises = getDefaultExercises()
    const customExercises = await db.customExercises.toArray()
    const allExercises: Exercise[] = [...defaultExercises, ...customExercises]
    const exercisesById = new Map(allExercises.map(e => [e.id, e]))

    const muscleGroupsThisWeek = new Set<MuscleGroup>()
    thisWeeksWorkouts.forEach((workout) => {
      workout.exercises.forEach((ex) => {
        const exercise = exercisesById.get(ex.exerciseId)
        if (exercise && ex.sets.some((s) => s.isCompleted)) {
          muscleGroupsThisWeek.add(exercise.muscleGroup)
        }
      })
    })

    const data = await db.achievements.get("achievements")
    const streaks = data?.streaks || defaultStreaks

    // Batch all achievement checks into a single transaction
    await this.tryUnlockBatch([
      // Workout count achievements
      ["first-workout", workoutsCount >= 1],
      ["ten-workouts", workoutsCount >= 10],
      ["fifty-workouts", workoutsCount >= 50],
      ["century-club", workoutsCount >= 100],
      // Streak achievements
      ["week-warrior", streaks.currentWorkoutStreak >= 7],
      ["month-master", streaks.currentWorkoutStreak >= 30],
      // Volume achievements (thresholds in lbs)
      ["10k-club", totalVolumeLbs >= 10000],
      ["100k-crusher", totalVolumeLbs >= 100000],
      ["500k-beast", totalVolumeLbs >= 500000],
      ["million-pounder", totalVolumeLbs >= 1000000],
      // PR achievements
      ["first-pr", personalRecordsCount >= 1],
      ["pr-collector", personalRecordsCount >= 10],
      ["pr-master", personalRecordsCount >= 25],
      // Template achievements
      ["template-creator", customTemplateCount >= 3],
      // Variety achievements
      ["full-body", muscleGroupsThisWeek.size >= 6],
    ])
  },

  /**
   * Lightweight check for template-related achievements only.
   * Use this instead of checkWorkoutAchievements when only templates have changed.
   */
  async checkTemplateAchievements() {
    await this.ensureInitialized()
    const templatesCount = await db.workoutTemplates.count()
    const customTemplateCount = Math.max(0, templatesCount - DEFAULT_TEMPLATE_COUNT)

    await this.tryUnlock("template-creator", customTemplateCount >= 3)
  },

  /**
   * Checks all nutrition-related achievements (days logged, streak).
   */
  async checkNutritionAchievements() {
    await this.ensureInitialized()
    const dailyLogs = await db.nutritionLogs.toArray()
    const daysLogged = dailyLogs.filter((day) => day.entries.length > 0).length
    const data = await db.achievements.get("achievements")
    const streaks = data?.streaks || defaultStreaks

    // Days logged achievements
    await this.tryUnlock("macro-tracker", daysLogged >= 7)

    // Nutrition streak
    await this.tryUnlock("nutrition-streak", streaks.currentNutritionStreak >= 30)
  },

  /**
   * Updates both workout and nutrition streaks.
   */
  async updateStreaks() {
    const workoutDates = await db.workoutSessions.orderBy("date").uniqueKeys() as string[]
    const logs = await db.nutritionLogs.toArray()
    const nutritionDates = logs.filter((day) => day.entries.length > 0).map((day) => day.date)

    await this.recalculateStreaks(workoutDates, nutritionDates)
  },

  /**
   * Recalculates all streaks from the full history of workout and nutrition dates.
   * @param workoutDates - Array of workout date strings (yyyy-MM-dd)
   * @param nutritionDates - Array of nutrition log date strings (yyyy-MM-dd)
   */
  async recalculateStreaks(workoutDates: string[], nutritionDates: string[]) {
    const data = await db.achievements.get("achievements")
    const currentStreaks = data?.streaks || defaultStreaks
    const unlockedAchievements = data?.unlockedAchievements || []

    /**
     * Calculate current streak by iterating backwards from today through sorted dates.
     * No artificial limit - works for streaks of any length.
     */
    const calculateStreak = (dates: string[]): number => {
      if (dates.length === 0) return 0

      // Sort dates descending (newest first)
      const sortedDates = [...dates].sort().reverse()
      const today = new Date()
      let streak = 0
      let currentDate = today

      for (const dateStr of sortedDates) {
        const date = parseISO(dateStr)

        // If this date matches current day we're checking, increment streak
        if (isSameDay(date, currentDate)) {
          streak++
          currentDate = subDays(currentDate, 1)
        } else if (date < currentDate) {
          // If we haven't started counting yet (streak is 0) and
          // date is yesterday, start the streak
          if (streak === 0 && isSameDay(date, subDays(today, 1))) {
            streak++
            currentDate = subDays(date, 1)
          } else {
            // Gap in streak - stop counting
            break
          }
        }
        // If date is in the future or same as today when we've already counted today, skip
      }

      return streak
    }

    const workoutStreak = calculateStreak(workoutDates)
    const nutritionStreak = calculateStreak(nutritionDates)

    const longestWorkoutStreak = Math.max(workoutStreak, currentStreaks.longestWorkoutStreak)
    const longestNutritionStreak = Math.max(nutritionStreak, currentStreaks.longestNutritionStreak)

    const sortedWorkoutDates = [...workoutDates].sort().reverse()
    const sortedNutritionDates = [...nutritionDates].sort().reverse()

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
    } catch (error) {
      console.error("Failed to save recalculated streaks:", error)
    }
  },

  /**
   * Incrementally updates workout streak for a new workout.
   * @param workoutDate - Date of the new workout (yyyy-MM-dd)
   */
  async updateWorkoutStreak(workoutDate: string) {
    try {
      const data = await db.achievements.get("achievements")
      const streaks = data?.streaks || defaultStreaks
      const unlockedAchievements = data?.unlockedAchievements || []
      const { lastWorkoutDate, currentWorkoutStreak, longestWorkoutStreak } = streaks

      const today = new Date()
      const yesterday = subDays(today, 1)
      const workoutDateParsed = parseISO(workoutDate)
      const lastWorkoutParsed = lastWorkoutDate ? parseISO(lastWorkoutDate) : null

      let newStreak = currentWorkoutStreak

      if (!lastWorkoutParsed) {
        newStreak = 1
      } else if (isSameDay(workoutDateParsed, lastWorkoutParsed)) {
        newStreak = currentWorkoutStreak
      } else if (isSameDay(lastWorkoutParsed, yesterday) || isSameDay(lastWorkoutParsed, today)) {
        if (isSameDay(workoutDateParsed, today) && !isSameDay(lastWorkoutParsed, today)) {
          newStreak = currentWorkoutStreak + 1
        }
      } else {
        const daysSinceLastWorkout = differenceInCalendarDays(today, lastWorkoutParsed)
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
    } catch (error) {
      console.error("Failed to update workout streak:", error)
    }
  },

  /**
   * Incrementally updates nutrition streak for a new log entry.
   * @param nutritionDate - Date of the nutrition log (yyyy-MM-dd)
   */
  async updateNutritionStreak(nutritionDate: string) {
    try {
      const data = await db.achievements.get("achievements")
      const streaks = data?.streaks || defaultStreaks
      const unlockedAchievements = data?.unlockedAchievements || []
      const {
        lastNutritionDate,
        currentNutritionStreak,
        longestNutritionStreak,
      } = streaks

      const today = new Date()
      const yesterday = subDays(today, 1)
      const nutritionDateParsed = parseISO(nutritionDate)
      const lastNutritionParsed = lastNutritionDate ? parseISO(lastNutritionDate) : null

      let newStreak = currentNutritionStreak

      if (!lastNutritionParsed) {
        newStreak = 1
      } else if (isSameDay(nutritionDateParsed, lastNutritionParsed)) {
        newStreak = currentNutritionStreak
      } else if (isSameDay(lastNutritionParsed, yesterday) || isSameDay(lastNutritionParsed, today)) {
        if (isSameDay(nutritionDateParsed, today) && !isSameDay(lastNutritionParsed, today)) {
          newStreak = currentNutritionStreak + 1
        }
      } else {
        const daysSinceLastLog = differenceInCalendarDays(today, lastNutritionParsed)
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
    } catch (error) {
      console.error("Failed to update nutrition streak:", error)
    }
  },

  /**
   * Attempts to unlock an achievement if the condition is met.
   * Shows a toast notification when newly unlocked.
   * @param id - Achievement ID
   * @param condition - Whether the unlock condition is met
   */
  async tryUnlock(id: string, condition: boolean) {
    if (!condition) return

    // Use transaction to avoid race conditions with other unlocks or streak updates
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
    })
  },

  /**
   * Batch unlock multiple achievements in a single transaction.
   * More efficient than calling tryUnlock multiple times.
   * @param checks - Array of [achievementId, condition] pairs
   */
  async tryUnlockBatch(checks: [string, boolean][]) {
    // Filter to only achievements that should be unlocked
    const toUnlock = checks.filter(([, condition]) => condition).map(([id]) => id)
    if (toUnlock.length === 0) return

    await db.transaction("rw", db.achievements, async () => {
      const currentData = await db.achievements.get("achievements")
      const unlocked = currentData?.unlockedAchievements || []
      const unlockedIds = new Set(unlocked.map(a => a.id))

      const newlyUnlocked: UnlockedAchievement[] = []

      for (const id of toUnlock) {
        if (unlockedIds.has(id)) continue

        const achievement = achievements.find((a) => a.id === id)
        if (!achievement) continue

        newlyUnlocked.push({
          id,
          unlockedAt: new Date().toISOString(),
        })
      }

      if (newlyUnlocked.length === 0) return

      await db.achievements.put({
        id: "achievements",
        unlockedAchievements: [...unlocked, ...newlyUnlocked],
        streaks: currentData?.streaks || defaultStreaks,
      })

      // Show toast notifications for each new achievement
      for (const newAchievement of newlyUnlocked) {
        const achievement = achievements.find((a) => a.id === newAchievement.id)
        if (achievement) {
          toast.success(`Achievement Unlocked: ${achievement.name}`, {
            description: achievement.description,
            duration: 5000,
          })
        }
      }
    })
  }
}
