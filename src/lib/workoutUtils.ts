/**
 * Brzycki formula for estimated 1RM
 */
export function calculateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight
  if (reps === 0) return 0
  if (reps > 12) return weight * (1 + reps / 30) // simplified for high reps
  return weight * (36 / (37 - reps))
}
