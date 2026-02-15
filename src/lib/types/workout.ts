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

import type { SyncableWithId } from "./syncable"

export interface Workout extends SyncableWithId {
  date: string
  name: string
  exercises: WorkoutExercise[]
  /**
   * Derived field: Array of exerciseIds for Dexie multi-entry indexing.
   * This is automatically computed when a workout is saved via:
   * - activeSessionService.finishWorkout()
   * - useAddWorkout mutation
   * - useUpdateWorkout mutation (when exercises are updated)
   * 
   * Optional during active session; always present on completed workouts.
   */
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

export interface WorkoutTemplate extends SyncableWithId {
  name: string
  exercises: TemplateExercise[]
}

export interface PersonalRecord {
  exerciseId: string
  weight: number
  weightUnit: "kg" | "lbs"
  reps: number
  date: string
  workoutId: string
}

export interface ActiveWorkoutSession {
  workout: Workout
  startedAt: string
  templateId?: string
}
