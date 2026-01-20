export interface WorkoutSet {
  id: string
  reps: number
  weight: number
  isCompleted: boolean
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  sets: WorkoutSet[]
  notes?: string
  lastPerformanceDate?: string
}

export interface LastPerformance {
  sets: { weight: number; reps: number }[]
  date: string
  workoutId: string
}

export interface Workout {
  id: string
  date: string
  name: string
  exercises: WorkoutExercise[]
  exerciseIds?: string[]
  duration?: number
  completedAt?: string
  /** The unit weights were recorded in (kg or lbs) */
  weightUnit: "kg" | "lbs"
}

export interface TemplateExercise {
  exerciseId: string
  targetSets: number
  targetReps?: number
  targetWeight?: number
}

export interface WorkoutTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
}

export interface PersonalRecord {
  exerciseId: string
  weight: number
  reps: number
  date: string
  workoutId: string
}

export interface ActiveWorkoutSession {
  workout: Workout
  startedAt: string
  templateId?: string
}
