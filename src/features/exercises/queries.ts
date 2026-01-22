import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { Exercise, MuscleGroup } from "@/lib/types"

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
      // Lazy-load exercise database (code-split)
      const { exerciseDatabaseMap } = await getExerciseModule()

      // Check static defaults first (O(1) map lookup)
      const defaultExercise = exerciseDatabaseMap.get(id)
      if (defaultExercise) {
        // Return without instructions for consistency
        const { instructions: _, ...exercise } = defaultExercise
        return exercise
      }

      // Fall back to custom exercises in IndexedDB
      const customExercise = await db.customExercises.get(id)
      if (customExercise) {
        return customExercise
      }

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
    queryFn: async (): Promise<Map<string, Exercise>> => {
      // Lazy-load exercise database (code-split)
      const { exerciseDatabaseMap } = await getExerciseModule()

      const result = new Map<string, Exercise>()
      const customIdsToFetch: string[] = []

      // First pass: check static defaults (O(1) per lookup)
      for (const id of ids) {
        const defaultExercise = exerciseDatabaseMap.get(id)
        if (defaultExercise) {
          const { instructions: _, ...exercise } = defaultExercise
          result.set(id, exercise)
        } else {
          customIdsToFetch.push(id)
        }
      }

      // Fetch any remaining custom exercises from IndexedDB using bulkGet for O(1) primary key lookups
      if (customIdsToFetch.length > 0) {
        const customExercises = await db.customExercises.bulkGet(customIdsToFetch)
        for (const ex of customExercises) {
          if (ex) {
            result.set(ex.id, ex)
          }
        }
      }

      return result
    },
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
      // Lazy-load exercise database (code-split)
      const { getDefaultExercisesByMuscle } = await getExerciseModule()

      // Get filtered defaults from static data
      const defaultByMuscle = getDefaultExercisesByMuscle(muscleGroup as MuscleGroup)

      // Get filtered custom exercises from IndexedDB
      const customByMuscle = await db.customExercises
        .where("muscleGroup")
        .equals(muscleGroup)
        .toArray()

      return [...defaultByMuscle, ...customByMuscle]
    },
    enabled: !!muscleGroup,
  })
}
