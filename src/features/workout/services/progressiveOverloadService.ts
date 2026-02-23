import { convertWeight } from "@/lib/conversions"
import type { WeightUnit, Workout, WorkoutSet } from "@/lib/types"
import { db } from "@/services/db"

const WEIGHT_COMPARISON_EPSILON = 0.0001

function getWeightIncrement(unit: WeightUnit): number {
  return unit === "lbs" ? 5 : 2.5
}

function roundWeightToStep(weight: number, unit: WeightUnit): number {
  const step = getWeightIncrement(unit)
  const rounded = Math.round(weight / step) * step
  return parseFloat(rounded.toFixed(2))
}

function getCompletedSets(workout: Workout, exerciseId: string): WorkoutSet[] {
  const workoutExercise = workout.exercises.find((exercise) => exercise.exerciseId === exerciseId)
  if (!workoutExercise) return []

  return workoutExercise.sets.filter((set) => set.isCompleted)
}

function getWorkoutChronologicalValue(workout: Workout): number {
  if (workout.completedAt) {
    const completedAtMs = Date.parse(workout.completedAt)
    if (Number.isFinite(completedAtMs)) return completedAtMs
  }

  const dateMs = Date.parse(workout.date)
  if (Number.isFinite(dateMs)) return dateMs
  return 0
}

function sortWorkoutsChronologically(workouts: Workout[]): Workout[] {
  return workouts.toSorted((left, right) => {
    const byTime = getWorkoutChronologicalValue(left) - getWorkoutChronologicalValue(right)
    if (byTime !== 0) return byTime
    return left.id.localeCompare(right.id)
  })
}

async function getWorkoutsByExercise(exerciseId: string): Promise<Workout[]> {
  const indexedWorkouts = await db.workoutSessions.where("exerciseIds").equals(exerciseId).sortBy("date")
  if (indexedWorkouts.length > 0) return sortWorkoutsChronologically(indexedWorkouts)

  // Fallback for older records that may not have exerciseIds populated.
  const workouts = await db.workoutSessions.toArray()
  return sortWorkoutsChronologically(
    workouts.filter((workout) => workout.exercises.some((exercise) => exercise.exerciseId === exerciseId))
  )
}

async function getLatestCompletedExerciseSets(
  exerciseId: string
): Promise<{ workout: Workout; completedSets: WorkoutSet[] } | null> {
  const workouts = await getWorkoutsByExercise(exerciseId)

  for (let index = workouts.length - 1; index >= 0; index -= 1) {
    const workout = workouts[index]
    if (!workout) continue

    const completedSets = getCompletedSets(workout, exerciseId).filter(
      (set) => set.weight > 0 && set.reps > 0
    )

    if (completedSets.length > 0) {
      return { workout, completedSets }
    }
  }

  return null
}

export async function getLastUsedWeightForExercise(args: {
  exerciseId: string
  targetWeightUnit: WeightUnit
}): Promise<number> {
  const latestCompletedSets = await getLatestCompletedExerciseSets(args.exerciseId)
  if (!latestCompletedSets) return 0

  const heaviestCompletedSet = Math.max(...latestCompletedSets.completedSets.map((set) => set.weight))
  const converted = convertWeight(
    heaviestCompletedSet,
    latestCompletedSets.workout.weightUnit,
    args.targetWeightUnit
  )

  return roundWeightToStep(converted, args.targetWeightUnit)
}

export async function getTemplateExerciseRecommendedWeight(args: {
  exerciseId: string
  targetSets: number
  targetReps?: number
  targetWeightUnit: WeightUnit
}): Promise<number> {
  const latestCompletedSets = await getLatestCompletedExerciseSets(args.exerciseId)
  if (!latestCompletedSets) return 0

  const heaviestCompletedSet = Math.max(...latestCompletedSets.completedSets.map((set) => set.weight))
  const lastUsedWeight = roundWeightToStep(
    convertWeight(
      heaviestCompletedSet,
      latestCompletedSets.workout.weightUnit,
      args.targetWeightUnit
    ),
    args.targetWeightUnit
  )

  const requiredSetCount = Math.max(1, args.targetSets || 0)
  const requiredReps = args.targetReps ?? 0
  const firstRequiredSets = latestCompletedSets.completedSets.slice(0, requiredSetCount)

  if (firstRequiredSets.length < requiredSetCount) {
    return lastUsedWeight
  }

  const firstWeight = firstRequiredSets[0]?.weight ?? 0
  const hasStraightSetLoading = firstRequiredSets.every(
    (set) => Math.abs(set.weight - firstWeight) < WEIGHT_COMPARISON_EPSILON
  )
  const hitRepTarget = firstRequiredSets.every((set) => set.reps >= requiredReps)

  if (!hasStraightSetLoading || !hitRepTarget) {
    return lastUsedWeight
  }

  return roundWeightToStep(lastUsedWeight + getWeightIncrement(args.targetWeightUnit), args.targetWeightUnit)
}
