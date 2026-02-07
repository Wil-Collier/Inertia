import type { Workout, WorkoutExercise, WorkoutSet } from "@/lib/types"

let counter = 0

function nextId(prefix: string): string {
  counter += 1
  return `${prefix}-${counter}`
}

export function createWorkoutSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: overrides.id ?? nextId("set"),
    reps: overrides.reps ?? 10,
    weight: overrides.weight ?? 100,
    isCompleted: overrides.isCompleted ?? true,
  }
}

export function createWorkoutExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return {
    id: overrides.id ?? nextId("wex"),
    exerciseId: overrides.exerciseId ?? "barbell-bench-press",
    sets: overrides.sets ?? [createWorkoutSet()],
    notes: overrides.notes,
    lastPerformanceDate: overrides.lastPerformanceDate,
  }
}

export function createWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: overrides.id ?? nextId("workout"),
    name: overrides.name ?? "Push Day",
    date: overrides.date ?? "2026-02-07",
    exercises: overrides.exercises ?? [createWorkoutExercise()],
    exerciseIds: overrides.exerciseIds,
    duration: overrides.duration,
    completedAt: overrides.completedAt,
    weightUnit: overrides.weightUnit ?? "lbs",
    updatedAt: overrides.updatedAt,
  }
}

export function resetWorkoutFactory(): void {
  counter = 0
}
