import type { Exercise, MuscleGroup } from "@/lib/types"
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

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
}

export const muscleGroupColors: Record<MuscleGroup, string> = {
  chest: "bg-red-500",
  back: "bg-blue-500",
  shoulders: "bg-purple-500",
  arms: "bg-orange-500",
  legs: "bg-green-500",
  core: "bg-yellow-500",
  cardio: "bg-pink-500",
}
