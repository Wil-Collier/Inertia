import { db } from "@/services/db"
import type { LastPerformance } from "@/lib/types"

/**
 * Get the last performance for an exercise (for progressive overload)
 */
export async function getLastPerformance(exerciseId: string): Promise<LastPerformance | null> {
  // Optimize: Search by date (newest first) and filter by exerciseId
  // This is often faster than fetching all history for an exercise if the user
  // works out regularly, as it avoids loading the entire history of a specific exercise.
  const sessions = await db.workoutSessions
    .orderBy("date")
    // oxlint-disable-next-line eslint-plugin-unicorn(no-array-reverse)
    .reverse()
    .filter((w) => w.exerciseIds?.includes(exerciseId) ?? false)
    .limit(10) // Look at the last 10 workouts containing this exercise
    .toArray()

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
