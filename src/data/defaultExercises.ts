import type { Exercise } from "@/lib/types"
import { exerciseDatabase } from "./exerciseDatabase"

// Export all exercises from the database as default exercises
export const defaultExercises: Exercise[] = exerciseDatabase.map((ex) => ({
  id: ex.id,
  name: ex.name,
  muscleGroup: ex.muscleGroup,
  isCustom: ex.isCustom,
  isWeighted: ex.isWeighted,
  isTimeBased: ex.isTimeBased,
}))
