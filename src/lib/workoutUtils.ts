import type { Workout, WorkoutExercise, WorkoutSet } from "@/lib/types"

/**
 * Brzycki formula for estimated 1RM
 */
export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps === 0) return 0
  if (reps > 12) return weight * (1 + reps / 30) // simplified for high reps
  return weight * (36 / (37 - reps))
}

/**
 * Returns only completed sets from a list
 */
export function getCompletedSets(sets: WorkoutSet[]): WorkoutSet[] {
  return sets.filter(s => s.isCompleted)
}

/**
 * Sums volume for sets (assumes sets are already filtered)
 */
export function sumSetVolume(sets: WorkoutSet[]): number {
  return sets.reduce((acc, set) => acc + (set.weight * set.reps), 0)
}

/**
 * Calculates total volume for completed sets only
 */
export function calculateSetVolume(sets: WorkoutSet[]): number {
  return sumSetVolume(getCompletedSets(sets))
}

/**
 * Calculates total volume for a full workout
 */
export function calculateWorkoutVolume(workout: Workout): number {
  return workout.exercises.reduce((total, exercise) => {
    return total + calculateSetVolume(exercise.sets)
  }, 0)
}

/**
 * Calculate total volume for an exercise across multiple sets
 */
export function calculateExerciseVolume(exercise: WorkoutExercise): number {
  return calculateSetVolume(exercise.sets)
}
