import { useEffect, useMemo } from "react"
import { format, startOfWeek, eachDayOfInterval } from "date-fns"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useNutritionStore } from "@/stores/nutritionStore"
import { useAchievementsStore } from "@/stores/achievementsStore"
import { useExerciseStore } from "@/stores/exerciseStore"
import type { MuscleGroup } from "@/lib/types"

// Default templates that ship with the app (don't count toward achievement)
const DEFAULT_TEMPLATE_COUNT = 5

/**
 * Hook to check and update achievements based on current app state.
 * Should be called once at the app level (e.g., in App.tsx or Layout).
 */
export function useAchievementChecker() {
  const { workouts, personalRecords, templates } = useWorkoutStore()
  const { dailyLogs } = useNutritionStore()
  const { getExercise } = useExerciseStore()
  const {
    checkWorkoutAchievements,
    checkNutritionAchievements,
    recalculateStreaks,
  } = useAchievementsStore()

  // Calculate workout stats
  const workoutStats = useMemo(() => {
    const totalWorkouts = workouts.length
    const totalVolume = workouts.reduce((total, workout) => {
      return (
        total +
        workout.exercises.reduce((exTotal, ex) => {
          return (
            exTotal +
            ex.sets
              .filter((s) => s.completed)
              .reduce((setTotal, set) => {
                return setTotal + set.weight * set.reps
              }, 0)
          )
        }, 0)
      )
    }, 0)
    const prCount = Object.keys(personalRecords).length

    // Count custom templates (exclude default ones)
    const customTemplateCount = Math.max(0, templates.length - DEFAULT_TEMPLATE_COUNT)

    // Get muscle groups trained this week
    const today = new Date()
    const weekStart = startOfWeek(today)
    const weekDays = eachDayOfInterval({ start: weekStart, end: today })
    const weekDates = new Set(weekDays.map((d) => format(d, "yyyy-MM-dd")))

    const muscleGroupsThisWeek = new Set<MuscleGroup>()
    workouts
      .filter((w) => weekDates.has(w.date))
      .forEach((workout) => {
        workout.exercises.forEach((ex) => {
          const exercise = getExercise(ex.exerciseId)
          if (exercise && ex.sets.some((s) => s.completed)) {
            muscleGroupsThisWeek.add(exercise.muscleGroup)
          }
        })
      })

    return {
      totalWorkouts,
      totalVolume,
      prCount,
      templateCount: customTemplateCount,
      muscleGroupsThisWeek,
    }
  }, [workouts, personalRecords, templates, getExercise])

  // Calculate nutrition stats
  const nutritionStats = useMemo(() => {
    const daysLogged = dailyLogs.filter((day) => day.entries.length > 0).length
    return { daysLogged }
  }, [dailyLogs])

  // Get workout and nutrition dates for streak calculation
  const workoutDates = useMemo(() => {
    return [...new Set(workouts.map((w) => w.date))]
  }, [workouts])

  const nutritionDates = useMemo(() => {
    return dailyLogs
      .filter((day) => day.entries.length > 0)
      .map((day) => day.date)
  }, [dailyLogs])

  // Recalculate streaks on mount and when data changes
  useEffect(() => {
    recalculateStreaks(workoutDates, nutritionDates)
  }, [workoutDates, nutritionDates, recalculateStreaks])

  // Check workout achievements when stats change
  useEffect(() => {
    if (workoutStats.totalWorkouts > 0) {
      checkWorkoutAchievements(workoutStats)
    }
  }, [workoutStats, checkWorkoutAchievements])

  // Check nutrition achievements when stats change
  useEffect(() => {
    if (nutritionStats.daysLogged > 0) {
      checkNutritionAchievements(nutritionStats)
    }
  }, [nutritionStats, checkNutritionAchievements])

  // Return stats for components that might need them
  return {
    workoutStats,
    nutritionStats,
    workoutDates,
    nutritionDates,
  }
}

/**
 * Call this when a workout is completed to update the streak.
 * Can be called from the finishWorkout flow.
 */
export function useWorkoutCompletionHandler() {
  const { updateWorkoutStreak } = useAchievementsStore()

  const onWorkoutCompleted = (date: string) => {
    updateWorkoutStreak(date)
  }

  return { onWorkoutCompleted }
}

/**
 * Call this when food is logged to update the nutrition streak.
 */
export function useNutritionLogHandler() {
  const { updateNutritionStreak } = useAchievementsStore()

  const onFoodLogged = (date: string) => {
    updateNutritionStreak(date)
  }

  return { onFoodLogged }
}
