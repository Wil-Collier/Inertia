import type {
  ActiveWorkoutSession,
  TemplateExercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
} from "@/lib/types"

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

export function createExerciseWithSetMix(options?: {
  exerciseId?: string
  completedCount?: number
  pendingCount?: number
}): WorkoutExercise {
  const completedCount = options?.completedCount ?? 1
  const pendingCount = options?.pendingCount ?? 1

  return createWorkoutExercise({
    exerciseId: options?.exerciseId,
    sets: [
      ...Array.from({ length: completedCount }, () => createWorkoutSet({ isCompleted: true })),
      ...Array.from({ length: pendingCount }, () => createWorkoutSet({ isCompleted: false })),
    ],
  })
}

export function createWorkout(overrides: Partial<Workout> = {}): Workout {
  const exercises = overrides.exercises ?? [createWorkoutExercise()]

  return {
    id: overrides.id ?? nextId("workout"),
    name: overrides.name ?? "Push Day",
    date: overrides.date ?? "2026-02-07",
    exercises,
    exerciseIds: overrides.exerciseIds ?? exercises.map((exercise) => exercise.exerciseId),
    duration: overrides.duration,
    completedAt: overrides.completedAt,
    weightUnit: overrides.weightUnit ?? "lbs",
    updatedAt: overrides.updatedAt,
  }
}

export function createWorkoutTemplateExercise(
  overrides: Partial<TemplateExercise> = {}
): TemplateExercise {
  return {
    exerciseId: overrides.exerciseId ?? "barbell-bench-press",
    targetSets: overrides.targetSets ?? 3,
    targetReps: overrides.targetReps ?? 8,
    targetWeight: overrides.targetWeight ?? 135,
  }
}

export function createWorkoutTemplate(overrides: Partial<WorkoutTemplate> = {}): WorkoutTemplate {
  return {
    id: overrides.id ?? nextId("template"),
    name: overrides.name ?? "Upper Body",
    exercises: overrides.exercises ?? [createWorkoutTemplateExercise()],
    updatedAt: overrides.updatedAt,
  }
}

export function createActiveWorkoutSession(
  overrides: Partial<ActiveWorkoutSession> = {}
): ActiveWorkoutSession {
  return {
    workout: overrides.workout ?? createWorkout(),
    startedAt: overrides.startedAt ?? "2026-02-09T10:00:00.000Z",
    templateId: overrides.templateId,
  }
}

export function resetWorkoutFactory(): void {
  counter = 0
}
