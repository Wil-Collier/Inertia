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
  startWorkout: (name: string, templateId?: string) => Promise<void>
  cancelWorkout: () => Promise<void>
  finishWorkout: () => Promise<Workout | null>
  addExerciseToWorkout: (exerciseId: string) => Promise<void>
  removeExerciseFromWorkout: (workoutExerciseId: string) => Promise<void>
  addSet: (workoutExerciseId: string) => Promise<void>
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    updates: Partial<Omit<WorkoutSet, "id">>
  ) => Promise<void>
  removeSet: (workoutExerciseId: string, setId: string) => Promise<void>
  toggleSetComplete: (workoutExerciseId: string, setId: string) => Promise<void>
  updateExerciseNotes: (workoutExerciseId: string, notes: string) => Promise<void>
  bumpExerciseWeight: (workoutExerciseId: string, increment: number) => Promise<void>
}

// ============================================
// Template Slice Types
// ============================================

export interface TemplateSlice {
  createTemplate: (name: string, workout?: Workout) => Promise<WorkoutTemplate>
  updateTemplate: (id: string, updates: Partial<Omit<WorkoutTemplate, "id">>) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
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
  getWorkoutDates: () => string[]
  deleteWorkout: (id: string) => Promise<void>
  getPersonalRecord: (exerciseId: string) => PersonalRecord | undefined
  calculateOneRepMax: (weight: number, reps: number) => number
  getLastPerformance: (exerciseId: string) => LastPerformance | null
  getExerciseHistory: (exerciseId: string) => ExerciseHistoryEntry[]
}

export interface WorkoutStore extends 
  WorkoutState,
  SessionSlice,
  TemplateSlice,
  HistorySlice {
    isInitialized: boolean
    init: () => Promise<void>
  }

// ============================================
// Slice Creator Type
// ============================================

export type WorkoutSliceCreator<T> = StateCreator<
  WorkoutStore,
  [],
  [],
  T
>
