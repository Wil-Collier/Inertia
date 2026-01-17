import type { WorkoutSliceCreator, HistorySlice, ExerciseHistoryEntry } from "./types"
import { db } from "@/services/db"

import { toast } from "sonner"

export const createHistorySlice: WorkoutSliceCreator<HistorySlice> = (set, get) => ({
  getWorkoutDates: () => {
    const dates = new Set(get().workouts.map((w) => w.date))
    return Array.from(dates).sort().reverse()
  },

  deleteWorkout: async (id) => {
    try {
      await db.workoutSessions.delete(id)
      set((state) => ({
        workouts: state.workouts.filter((w) => w.id !== id),
      }))
    } catch (error) {
      console.error("Failed to delete workout:", error)
      toast.error("Failed to delete workout history")
      throw error
    }
  },

  getPersonalRecord: (exerciseId) => {
    return get().personalRecords[exerciseId]
  },

  // Brzycki formula for estimated 1RM
  calculateOneRepMax: (weight, reps) => {
    if (reps === 1) return weight
    if (reps > 12) return weight * (1 + reps / 30) // simplified for high reps
    return weight * (36 / (37 - reps))
  },

  // Get the last performance for an exercise (for progressive overload)
  getLastPerformance: (exerciseId) => {
    const workouts = get().workouts
    // Sort by date descending (newest first)
    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    for (const workout of sortedWorkouts) {
      const workoutExercise = workout.exercises.find(
        (e) => e.exerciseId === exerciseId
      )
      if (workoutExercise) {
        // Get completed sets with meaningful data
        const completedSets = workoutExercise.sets
          .filter((s) => s.completed)
          .map((s) => ({ weight: s.weight, reps: s.reps }))

        // If no completed sets, use all sets that have data
        const setsWithData =
          completedSets.length > 0
            ? completedSets
            : workoutExercise.sets
                .filter((s) => s.weight > 0 || s.reps > 0)
                .map((s) => ({ weight: s.weight, reps: s.reps }))

        if (setsWithData.length > 0) {
          return {
            sets: setsWithData,
            date: workout.date,
            workoutId: workout.id,
          }
        }
      }
    }
    return null
  },

  // Get full exercise history for progress charts
  getExerciseHistory: (exerciseId): ExerciseHistoryEntry[] => {
    const workouts = get().workouts
    const history: ExerciseHistoryEntry[] = []

    // Sort by date ascending (oldest first) for chronological chart
    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    for (const workout of sortedWorkouts) {
      const workoutExercise = workout.exercises.find(
        (e) => e.exerciseId === exerciseId
      )
      if (workoutExercise) {
        const completedSets = workoutExercise.sets
          .filter((s) => s.completed && (s.weight > 0 || s.reps > 0))
          .map((s) => ({ weight: s.weight, reps: s.reps }))

        if (completedSets.length > 0) {
          const maxWeight = Math.max(...completedSets.map((s) => s.weight))
          const totalVolume = completedSets.reduce(
            (sum, s) => sum + s.weight * s.reps,
            0
          )
          const totalReps = completedSets.reduce(
            (sum, s) => sum + s.reps,
            0
          )

          history.push({
            date: workout.date,
            workoutId: workout.id,
            maxWeight,
            totalVolume,
            totalReps,
            sets: completedSets,
          })
        }
      }
    }

    return history
  },
})
