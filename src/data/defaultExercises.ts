import type { Exercise, MuscleGroup } from "@/lib/types"

interface ExerciseDefinition {
  name: string
  muscleGroup: MuscleGroup
  isWeighted: boolean
}

const defaultExerciseList: ExerciseDefinition[] = [
  // Chest
  { name: "Bench Press", muscleGroup: "chest", isWeighted: true },
  { name: "Incline Bench Press", muscleGroup: "chest", isWeighted: true },
  { name: "Incline Dumbbell Press", muscleGroup: "chest", isWeighted: true },
  { name: "Dumbbell Flyes", muscleGroup: "chest", isWeighted: true },
  { name: "Push-ups", muscleGroup: "chest", isWeighted: false },
  { name: "Cable Crossover", muscleGroup: "chest", isWeighted: true },
  { name: "Pec Deck", muscleGroup: "chest", isWeighted: true },

  // Back
  { name: "Deadlift", muscleGroup: "back", isWeighted: true },
  { name: "Pull-ups", muscleGroup: "back", isWeighted: false },
  { name: "Weighted Pull-ups", muscleGroup: "back", isWeighted: true },
  { name: "Barbell Row", muscleGroup: "back", isWeighted: true },
  { name: "Lat Pulldown", muscleGroup: "back", isWeighted: true },
  { name: "Seated Cable Row", muscleGroup: "back", isWeighted: true },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "shoulders", isWeighted: true },
  { name: "Lateral Raises", muscleGroup: "shoulders", isWeighted: true },
  { name: "Front Raises", muscleGroup: "shoulders", isWeighted: true },
  { name: "Face Pulls", muscleGroup: "shoulders", isWeighted: true },
  { name: "Arnold Press", muscleGroup: "shoulders", isWeighted: true },

  // Arms
  { name: "Barbell Curl", muscleGroup: "arms", isWeighted: true },
  { name: "Hammer Curl", muscleGroup: "arms", isWeighted: true },
  { name: "Tricep Pushdown", muscleGroup: "arms", isWeighted: true },
  { name: "Tricep Rope Pushdown", muscleGroup: "arms", isWeighted: true },
  { name: "Skull Crushers", muscleGroup: "arms", isWeighted: true },
  { name: "Dips", muscleGroup: "arms", isWeighted: false },

  // Legs
  { name: "Squat", muscleGroup: "legs", isWeighted: true },
  { name: "Front Squat", muscleGroup: "legs", isWeighted: true },
  { name: "Goblet Squat", muscleGroup: "legs", isWeighted: true },
  { name: "Leg Press", muscleGroup: "legs", isWeighted: true },
  { name: "Romanian Deadlift", muscleGroup: "legs", isWeighted: true },
  { name: "Leg Curl", muscleGroup: "legs", isWeighted: true },
  { name: "Seated Leg Curl", muscleGroup: "legs", isWeighted: true },
  { name: "Leg Extension", muscleGroup: "legs", isWeighted: true },
  { name: "Standing Calf Raises", muscleGroup: "legs", isWeighted: true },
  { name: "Seated Calf Raises", muscleGroup: "legs", isWeighted: true },
  { name: "Lunges", muscleGroup: "legs", isWeighted: false },
  { name: "Walking Lunges", muscleGroup: "legs", isWeighted: false },

  // Core
  { name: "Plank", muscleGroup: "core", isWeighted: false },
  { name: "Side Plank", muscleGroup: "core", isWeighted: false },
  { name: "Dead Bug", muscleGroup: "core", isWeighted: false },
  { name: "Bird Dog", muscleGroup: "core", isWeighted: false },
  { name: "Bicycle Crunches", muscleGroup: "core", isWeighted: false },
  { name: "Crunches", muscleGroup: "core", isWeighted: false },
  { name: "Hanging Leg Raise", muscleGroup: "core", isWeighted: false },
  { name: "Russian Twist", muscleGroup: "core", isWeighted: true },
  { name: "Cable Woodchop", muscleGroup: "core", isWeighted: true },

  // Cardio
  { name: "Running", muscleGroup: "cardio", isWeighted: false },
  { name: "Cycling", muscleGroup: "cardio", isWeighted: false },
  { name: "Rowing", muscleGroup: "cardio", isWeighted: false },
  { name: "Jump Rope", muscleGroup: "cardio", isWeighted: false },
]

export const defaultExercises: Exercise[] = defaultExerciseList.map(
  (ex, index) => ({
    id: `default-${index + 1}`,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    isCustom: false,
    isWeighted: ex.isWeighted,
  })
)

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
