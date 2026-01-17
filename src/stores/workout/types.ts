import type { StateCreator } from "zustand"
import type {
  Workout,
  WorkoutTemplate,
  WorkoutExercise,
  WorkoutSet,
  ActiveWorkoutSession,
  PersonalRecord,
  LastPerformance,
} from "@/lib/types"

// Re-export types for consumers
export type {
  Workout,
  WorkoutTemplate,
  WorkoutExercise,
  WorkoutSet,
  ActiveWorkoutSession,
  PersonalRecord,
  LastPerformance,
}

// ============================================
// State Types
// ============================================

export interface WorkoutState {
  workouts: Workout[]
  templates: WorkoutTemplate[]
  activeSession: ActiveWorkoutSession | null
  personalRecords: Record<string, PersonalRecord>
}

// ============================================
// Session Slice Types
// ============================================

export interface SessionSlice {
  startWorkout: (name: string, templateId?: string) => void
  cancelWorkout: () => void
  finishWorkout: () => Workout | null
  addExerciseToWorkout: (exerciseId: string) => void
  removeExerciseFromWorkout: (workoutExerciseId: string) => void
  addSet: (workoutExerciseId: string) => void
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    updates: Partial<Omit<WorkoutSet, "id">>
  ) => void
  removeSet: (workoutExerciseId: string, setId: string) => void
  toggleSetComplete: (workoutExerciseId: string, setId: string) => void
  updateExerciseNotes: (workoutExerciseId: string, notes: string) => void
  bumpExerciseWeight: (workoutExerciseId: string, increment: number) => void
}

// ============================================
// Template Slice Types
// ============================================

export interface TemplateSlice {
  createTemplate: (name: string, workout?: Workout) => WorkoutTemplate
  updateTemplate: (id: string, updates: Partial<Omit<WorkoutTemplate, "id">>) => void
  deleteTemplate: (id: string) => void
}

// ============================================
// History Slice Types
// ============================================

export interface ExerciseHistoryEntry {
  date: string
  workoutId: string
  maxWeight: number
  totalVolume: number
  totalReps: number
  sets: Array<{ weight: number; reps: number }>
}

export interface HistorySlice {
  getWorkoutsByDate: (date: string) => Workout[]
  getWorkoutDates: () => string[]
  deleteWorkout: (id: string) => void
  getPersonalRecord: (exerciseId: string) => PersonalRecord | undefined
  calculateOneRepMax: (weight: number, reps: number) => number
  getLastPerformance: (exerciseId: string) => LastPerformance | null
  getExerciseHistory: (exerciseId: string) => ExerciseHistoryEntry[]
}

export interface WorkoutStore extends 
  WorkoutState,
  SessionSlice,
  TemplateSlice,
  HistorySlice {}

// ============================================
// Slice Creator Type
// ============================================

export type WorkoutSliceCreator<T> = StateCreator<
  WorkoutStore,
  [],
  [],
  T
>
