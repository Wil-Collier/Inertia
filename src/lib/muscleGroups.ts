import type { MuscleGroup } from "@/lib/types"

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
  chest: "bg-muscle-chest",
  back: "bg-muscle-back",
  shoulders: "bg-muscle-shoulders",
  arms: "bg-muscle-arms",
  legs: "bg-muscle-legs",
  core: "bg-muscle-core",
  cardio: "bg-muscle-cardio",
}

export const muscleGroups: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "core",
  "cardio",
]
