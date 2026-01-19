import { db } from "@/services/db"
import type { LastPerformance } from "@/lib/types"

/**
 * Get the last performance for an exercise (for progressive overload)
 */
export async function getLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  const sessions = await db.workoutSessions
    .where("exerciseIds")
    .equals(exerciseId)
    .sortBy("date")

  // Most recent first
  sessions.reverse()

  for (const workout of sessions) {
    const workoutExercise = workout.exercises.find(
      (e) => e.exerciseId === exerciseId
    )
    if (workoutExercise) {
      // Get completed sets with meaningful data
      const completedSets = workoutExercise.sets
        .filter((s) => s.isCompleted)
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
}
