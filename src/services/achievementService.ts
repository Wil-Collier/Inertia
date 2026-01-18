import { db } from "@/services/db"
import { useAchievementsStore } from "@/stores/achievementsStore"
import { format, startOfWeek, eachDayOfInterval } from "date-fns"
import type { MuscleGroup } from "@/lib/types"

const DEFAULT_TEMPLATE_COUNT = 5

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
    
    // Simple mock of exerciseStore functionality to avoid hook dependency
    const exercises = await db.exercises.toArray()
    const exerciseMap = new Map(exercises.map(e => [e.id, e]))

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
          const exercise = exerciseMap.get(ex.exerciseId)
          if (exercise && ex.sets.some((s) => s.completed)) {
            muscleGroupsThisWeek.add(exercise.muscleGroup)
          }
        })
      })

    const workoutStats = {
      totalWorkouts,
      totalVolume,
      prCount,
      templateCount: customTemplateCount,
      muscleGroupsThisWeek,
    }

    useAchievementsStore.getState().checkWorkoutAchievements(workoutStats)
  },

  async checkNutritionAchievements() {
    const dailyLogs = await db.nutritionLogs.toArray()
    const daysLogged = dailyLogs.filter((day) => day.entries.length > 0).length
    
    useAchievementsStore.getState().checkNutritionAchievements({ daysLogged })
  },

  async updateStreaks() {
    const workouts = await db.workoutSessions.toArray()
    const logs = await db.nutritionLogs.toArray()

    const workoutDates = [...new Set(workouts.map((w) => w.date))]
    const nutritionDates = logs.filter((day) => day.entries.length > 0).map((day) => day.date)

    useAchievementsStore.getState().recalculateStreaks(workoutDates, nutritionDates)
  }
}
