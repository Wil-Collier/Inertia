import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import { defaultExercises } from "@/data/defaultExercises"

export function useExercises() {
  return useQuery({
    queryKey: queryKeys.exercises.list(),
    queryFn: async () => {
      let exercises = await db.exercises.toArray()
      
      // Seed defaults if empty (replaces init() logic)
      if (exercises.length === 0) {
        await db.exercises.bulkAdd(defaultExercises)
        exercises = defaultExercises
      }
      
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
