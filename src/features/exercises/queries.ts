import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Exercise, MuscleGroup } from "@/lib/types"
import { muscleGroups } from "@/lib/muscleGroups"
import { resolveExercisesByIds } from "@/features/exercises/resolveExercises"

function isMuscleGroup(value: string): value is MuscleGroup {
  return (muscleGroups as readonly string[]).includes(value)
}

/**
 * Dynamically import the exercise database to keep it code-split.
 * The module is cached after first import.
 */
async function getExerciseModule() {
  return await import("@/data/exerciseDatabase")
}

/**
 * Returns all exercises (default + custom), merged.
 * Default exercises come from the static JS bundle (lazy-loaded).
 * Custom exercises come from IndexedDB.
 */
export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.list(),
    queryFn: async (): Promise<Exercise[]> => {
      // Lazy-load exercise database (code-split)
      const { getDefaultExercises } = await getExerciseModule()
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

      // Lazy-load exercise database (code-split)
      const { getDefaultExercisesByMuscle } = await getExerciseModule()

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
