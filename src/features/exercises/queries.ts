import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"

export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.list(),
    queryFn: async () => {
      // Exercises are seeded via Dexie's populate hook on first database creation
      const exercises = await db.exercises.toArray()
      return exercises
    },
  })
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: queryKeys.exercises.detail(id),
    queryFn: async () => {
      const exercise = await db.exercises.get(id)
      if (!exercise) throw new Error(`Exercise ${id} not found`)
      return exercise
    },
    enabled: !!id,
  })
}

export function useExercisesByIds(ids: string[]) {
  return useQuery({
    queryKey: queryKeys.exercises.byIds(ids),
    queryFn: async () => {
      const exercises = await db.exercises.where("id").anyOf(ids).toArray()
      // Return as Map for O(1) lookup
      return new Map(exercises.map((e) => [e.id, e]))
    },
    enabled: ids.length > 0,
  })
}

export function useExercisesByMuscle(muscleGroup: string) {
  return useQuery({
    queryKey: queryKeys.exercises.byMuscle(muscleGroup),
    queryFn: async () => {
      return db.exercises.where("muscleGroup").equals(muscleGroup).toArray()
    },
    enabled: !!muscleGroup,
  })
}
