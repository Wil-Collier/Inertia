import type { ActiveWorkoutSession, Workout, WorkoutExercise } from "@/lib/types"
import { createWorkout, createWorkoutExercise } from "@/test/factories/workoutFactory"

let sessionCounter = 0

function nextSessionId(prefix: string): string {
  sessionCounter += 1
  return `${prefix}-${sessionCounter}`
}

export function createSessionWorkout(overrides: Partial<Workout> = {}): Workout {
  const exercises = overrides.exercises ?? [
    createWorkoutExercise({
      id: nextSessionId("wex"),
      exerciseId: "barbell-bench-press",
    }),
  ]

  return createWorkout({
    id: overrides.id ?? nextSessionId("workout"),
    date: overrides.date ?? "2026-02-09",
    exercises,
    ...overrides,
  })
}

export function createSessionExercise(overrides: Partial<WorkoutExercise> = {}): WorkoutExercise {
  return createWorkoutExercise({
    id: overrides.id ?? nextSessionId("wex"),
    ...overrides,
  })
}

export function createActiveSessionSeed(
  overrides: Partial<ActiveWorkoutSession> = {}
): ActiveWorkoutSession {
  return {
    workout: overrides.workout ?? createSessionWorkout(),
    startedAt: overrides.startedAt ?? "2026-02-09T10:00:00.000Z",
    templateId: overrides.templateId,
  }
}

export function resetSessionFactory(): void {
  sessionCounter = 0
}
