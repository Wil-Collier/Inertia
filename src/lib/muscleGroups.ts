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
  chest: "bg-red-500",
  back: "bg-blue-500",
  shoulders: "bg-purple-500",
  arms: "bg-orange-500",
  legs: "bg-green-500",
  core: "bg-yellow-500",
  cardio: "bg-pink-500",
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
