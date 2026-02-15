import { db } from "@/services/db"
import type { Exercise } from "@/lib/types"
import { exerciseDatabaseMap } from "@/data/exerciseDatabase"

export async function resolveExercisesByIds(ids: string[]): Promise<Map<string, Exercise>> {
  const result = new Map<string, Exercise>()
  const customIdsToFetch: string[] = []

  for (const id of ids) {
    const defaultExercise = exerciseDatabaseMap.get(id)
    if (defaultExercise) {
      const { instructions: _instructions, ...exercise } = defaultExercise
      result.set(id, exercise)
      continue
    }
    customIdsToFetch.push(id)
  }

  if (customIdsToFetch.length > 0) {
    const customExercises = await db.customExercises.bulkGet(customIdsToFetch)
    for (const exercise of customExercises) {
      if (exercise) {
        result.set(exercise.id, exercise)
      }
    }
  }

  return result
}
