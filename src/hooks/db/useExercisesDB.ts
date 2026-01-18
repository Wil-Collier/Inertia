import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/services/db"
import type { Exercise, MuscleGroup } from "@/lib/types"

/**
 * Hook for searching and filtering exercises.
 */
export function useExercisesDB(query: string = "", muscleGroup: MuscleGroup | "all" = "all") {
  return useLiveQuery(async () => {
    let collection = db.exercises.toCollection()

    if (muscleGroup !== "all") {
      collection = db.exercises.where("muscleGroup").equals(muscleGroup)
    }

    let results = await collection.toArray()

    if (query) {
      const q = query.toLowerCase()
      results = results.filter((ex) => ex.name.toLowerCase().includes(q))
    }

    // Sort by name
    return results.sort((a, b) => a.name.localeCompare(b.name))
  }, [query, muscleGroup]) ?? []
}

/**
 * Hook for fetching multiple exercises by their IDs.
 * Useful for resolving names in a list of workouts.
 */
export function useExercisesByIdsDB(ids: string[]) {
  return useLiveQuery(async () => {
    if (ids.length === 0) return new Map<string, Exercise>()
    const exercises = await db.exercises.where("id").anyOf(ids).toArray()
    return new Map(exercises.map((ex) => [ex.id, ex]))
  }, [ids]) ?? new Map<string, Exercise>()
}

/**
 * Hook for fetching a single exercise by ID.
 */
export function useExerciseDB(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined
    return await db.exercises.get(id)
  }, [id])
}
