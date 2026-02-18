import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { muscleGroups } from "@/lib/muscleGroups"
import { resolveExercisesByIds } from "@/features/exercises/resolveExercises"
import { getDefaultExercises, getDefaultExercisesByMuscle } from "@/data/exerciseDatabase"

function isMuscleGroup(value: string): value is MuscleGroup {
  return (muscleGroups as readonly string[]).includes(value)
}

/**
 * Returns all exercises (default + custom), merged.
 * Default exercises come from static data.
 * Custom exercises come from IndexedDB.
 */
export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.list(),
    queryFn: async (): Promise<Exercise[]> => {
      const defaultExercises = getDefaultExercises()

      // Get custom exercises from IndexedDB
      const customExercises = await db.customExercises.toArray()

      // Merge: defaults first, then custom
      return [...defaultExercises, ...customExercises]
    },
  })
}

/**
 * Returns a single exercise by ID.
 * Checks static defaults first (O(1)), then falls back to IndexedDB for custom.
 */
export function useExercise(id: string) {
  return useQuery({
    queryKey: queryKeys.exercises.detail(id),
    queryFn: async (): Promise<Exercise> => {
      const resolved = await resolveExercisesByIds([id])
      const exercise = resolved.get(id)
      if (exercise) return exercise

      throw new Error(`Exercise ${id} not found`)
    },
    enabled: !!id,
  })
}

/**
 * Returns multiple exercises by their IDs as a Map.
 * Efficiently handles both default and custom exercises.
 */
export function useExercisesByIds(ids: string[]) {
  return useQuery({
    queryKey: queryKeys.exercises.byIds(ids),
    queryFn: async (): Promise<Map<string, Exercise>> => await resolveExercisesByIds(ids),
    enabled: ids.length > 0,
  })
}

/**
 * Returns exercises filtered by muscle group.
 * Merges static defaults with custom exercises.
 */
export function useExercisesByMuscle(muscleGroup: string) {
  return useQuery({
    queryKey: queryKeys.exercises.byMuscle(muscleGroup),
    queryFn: async (): Promise<Exercise[]> => {
      if (!isMuscleGroup(muscleGroup)) return []

      // Get filtered defaults from static data
      const defaultByMuscle = getDefaultExercisesByMuscle(muscleGroup)

      // Get filtered custom exercises from IndexedDB
      const customByMuscle = await db.customExercises
        .where("muscleGroup")
        .equals(muscleGroup)
        .toArray()

      return [...defaultByMuscle, ...customByMuscle]
    },
    enabled: isMuscleGroup(muscleGroup),
  })
}
