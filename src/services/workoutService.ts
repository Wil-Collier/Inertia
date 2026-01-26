import { db } from "@/services/db"
import type { LastPerformance } from "@/lib/types"

/**
 * Get the last performance for an exercise (for progressive overload)
 */
export async function getLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  // Optimize: Use the multi-entry index on exerciseIds to find relevant workouts immediately
  // instead of scanning the date index and filtering.
  // Then sort in memory (usually much smaller dataset).
  const sessions = await db.workoutSessions
    .where("exerciseIds")
    .equals(exerciseId)
    .toArray()

  // Sort by date descending (newest first)
  sessions.sort((a, b) => b.date.localeCompare(a.date))

  // Limit to recent history to avoid processing too much if they've done this exercise 1000 times
  // (though we already fetched them all, sorting 1000 items is fast)
  const recentSessions = sessions.slice(0, 10)

  for (const workout of recentSessions) {
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
